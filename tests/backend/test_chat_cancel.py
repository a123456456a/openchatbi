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

    with (
        patch("backend.chat.routes.get_async_checkpointer", new=AsyncMock(return_value=checkpointer)),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock()) as build_graph,
        patch("backend.chat.routes.resolve_user_chat_llm") as resolve_llm,
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
    build_graph.assert_not_called()
    resolve_llm.assert_not_called()


def test_cancel_without_llm_settings_succeeds(client):
    """Stop/cancel must not require /api/me/llm-settings."""
    from tests.backend.test_chat_user_llm import _bootstrap_admin

    tok = _bootstrap_admin(client)
    checkpointer = AsyncMock()

    with (
        patch("backend.chat.routes.get_async_checkpointer", new=AsyncMock(return_value=checkpointer)),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock()) as build_graph,
        patch("backend.chat.routes.resolve_user_chat_llm") as resolve_llm,
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
        patch("backend.chat.routes.request_cancel", new=AsyncMock(return_value=False)),
    ):
        r = client.post(
            "/api/chat/sessions/s1/cancel",
            headers=_auth(tok["access_token"]),
        )

    assert r.status_code == 200
    body = r.json()
    assert body["cancelled"] is True
    assert body["had_running_run"] is False
    assert body["thread_cleared"] is True
    assert "设置" not in str(body)
    checkpointer.adelete_thread.assert_awaited_once_with("u-s1")
    build_graph.assert_not_called()
    resolve_llm.assert_not_called()


def test_checkpoint_has_interrupt_detects_langgraph_write():
    from backend.chat.routes import _checkpoint_has_interrupt

    assert _checkpoint_has_interrupt(None) is False
    idle = MagicMock()
    idle.pending_writes = [("task-1", "messages", {"ok": True})]
    assert _checkpoint_has_interrupt(idle) is False
    paused = MagicMock()
    paused.pending_writes = [("task-1", "__interrupt__", [{"text": "Approve?"}])]
    assert _checkpoint_has_interrupt(paused) is True
    empty = MagicMock()
    empty.pending_writes = None
    assert _checkpoint_has_interrupt(empty) is False


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

def test_cancel_works_without_activated_warehouse(client, monkeypatch):
    """Stopping a run must not depend on warehouse activation / demo exemption."""
    from tests.backend.test_chat_user_llm import _bootstrap_admin

    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", "false")
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()

    tok = _bootstrap_admin(client)
    checkpointer = AsyncMock()

    with (
        patch("backend.chat.routes.get_async_checkpointer", new=AsyncMock(return_value=checkpointer)),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
        patch("backend.chat.routes.request_cancel", new=AsyncMock(return_value=True)),
    ):
        r = client.post(
            "/api/chat/sessions/s1/cancel",
            headers=_auth(tok["access_token"]),
        )

    assert r.status_code == 200
    assert r.json()["cancelled"] is True
    checkpointer.adelete_thread.assert_awaited_once_with("u-s1")
    get_settings.cache_clear()


def test_mid_stream_cancel_emits_cancelled_and_clears_thread(client):
    """When cancel flips during astream, NDJSON ends with cancelled and thread is cleared."""
    from tests.backend.test_chat_user_llm import _bootstrap_admin, _put_deepseek

    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])

    cancel_event = asyncio.Event()
    cancel_event.set()

    async def fake_astream(*_args, **_kwargs):
        yield ((), "updates", {"llm_node": {"messages": []}})
        if False:
            yield None

    checkpointer = AsyncMock()
    state_cleared = MagicMock()
    state_cleared.interrupts = []
    mock_graph = MagicMock()
    mock_graph.astream = fake_astream
    mock_graph.aget_state = AsyncMock(return_value=state_cleared)
    mock_graph.checkpointer = checkpointer

    with (
        patch("backend.chat.routes.build_chat_model", return_value=MagicMock()),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)),
        patch("backend.chat.routes.AgentStreamProcessor") as proc_cls,
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
        patch("backend.chat.routes.register_run", new=AsyncMock(return_value=cancel_event)),
        patch("backend.chat.routes.unregister_run", new=AsyncMock()),
        patch("backend.chat.routes.is_cancel_requested", new=AsyncMock(return_value=True)),
        patch("backend.chat.routes.clear_cancel", new=AsyncMock()) as clear_cancel,
    ):
        proc = MagicMock()
        proc.process.return_value = []
        proc.emit_turn_usage.return_value = None
        proc.final_response = ""
        proc_cls.return_value = proc

        r = client.post(
            "/api/chat/stream",
            headers=_auth(tok["access_token"]),
            json={"input": "hi", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200
    lines = [ln for ln in r.text.splitlines() if ln.strip()]
    assert any('"type": "cancelled"' in ln or '"type":"cancelled"' in ln for ln in lines)
    checkpointer.adelete_thread.assert_awaited_with("u-s1")
    clear_cancel.assert_awaited()


def test_cancel_while_interrupt_pending_next_stream_is_fresh(client):
    """Cancel must clear a paused interrupt thread so the next stream is not resume."""
    from langgraph.types import Command

    from tests.backend.test_chat_user_llm import _bootstrap_admin, _put_deepseek

    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])

    checkpointer = AsyncMock()
    with (
        patch("backend.chat.routes.get_async_checkpointer", new=AsyncMock(return_value=checkpointer)),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
        patch("backend.chat.routes.request_cancel", new=AsyncMock(return_value=False)),
    ):
        cancelled = client.post(
            "/api/chat/sessions/s1/cancel",
            headers=_auth(tok["access_token"]),
        )
    assert cancelled.status_code == 200
    assert cancelled.json()["thread_cleared"] is True
    checkpointer.adelete_thread.assert_awaited_once_with("u-s1")

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
            json={"input": "new question", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200
    assert len(seen_inputs) == 1
    assert not isinstance(seen_inputs[0], Command)
    assert seen_inputs[0] == {"messages": [("user", "new question")]}


def test_abort_interrupt_works_without_activated_warehouse(client, monkeypatch):
    from tests.backend.test_chat_user_llm import _bootstrap_admin

    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", "false")
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()

    tok = _bootstrap_admin(client)
    saved = MagicMock()
    saved.pending_writes = [("task-1", "__interrupt__", [{"text": "Approve?"}])]
    checkpointer = AsyncMock()
    checkpointer.aget_tuple = AsyncMock(return_value=saved)

    with (
        patch("backend.chat.routes.get_async_checkpointer", new=AsyncMock(return_value=checkpointer)),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
    ):
        r = client.post(
            "/api/chat/sessions/s1/abort-interrupt",
            headers=_auth(tok["access_token"]),
        )

    assert r.status_code == 200
    assert r.json() == {"aborted": True, "had_interrupt": True}
    checkpointer.adelete_thread.assert_awaited_once_with("u-s1")
    get_settings.cache_clear()

