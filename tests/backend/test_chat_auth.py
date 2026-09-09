"""JWT protection for chat stream and scoped memories."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.auth.models import User
from backend.auth.passwords import hash_password
from backend.config import get_settings
from backend.db import Base, reset_engine
import backend.db as db


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("AUTH_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    get_settings.cache_clear()
    reset_engine()
    Base.metadata.drop_all(bind=db.engine)
    Base.metadata.create_all(bind=db.engine)
    return TestClient(app)


def _create_user(username: str, password: str, role: str) -> str:
    sess = db.SessionLocal()
    try:
        user = User(
            username=username,
            password_hash=hash_password(password),
            role=role,
        )
        sess.add(user)
        sess.commit()
        sess.refresh(user)
        return user.id
    finally:
        sess.close()


def _password_token(client: TestClient, username: str, password: str) -> dict:
    r = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": username, "password": password},
    )
    assert r.status_code == 200
    return r.json()


def test_chat_stream_requires_auth(client):
    r = client.post(
        "/api/chat/stream",
        json={"input": "hi", "session_id": "s1", "mode": "events"},
    )
    assert r.status_code == 401


def test_chat_stream_with_token_returns_ndjson(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = _password_token(client, "admin", "Admin123!")

    async def fake_astream(*_args, **_kwargs):
        if False:
            yield None  # make this an async generator
        return

    mock_graph = MagicMock()
    mock_graph.astream = fake_astream
    mock_state = MagicMock()
    mock_state.interrupts = []
    mock_graph.aget_state = AsyncMock(return_value=mock_state)

    with (
        patch("backend.chat.routes.resolve_user_chat_llm", return_value=("deepseek", MagicMock(), "a" * 16)),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)),
        patch("backend.chat.routes.AgentStreamProcessor") as proc_cls,
        patch("backend.chat.routes.extract_final_answer", return_value="hello"),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {}}),
    ):
        proc = MagicMock()
        proc.process.return_value = []
        proc.emit_turn_usage.return_value = None
        proc.final_response = "hello"
        proc_cls.return_value = proc

        r = client.post(
            "/api/chat/stream",
            headers={"Authorization": f"Bearer {tok['access_token']}"},
            json={"input": "hi", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200
    assert "application/x-ndjson" in r.headers.get("content-type", "")
    lines = [ln for ln in r.text.strip().splitlines() if ln]
    assert len(lines) >= 1
    assert '"type": "final_answer"' in lines[-1] or '"type":"final_answer"' in lines[-1]


def test_chat_stream_ignores_body_user_id(client):
    """user_id must come from JWT, never from request body."""
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = _password_token(client, "admin", "Admin123!")
    captured = {}

    async def fake_astream(*_args, **_kwargs):
        return
        yield  # pragma: no cover

    mock_graph = MagicMock()
    mock_graph.astream = fake_astream
    mock_state = MagicMock()
    mock_state.interrupts = []
    mock_graph.aget_state = AsyncMock(return_value=mock_state)

    def capture_run_config(*, user_id, session_id, **_kwargs):
        captured["user_id"] = user_id
        captured["session_id"] = session_id
        return {"configurable": {"user_id": user_id}}

    with (
        patch("backend.chat.routes.resolve_user_chat_llm", return_value=("deepseek", MagicMock(), "a" * 16)),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)),
        patch("backend.chat.routes.AgentStreamProcessor") as proc_cls,
        patch("backend.chat.routes.extract_final_answer", return_value="ok"),
        patch("backend.chat.routes.build_run_config", side_effect=capture_run_config),
    ):
        proc = MagicMock()
        proc.process.return_value = []
        proc.emit_turn_usage.return_value = None
        proc.final_response = "ok"
        proc_cls.return_value = proc

        r = client.post(
            "/api/chat/stream",
            headers={"Authorization": f"Bearer {tok['access_token']}"},
            json={
                "input": "hi",
                "session_id": "s1",
                "mode": "events",
                "user_id": "attacker-id",
            },
        )

    assert r.status_code == 200
    assert captured["user_id"] == tok["user_id"]
    assert captured["user_id"] != "attacker-id"


def test_me_memories_requires_auth(client):
    r = client.get("/api/me/memories")
    assert r.status_code == 401


def test_me_memories_scoped_to_current_user(client, monkeypatch):
    from types import SimpleNamespace

    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = _password_token(client, "admin", "Admin123!")
    user_id = tok["user_id"]

    item = SimpleNamespace(
        key="profile",
        value={"text": "likes charts"},
        created_at="2026-09-08T00:00:00Z",
        updated_at="2026-09-08T00:00:00Z",
    )
    memory_store = MagicMock()
    memory_store.asearch = AsyncMock(return_value=[item])

    async def get_store():
        return memory_store

    monkeypatch.setattr(
        "backend.chat.routes.get_async_memory_store",
        get_store,
    )

    r = client.get(
        "/api/me/memories",
        headers={"Authorization": f"Bearer {tok['access_token']}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["user_id"] == user_id
    assert body["total_memories"] == 1
    memory_store.asearch.assert_awaited_once_with(("memories", user_id))
