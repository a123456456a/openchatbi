"""Chat stream uses per-user LLM settings; graph cache is isolated per user."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.auth.models import User, UserLlmConfig
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
    yield TestClient(app)
    from backend.llm.graph_cache import _graphs

    _graphs.clear()


def _password_token(client: TestClient, username: str, password: str) -> dict:
    r = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": username, "password": password},
    )
    assert r.status_code == 200
    return r.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _bootstrap_admin(client: TestClient) -> dict:
    r = client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    assert r.status_code == 201
    return _password_token(client, "admin", "Admin123!")


def _put_deepseek(client: TestClient, token: str, api_key: str = "sk-user-key-1111") -> None:
    r = client.put(
        "/api/me/llm-settings",
        headers=_auth(token),
        json={
            "active_provider": "deepseek",
            "configs": [
                {
                    "provider": "deepseek",
                    "api_key": api_key,
                    "model": "deepseek-chat",
                    "base_url": None,
                }
            ],
        },
    )
    assert r.status_code == 200


def _mock_graph():
    async def fake_astream(*_args, **_kwargs):
        if False:
            yield None
        return

    graph = MagicMock()
    graph.astream = fake_astream
    state = MagicMock()
    state.interrupts = []
    graph.aget_state = AsyncMock(return_value=state)
    return graph


def test_chat_without_llm_settings_returns_400(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = _password_token(client, "admin", "Admin123!")
    with patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=_mock_graph())):
        r = client.post(
            "/api/chat/stream",
            headers=_auth(tok["access_token"]),
            json={"input": "hi", "session_id": "s1", "mode": "events"},
        )
    assert r.status_code == 400
    assert "设置" in r.json()["detail"]


def test_chat_with_settings_builds_graph_with_user_llm(client):
    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])
    mock_graph = _mock_graph()
    fake_llm = MagicMock(name="UserLLM")

    with (
        patch("backend.chat.routes.build_chat_model", return_value=fake_llm),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)) as build_graph,
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
    build_graph.assert_awaited()
    args = build_graph.await_args.args
    assert args[0] == tok["user_id"]
    assert args[1] == "deepseek"
    assert args[2] is fake_llm
    assert isinstance(args[3], str) and len(args[3]) == 16


def test_chat_ignores_request_provider(client):
    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])
    mock_graph = _mock_graph()
    fake_llm = MagicMock(name="UserLLM")

    with (
        patch("backend.chat.routes.build_chat_model", return_value=fake_llm),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)) as build_graph,
        patch("backend.chat.routes.AgentStreamProcessor") as proc_cls,
        patch("backend.chat.routes.extract_final_answer", return_value="ok"),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {}}),
    ):
        proc = MagicMock()
        proc.process.return_value = []
        proc.emit_turn_usage.return_value = None
        proc.final_response = "ok"
        proc_cls.return_value = proc

        r = client.post(
            "/api/chat/stream",
            headers=_auth(tok["access_token"]),
            json={"input": "hi", "session_id": "s1", "mode": "events", "provider": "openai"},
        )

    assert r.status_code == 200
    assert build_graph.await_args.args[1] == "deepseek"


def test_chat_resumes_pending_interrupt_with_command(client):
    """When the graph is paused on an interrupt, the next turn must resume via
    `Command(resume=...)` on the same thread instead of a fresh message input."""
    from langgraph.types import Command

    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])

    seen_inputs = []

    async def fake_astream(stream_input, *_args, **_kwargs):
        seen_inputs.append(stream_input)
        if False:
            yield None
        return

    interrupt = MagicMock()
    interrupt.value = {"text": "Approve?", "buttons": ["approve", "reject"]}
    state = MagicMock()
    state.interrupts = [interrupt]

    mock_graph = MagicMock()
    mock_graph.astream = fake_astream
    mock_graph.aget_state = AsyncMock(return_value=state)

    with (
        patch("backend.chat.routes.build_chat_model", return_value=MagicMock()),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)),
        patch("backend.chat.routes.AgentStreamProcessor") as proc_cls,
        patch("backend.chat.routes.extract_final_answer", return_value="ok"),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {}}),
    ):
        proc = MagicMock()
        proc.process.return_value = []
        proc.emit_turn_usage.return_value = None
        proc.final_response = "ok"
        proc_cls.return_value = proc

        r = client.post(
            "/api/chat/stream",
            headers=_auth(tok["access_token"]),
            json={"input": "approve", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200
    assert len(seen_inputs) == 1
    assert isinstance(seen_inputs[0], Command)
    assert seen_inputs[0].resume == "approve"


def test_put_settings_invalidates_user_graphs(client):
    from backend.llm.graph_cache import _graphs

    tok = _bootstrap_admin(client)
    user_id = tok["user_id"]
    _graphs[f"{user_id}:deepseek:deadbeefdeadbeef"] = object()
    _graphs["other-user:deepseek:deadbeefdeadbeef"] = object()

    _put_deepseek(client, tok["access_token"])

    assert f"{user_id}:deepseek:deadbeefdeadbeef" not in _graphs
    assert "other-user:deepseek:deadbeefdeadbeef" in _graphs


def test_delete_settings_invalidates_user_graphs(client):
    from backend.llm.graph_cache import _graphs

    tok = _bootstrap_admin(client)
    user_id = tok["user_id"]
    _put_deepseek(client, tok["access_token"])
    _graphs[f"{user_id}:deepseek:cafebabecafebabe"] = object()
    _graphs["other-user:zhipu:cafebabecafebabe"] = object()

    deleted = client.delete("/api/me/llm-settings/deepseek", headers=_auth(tok["access_token"]))
    assert deleted.status_code == 204
    assert f"{user_id}:deepseek:cafebabecafebabe" not in _graphs
    assert "other-user:zhipu:cafebabecafebabe" in _graphs


def test_graph_builds_under_llm_override(client):
    """Cached graph is built while the user LLM override is active."""
    from openchatbi.llm.llm import get_llm

    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])
    mock_graph = _mock_graph()
    fake_llm = MagicMock(name="UserLLM")
    seen = {}

    async def fake_build(*_args, **_kwargs):
        try:
            seen["llm"] = get_llm()
        except Exception:
            seen["llm"] = None
        seen["llm_provider"] = _kwargs.get("llm_provider")
        return mock_graph

    with (
        patch("backend.chat.routes.build_chat_model", return_value=fake_llm),
        patch("backend.llm.graph_cache.build_agent_graph_async", new=fake_build),
        patch("backend.llm.graph_cache.get_async_memory_store", new=AsyncMock(return_value=None)),
        patch("backend.llm.graph_cache.get_async_checkpointer", new=AsyncMock(return_value=object())),
        patch("backend.llm.graph_cache.config") as cfg,
        patch("backend.chat.routes.AgentStreamProcessor") as proc_cls,
        patch("backend.chat.routes.extract_final_answer", return_value="hello"),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {}}),
    ):
        cfg.get.return_value.catalog_store = "catalog"
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
    assert seen["llm"] is fake_llm
    assert seen["llm_provider"] is None


def test_decrypt_failure_returns_500(client):
    tok = _bootstrap_admin(client)
    sess = db.SessionLocal()
    try:
        user = sess.get(User, tok["user_id"])
        user.active_llm_provider = "deepseek"
        sess.add(
            UserLlmConfig(
                user_id=user.id,
                provider="deepseek",
                api_key_encrypted="not-a-valid-fernet-token",
                model="deepseek-chat",
                base_url=None,
            )
        )
        sess.commit()
    finally:
        sess.close()

    with patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=_mock_graph())):
        r = client.post(
            "/api/chat/stream",
            headers=_auth(tok["access_token"]),
            json={"input": "hi", "session_id": "s1", "mode": "events"},
        )
    assert r.status_code == 500
    detail = r.json()["detail"]
    assert "decrypt" in detail.lower()
    assert "save" in detail.lower()
    assert "请先在设置中配置模型" not in detail


def test_factory_value_error_surfaces_to_client(client):
    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])
    factory_error = "langchain-google-genai is not installed; install the google-genai extra to use Gemini"

    with (
        patch("backend.chat.routes.build_chat_model", side_effect=ValueError(factory_error)),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=_mock_graph())),
    ):
        r = client.post(
            "/api/chat/stream",
            headers=_auth(tok["access_token"]),
            json={"input": "hi", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 400
    assert r.json()["detail"] == factory_error
    assert "请先在设置中配置模型" not in r.json()["detail"]


def test_abort_interrupt_clears_paused_thread(client):
    tok = _bootstrap_admin(client)
    _put_deepseek(client, tok["access_token"])

    interrupt = MagicMock()
    interrupt.value = {"text": "Approve?", "buttons": ["approve"]}
    state_with_interrupt = MagicMock()
    state_with_interrupt.interrupts = [interrupt]
    state_cleared = MagicMock()
    state_cleared.interrupts = []

    checkpointer = AsyncMock()
    mock_graph = MagicMock()
    mock_graph.checkpointer = checkpointer
    mock_graph.aget_state = AsyncMock(side_effect=[state_with_interrupt, state_cleared])

    with (
        patch("backend.chat.routes.build_chat_model", return_value=MagicMock()),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock(return_value=mock_graph)),
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
    ):
        aborted = client.post(
            "/api/chat/sessions/s1/abort-interrupt",
            headers=_auth(tok["access_token"]),
        )
        assert aborted.status_code == 200
        assert aborted.json() == {"aborted": True, "had_interrupt": True}
        assert [c.args[0] for c in checkpointer.adelete_thread.await_args_list] == [
            "u-s1",
            "u-s1:data_analysis",
        ]

        noop = client.post(
            "/api/chat/sessions/s1/abort-interrupt",
            headers=_auth(tok["access_token"]),
        )
        assert noop.status_code == 200
        assert noop.json() == {"aborted": False, "had_interrupt": False}


def test_abort_interrupt_without_llm_settings_clears_paused_thread(client):
    """Dismissing an interrupt must work before the user configures a model."""
    tok = _bootstrap_admin(client)

    saved = MagicMock()
    saved.pending_writes = [("task-1", "__interrupt__", [{"text": "Approve?"}])]
    checkpointer = AsyncMock()
    checkpointer.aget_tuple = AsyncMock(return_value=saved)

    with (
        patch("backend.chat.routes.get_async_checkpointer", new=AsyncMock(return_value=checkpointer)),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock()) as build_graph,
        patch("backend.chat.routes.resolve_user_chat_llm") as resolve_llm,
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
    ):
        aborted = client.post(
            "/api/chat/sessions/s1/abort-interrupt",
            headers=_auth(tok["access_token"]),
        )

    assert aborted.status_code == 200
    assert aborted.json() == {"aborted": True, "had_interrupt": True}
    assert [c.args[0] for c in checkpointer.adelete_thread.await_args_list] == [
        "u-s1",
        "u-s1:data_analysis",
    ]
    build_graph.assert_not_called()
    resolve_llm.assert_not_called()


def test_abort_interrupt_without_llm_settings_is_successful_noop(client):
    tok = _bootstrap_admin(client)
    checkpointer = AsyncMock()
    checkpointer.aget_tuple = AsyncMock(return_value=None)

    with (
        patch("backend.chat.routes.get_async_checkpointer", new=AsyncMock(return_value=checkpointer)),
        patch("backend.chat.routes.get_or_build_graph", new=AsyncMock()) as build_graph,
        patch("backend.chat.routes.build_run_config", return_value={"configurable": {"thread_id": "u-s1"}}),
    ):
        noop = client.post(
            "/api/chat/sessions/s1/abort-interrupt",
            headers=_auth(tok["access_token"]),
        )

    assert noop.status_code == 200
    assert noop.json() == {"aborted": False, "had_interrupt": False}
    checkpointer.adelete_thread.assert_not_awaited()
    build_graph.assert_not_called()


def test_chat_starts_fresh_message_after_abort_not_resume(client):
    """After aborting a paused interrupt, the next stream must not use Command(resume=...)."""
    from langgraph.types import Command

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
    ):
        proc = MagicMock()
        proc.process.return_value = []
        proc.emit_turn_usage.return_value = None
        proc.final_response = "ok"
        proc_cls.return_value = proc

        r = client.post(
            "/api/chat/stream",
            headers=_auth(tok["access_token"]),
            json={"input": "全新问题", "session_id": "s1", "mode": "events"},
        )

    assert r.status_code == 200
    assert len(seen_inputs) == 1
    assert not isinstance(seen_inputs[0], Command)
    assert seen_inputs[0] == {"messages": [("user", "全新问题")]}
