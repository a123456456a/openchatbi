import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.auth.models import UserLlmConfig
from backend.config import get_settings
from backend.db import Base, reset_engine
import backend.db as db
from backend.llm.crypto import decrypt_api_key


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


def test_put_and_get_masks_key(client):
    tok = _bootstrap_admin(client)
    r = client.put(
        "/api/me/llm-settings",
        headers=_auth(tok["access_token"]),
        json={
            "active_provider": "deepseek",
            "configs": [
                {
                    "provider": "deepseek",
                    "api_key": "sk-secret-key-9999",
                    "model": "deepseek-chat",
                    "base_url": None,
                }
            ],
        },
    )
    assert r.status_code == 200
    g = client.get("/api/me/llm-settings", headers=_auth(tok["access_token"]))
    assert g.status_code == 200
    body = g.json()
    assert body["active_provider"] == "deepseek"
    catalog_ids = {item["id"] for item in body["catalog"]}
    assert catalog_ids == {"deepseek", "zhipu", "openai", "anthropic", "gemini", "openai_compatible"}
    cfg = next(c for c in body["configs"] if c["provider"] == "deepseek")
    assert cfg["has_key"] is True
    assert "sk-secret-key-9999" not in str(body)
    assert "sk-secret-key-9999" not in str(r.json())
    assert cfg["api_key_masked"].endswith("9999")


def test_user_b_cannot_see_user_a_keys(client):
    admin_tok = _bootstrap_admin(client)
    created = client.post(
        "/api/users",
        headers=_auth(admin_tok["access_token"]),
        json={"username": "bob", "password": "BobPass123!", "role": "analyst"},
    )
    assert created.status_code == 201
    bob_tok = _password_token(client, "bob", "BobPass123!")

    admin_put = client.put(
        "/api/me/llm-settings",
        headers=_auth(admin_tok["access_token"]),
        json={
            "active_provider": "deepseek",
            "configs": [
                {
                    "provider": "deepseek",
                    "api_key": "sk-admin-secret-aaaa",
                    "model": "deepseek-chat",
                    "base_url": None,
                }
            ],
        },
    )
    assert admin_put.status_code == 200

    bob_put = client.put(
        "/api/me/llm-settings",
        headers=_auth(bob_tok["access_token"]),
        json={
            "active_provider": "zhipu",
            "configs": [
                {
                    "provider": "zhipu",
                    "api_key": "sk-bob-secret-bbbb",
                    "model": "glm-4-flash",
                    "base_url": None,
                }
            ],
        },
    )
    assert bob_put.status_code == 200

    bob_get = client.get("/api/me/llm-settings", headers=_auth(bob_tok["access_token"]))
    assert bob_get.status_code == 200
    bob_body = bob_get.json()
    bob_providers = {c["provider"] for c in bob_body["configs"]}
    assert bob_body["active_provider"] == "zhipu"
    assert "deepseek" not in bob_providers
    assert "sk-admin-secret-aaaa" not in str(bob_body)
    assert "aaaa" not in str(bob_body)

    admin_get = client.get("/api/me/llm-settings", headers=_auth(admin_tok["access_token"]))
    admin_body = admin_get.json()
    admin_providers = {c["provider"] for c in admin_body["configs"]}
    assert "zhipu" not in admin_providers
    assert "sk-bob-secret-bbbb" not in str(admin_body)


def test_put_empty_key_preserves(client):
    tok = _bootstrap_admin(client)
    headers = _auth(tok["access_token"])
    first = client.put(
        "/api/me/llm-settings",
        headers=headers,
        json={
            "active_provider": "deepseek",
            "configs": [
                {
                    "provider": "deepseek",
                    "api_key": "sk-keep-this-key-4242",
                    "model": "deepseek-chat",
                    "base_url": None,
                }
            ],
        },
    )
    assert first.status_code == 200

    second = client.put(
        "/api/me/llm-settings",
        headers=headers,
        json={
            "configs": [
                {
                    "provider": "deepseek",
                    "api_key": "",
                    "model": "deepseek-reasoner",
                    "base_url": None,
                }
            ],
        },
    )
    assert second.status_code == 200
    assert second.json()["configs"][0]["model"] == "deepseek-reasoner"

    third = client.put(
        "/api/me/llm-settings",
        headers=headers,
        json={
            "configs": [
                {
                    "provider": "deepseek",
                    "model": "deepseek-chat",
                    "base_url": None,
                }
            ],
        },
    )
    assert third.status_code == 200

    sess = db.SessionLocal()
    try:
        row = sess.query(UserLlmConfig).filter_by(provider="deepseek").one()
        assert decrypt_api_key(row.api_key_encrypted) == "sk-keep-this-key-4242"
    finally:
        sess.close()

    g = client.get("/api/me/llm-settings", headers=headers)
    assert "sk-keep-this-key-4242" not in str(g.json())
    assert g.json()["configs"][0]["api_key_masked"].endswith("4242")


def test_openai_compatible_requires_base_url(client):
    tok = _bootstrap_admin(client)
    r = client.put(
        "/api/me/llm-settings",
        headers=_auth(tok["access_token"]),
        json={
            "configs": [
                {
                    "provider": "openai_compatible",
                    "api_key": "sk-compat-key",
                    "model": "local-model",
                    "base_url": None,
                }
            ],
        },
    )
    assert r.status_code == 400


def test_set_active_requires_existing_or_incoming_key(client):
    tok = _bootstrap_admin(client)
    headers = _auth(tok["access_token"])
    missing = client.put(
        "/api/me/llm-settings",
        headers=headers,
        json={"active_provider": "deepseek"},
    )
    assert missing.status_code == 400

    stored = client.put(
        "/api/me/llm-settings",
        headers=headers,
        json={
            "configs": [
                {
                    "provider": "deepseek",
                    "api_key": "sk-now-has-key-7777",
                    "model": "deepseek-chat",
                }
            ],
        },
    )
    assert stored.status_code == 200

    activate = client.put(
        "/api/me/llm-settings",
        headers=headers,
        json={"active_provider": "deepseek"},
    )
    assert activate.status_code == 200
    assert activate.json()["active_provider"] == "deepseek"


def test_delete_clears_active_if_deleted_was_active(client):
    tok = _bootstrap_admin(client)
    headers = _auth(tok["access_token"])
    put = client.put(
        "/api/me/llm-settings",
        headers=headers,
        json={
            "active_provider": "deepseek",
            "configs": [
                {
                    "provider": "deepseek",
                    "api_key": "sk-to-delete-8888",
                    "model": "deepseek-chat",
                }
            ],
        },
    )
    assert put.status_code == 200

    deleted = client.delete("/api/me/llm-settings/deepseek", headers=headers)
    assert deleted.status_code == 204
    g = client.get("/api/me/llm-settings", headers=headers)
    assert g.status_code == 200
    body = g.json()
    assert body["active_provider"] is None
    assert body["configs"] == []


def test_unauthenticated_settings_rejected(client):
    g = client.get("/api/me/llm-settings")
    assert g.status_code == 401
    p = client.put("/api/me/llm-settings", json={})
    assert p.status_code == 401


def test_validation_error_redacts_api_key(client):
    tok = _bootstrap_admin(client)
    secret_key = "sk-live-abcdef1234567890abcdef1234567890"
    r = client.put(
        "/api/me/llm-settings",
        headers=_auth(tok["access_token"]),
        json={
            "configs": [
                {
                    "provider": "deepseek",
                    "api_key": secret_key,
                }
            ],
        },
    )
    assert r.status_code == 422
    assert secret_key not in r.text
