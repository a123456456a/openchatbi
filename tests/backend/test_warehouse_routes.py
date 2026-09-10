from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.config import get_settings
from backend.db import Base, reset_engine
import backend.db as db
from backend.warehouse.models import DataWarehouseConnection


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


def _create_viewer(client: TestClient, admin_token: str) -> dict:
    r = client.post(
        "/api/users",
        headers=_auth(admin_token),
        json={"username": "viewer1", "password": "Viewer123!", "role": "viewer"},
    )
    assert r.status_code == 201
    return _password_token(client, "viewer1", "Viewer123!")


_MYSQL_BODY = {
    "name": "prod-mysql",
    "dialect": "mysql",
    "host": "db.example.com",
    "port": 3306,
    "database": "analytics",
    "username": "reader",
    "password": "sk-secret-db-9999",
    "catalog_database_name": "analytics",
}


def test_dialect_catalog_lists_supported_databases(client):
    tok = _bootstrap_admin(client)
    r = client.get("/api/admin/database-connections", headers=_auth(tok["access_token"]))
    assert r.status_code == 200
    catalog_ids = {item["id"] for item in r.json()["catalog"]}
    assert catalog_ids == {"mysql", "postgresql", "presto", "trino", "sqlite"}


def test_non_admin_cannot_list_or_create(client):
    admin_tok = _bootstrap_admin(client)
    viewer_tok = _create_viewer(client, admin_tok["access_token"])

    listed = client.get("/api/admin/database-connections", headers=_auth(viewer_tok["access_token"]))
    assert listed.status_code == 403

    created = client.post(
        "/api/admin/database-connections", headers=_auth(viewer_tok["access_token"]), json=_MYSQL_BODY
    )
    assert created.status_code == 403


def test_create_masks_secrets_in_response(client):
    tok = _bootstrap_admin(client)
    r = client.post(
        "/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY
    )
    assert r.status_code == 201
    body = r.json()
    assert body["has_password"] is True
    assert "sk-secret-db-9999" not in str(body)
    assert body["is_active"] is False


def test_create_duplicate_name_rejected(client):
    tok = _bootstrap_admin(client)
    client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY)
    dup = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY)
    assert dup.status_code == 400


def test_update_preserves_password_when_omitted(client):
    tok = _bootstrap_admin(client)
    created = client.post(
        "/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY
    ).json()

    patched = client.patch(
        f"/api/admin/database-connections/{created['id']}",
        headers=_auth(tok["access_token"]),
        json={"database": "analytics_v2"},
    )
    assert patched.status_code == 200
    assert patched.json()["database"] == "analytics_v2"
    assert patched.json()["has_password"] is True

    sess = db.SessionLocal()
    try:
        from backend.llm.crypto import decrypt_api_key

        row = sess.get(DataWarehouseConnection, created["id"])
        assert decrypt_api_key(row.password_encrypted) == "sk-secret-db-9999"
    finally:
        sess.close()


def test_activate_sets_single_active_and_invalidates_graphs(client):
    from backend.llm.graph_cache import _graphs

    tok = _bootstrap_admin(client)
    a = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY).json()
    other_body = {**_MYSQL_BODY, "name": "staging-mysql"}
    b = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=other_body).json()

    _graphs["some-user:deepseek:abc"] = object()

    activated_a = client.post(
        f"/api/admin/database-connections/{a['id']}/activate", headers=_auth(tok["access_token"])
    )
    assert activated_a.status_code == 200
    assert activated_a.json()["is_active"] is True
    assert _graphs == {}

    _graphs["some-user:deepseek:abc"] = object()
    activated_b = client.post(
        f"/api/admin/database-connections/{b['id']}/activate", headers=_auth(tok["access_token"])
    )
    assert activated_b.status_code == 200

    listing = client.get("/api/admin/database-connections", headers=_auth(tok["access_token"])).json()
    active_flags = {row["id"]: row["is_active"] for row in listing["connections"]}
    assert active_flags[a["id"]] is False
    assert active_flags[b["id"]] is True
    assert listing["active_connection_id"] == b["id"]
    assert _graphs == {}


def test_cannot_delete_active_connection(client):
    tok = _bootstrap_admin(client)
    a = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY).json()
    client.post(f"/api/admin/database-connections/{a['id']}/activate", headers=_auth(tok["access_token"]))

    deleted = client.delete(f"/api/admin/database-connections/{a['id']}", headers=_auth(tok["access_token"]))
    assert deleted.status_code == 400


def test_delete_inactive_connection_succeeds(client):
    tok = _bootstrap_admin(client)
    a = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY).json()

    deleted = client.delete(f"/api/admin/database-connections/{a['id']}", headers=_auth(tok["access_token"]))
    assert deleted.status_code == 204

    listing = client.get("/api/admin/database-connections", headers=_auth(tok["access_token"])).json()
    assert listing["connections"] == []


def test_test_connection_endpoint_reports_success_for_sqlite(client):
    tok = _bootstrap_admin(client)
    body = {"name": "local-sqlite", "dialect": "sqlite", "database": ":memory:"}
    r = client.post("/api/admin/database-connections/test", headers=_auth(tok["access_token"]), json=body)
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_test_connection_endpoint_reports_failure(client):
    tok = _bootstrap_admin(client)
    body = {
        "name": "unreachable-mysql",
        "dialect": "mysql",
        "host": "127.0.0.1",
        "port": 1,
        "database": "nope",
        "username": "nobody",
        "password": "nopass",
    }
    r = client.post("/api/admin/database-connections/test", headers=_auth(tok["access_token"]), json=body)
    assert r.status_code == 200
    assert r.json()["ok"] is False
    assert r.json()["detail"]


def test_activate_applies_to_running_openchatbi_config(client):
    tok = _bootstrap_admin(client)
    a = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY).json()

    fake_catalog_store = MagicMock()
    fake_config = MagicMock()
    fake_config.catalog_store = fake_catalog_store

    with patch("openchatbi.config.get", return_value=fake_config):
        r = client.post(
            f"/api/admin/database-connections/{a['id']}/activate", headers=_auth(tok["access_token"])
        )
    assert r.status_code == 200
    fake_catalog_store.set_data_warehouse_config.assert_called_once()
    applied_config = fake_catalog_store.set_data_warehouse_config.call_args[0][0]
    assert applied_config["uri"].startswith("mysql+pymysql://reader:")
    assert fake_config.data_warehouse_config == applied_config
