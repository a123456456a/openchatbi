"""Fail-closed warehouse gate: no silent demo SQLite in production."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.auth.passwords import hash_password
from backend.config import demo_warehouse_allowed, get_settings
from backend.db import Base, reset_engine
import backend.db as db
from backend.warehouse.gate import MISSING_WAREHOUSE_DETAIL
from backend.warehouse.models import DataWarehouseConnection


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("AUTH_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    # Fail-closed baseline for this module; individual tests re-open demo as needed.
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", "false")
    get_settings.cache_clear()
    reset_engine()
    Base.metadata.drop_all(bind=db.engine)
    Base.metadata.create_all(bind=db.engine)
    yield TestClient(app)
    get_settings.cache_clear()


def _bootstrap_admin(client: TestClient) -> dict:
    r = client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    assert r.status_code == 201
    r = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": "admin", "password": "Admin123!"},
    )
    assert r.status_code == 200
    return r.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _activate_dummy_warehouse() -> str:
    sess = db.SessionLocal()
    try:
        row = DataWarehouseConnection(
            name="prod-wh",
            dialect="sqlite",
            database="./data/prod.sqlite",
            is_active=True,
        )
        sess.add(row)
        sess.commit()
        sess.refresh(row)
        return row.id
    finally:
        sess.close()


def _mock_chat_graph():
    async def fake_astream(*_args, **_kwargs):
        if False:
            yield None
        return

    mock_graph = MagicMock()
    mock_graph.astream = fake_astream
    mock_state = MagicMock()
    mock_state.interrupts = []
    mock_graph.aget_state = AsyncMock(return_value=mock_state)
    return mock_graph


def test_demo_warehouse_allowed_helper():
    assert demo_warehouse_allowed(True, "production")
    assert demo_warehouse_allowed(False, "development")
    assert demo_warehouse_allowed(False, "dev")
    assert demo_warehouse_allowed(False, "local")
    assert demo_warehouse_allowed(False, "test")
    assert not demo_warehouse_allowed(False, "production")
    assert not demo_warehouse_allowed(False, "staging")


def test_chat_stream_rejects_without_active_warehouse(client):
    tok = _bootstrap_admin(client)
    r = client.post(
        "/api/chat/stream",
        headers=_auth(tok["access_token"]),
        json={"input": "hi", "session_id": "s1", "mode": "events"},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == MISSING_WAREHOUSE_DETAIL


def test_chat_stream_allows_when_demo_flag_set(client, monkeypatch):
    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", "true")
    get_settings.cache_clear()
    tok = _bootstrap_admin(client)
    mock_graph = _mock_chat_graph()

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
            headers=_auth(tok["access_token"]),
            json={"input": "hi", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200


@pytest.mark.parametrize("app_env", ["development", "dev", "local", "test"])
def test_chat_stream_allows_when_app_env_dev(client, monkeypatch, app_env):
    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", "false")
    monkeypatch.setenv("APP_ENV", app_env)
    get_settings.cache_clear()
    tok = _bootstrap_admin(client)
    mock_graph = _mock_chat_graph()

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
            headers=_auth(tok["access_token"]),
            json={"input": "hi", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200


def test_chat_stream_allows_with_active_warehouse(client):
    tok = _bootstrap_admin(client)
    _activate_dummy_warehouse()
    mock_graph = _mock_chat_graph()

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
            headers=_auth(tok["access_token"]),
            json={"input": "hi", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200


def test_warehouse_status_demo_mode_when_exempted(client, monkeypatch):
    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", "true")
    get_settings.cache_clear()
    tok = _bootstrap_admin(client)
    r = client.get("/api/warehouse/status", headers=_auth(tok["access_token"]))
    assert r.status_code == 200
    body = r.json()
    assert body["has_active_connection"] is False
    assert body["demo_allowed"] is True
    assert body["demo_mode"] is True
    assert body["active_connection_id"] is None


def test_warehouse_status_not_demo_when_active(client, monkeypatch):
    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", "true")
    get_settings.cache_clear()
    tok = _bootstrap_admin(client)
    conn_id = _activate_dummy_warehouse()
    r = client.get("/api/warehouse/status", headers=_auth(tok["access_token"]))
    assert r.status_code == 200
    body = r.json()
    assert body["has_active_connection"] is True
    assert body["demo_mode"] is False
    assert body["active_connection_id"] == conn_id


def test_warehouse_status_requires_auth(client):
    r = client.get("/api/warehouse/status")
    assert r.status_code == 401


def test_warehouse_status_fail_closed_flags(client):
    tok = _bootstrap_admin(client)
    r = client.get("/api/warehouse/status", headers=_auth(tok["access_token"]))
    assert r.status_code == 200
    body = r.json()
    assert body["has_active_connection"] is False
    assert body["demo_allowed"] is False
    assert body["demo_mode"] is False
