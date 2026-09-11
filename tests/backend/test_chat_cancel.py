"""Server-side cancel clears the thread so the next turn is fresh."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import backend.db as db
from backend.app import app
from backend.chat.run_control import (
    is_cancel_requested,
    register_run,
    request_cancel,
    reset_run_control_for_tests,
    unregister_run,
)
from backend.config import get_settings
from backend.db import Base, reset_engine


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("AUTH_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("RUN_CANCEL_SQLITE_PATH", str(tmp_path / "run_cancels.db"))
    monkeypatch.setenv("CHECKPOINTER_SQLITE_PATH", str(tmp_path / "checkpoints.db"))
    get_settings.cache_clear()
    reset_engine()
    reset_run_control_for_tests()
    Base.metadata.drop_all(bind=db.engine)
    Base.metadata.create_all(bind=db.engine)
    yield TestClient(app)
    from backend.llm.graph_cache import _graphs

    _graphs.clear()
    reset_run_control_for_tests()


@pytest.fixture(autouse=True)
def _reset_run_control(tmp_path, monkeypatch):
    monkeypatch.setenv("RUN_CANCEL_SQLITE_PATH", str(tmp_path / "run_cancels.db"))
    get_settings.cache_clear()
    reset_run_control_for_tests()
    yield
    reset_run_control_for_tests()
    get_settings.cache_clear()


def test_request_cancel_sets_local_event_and_shared_flag():
    async def run():
        event = await register_run("t1")
        assert not event.is_set()
        had = await request_cancel("t1")
        assert had is True
        assert event.is_set()
        assert await is_cancel_requested("t1") is True
        await unregister_run("t1", event)

    asyncio.run(run())


def test_cross_worker_cancel_visible_via_shared_ledger():
    """Simulate another worker: no local event, only shared sqlite flag."""

    async def run():
        had = await request_cancel("remote-thread")
        assert had is False
        assert await is_cancel_requested("remote-thread") is True

    asyncio.run(run())


def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_cancel_endpoint_clears_thread_and_signals_run(client):
    from tests.backend.test_chat_user_llm import _bootstrap_admin, _put_deepseek

    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])

    checkpointer = AsyncMock()
    mock_graph = MagicMock()
    mock_graph.checkpointer = checkpointer

    with (
        patch("backend.chat.routes.build_chat_model", return_value=MagicMock()),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
        patch("backend.chat.routes.request_cancel", new=AsyncMock(return_value=True)) as req_cancel,
    ):
        r = client.post(
            "/api/chat/sessions/s1/cancel",
            headers=_auth(tok["access_token"]),
        )

    assert r.status_code == 200
    body = r.json()
    assert body["cancelled"] is True
    assert body["had_running_run"] is True
    assert body["thread_cleared"] is True
    checkpointer.adelete_thread.assert_awaited_once_with("u-s1")
    req_cancel.assert_awaited_once_with("u-s1")


def test_stream_after_cancel_starts_fresh_message_not_resume(client):
    """After cancel clears the thread, the next stream must not Command(resume=...)."""
    from langgraph.types import Command

    from tests.backend.test_chat_user_llm import _bootstrap_admin, _put_deepseek

    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])

    seen_inputs = []

    async def fake_astream(stream_input, *_args, **_kwargs):
        seen_inputs.append(stream_input)
        if False:
            yield None
        return

    state_cleared = MagicMock()
    state_cleared.interrupts = []

    mock_graph = MagicMock()
    mock_graph.astream = fake_astream
    mock_graph.aget_state = AsyncMock(return_value=state_cleared)
    mock_graph.checkpointer = AsyncMock()

    with (
        patch("backend.chat.routes.build_chat_model", return_value=MagicMock()),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)),
        patch("backend.chat.routes.AgentStreamProcessor") as proc_cls,
        patch("backend.chat.routes.extract_final_answer", return_value="ok"),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
        patch("backend.chat.routes.register_run", new=AsyncMock(return_value=asyncio.Event())),
        patch("backend.chat.routes.unregister_run", new=AsyncMock()),
        patch("backend.chat.routes.is_cancel_requested", new=AsyncMock(return_value=False)),
        patch("backend.chat.routes.clear_cancel", new=AsyncMock()),
    ):
        proc = MagicMock()
        proc.process.return_value = []
        proc.emit_turn_usage.return_value = None
        proc.final_response = "ok"
        proc_cls.return_value = proc

        r = client.post(
            "/api/chat/stream",
            headers=_auth(tok["access_token"]),
            json={"input": "新问题", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200
    assert len(seen_inputs) == 1
    assert not isinstance(seen_inputs[0], Command)
    assert seen_inputs[0] == {"messages": [("user", "新问题")]}
