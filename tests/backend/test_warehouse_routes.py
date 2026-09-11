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
    fake_catalog_store.get_data_warehouse_config.return_value = {}
    fake_config = MagicMock()
    fake_config.catalog_store = fake_catalog_store
    fake_config.data_warehouse_config = {}
    fake_config.dialect = "sqlite"

    with (
        patch("openchatbi.config.get", return_value=fake_config),
        patch(
            "openchatbi.catalog.catalog_loader.sync_catalog_from_data_warehouse", return_value=True
        ) as sync_mock,
        patch("openchatbi.catalog.catalog_loader.reload_catalog_indexes") as reload_mock,
    ):
        r = client.post(
            f"/api/admin/database-connections/{a['id']}/activate", headers=_auth(tok["access_token"])
        )
    assert r.status_code == 200
    body = r.json()
    assert body["runtime_apply"]["catalog_sync_status"] == "success"
    assert body["runtime_apply"]["index_reload_status"] == "success"
    fake_catalog_store.set_data_warehouse_config.assert_called_once()
    applied_config = fake_catalog_store.set_data_warehouse_config.call_args[0][0]
    assert applied_config["uri"].startswith("mysql+pymysql://reader:")
    assert fake_config.data_warehouse_config == applied_config
    assert fake_config.dialect == "mysql"
    sync_mock.assert_called_once_with(fake_catalog_store)
    reload_mock.assert_called_once_with(fake_catalog_store)


def test_activate_reports_catalog_sync_failure(client):
    tok = _bootstrap_admin(client)
    a = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY).json()

    previous_dw = {"uri": "sqlite:///previous.db", "include_tables": None}
    fake_catalog_store = MagicMock()
    fake_catalog_store.get_data_warehouse_config.return_value = dict(previous_dw)
    fake_config = MagicMock()
    fake_config.catalog_store = fake_catalog_store
    fake_config.data_warehouse_config = dict(previous_dw)
    fake_config.dialect = "sqlite"

    with (
        patch("openchatbi.config.get", return_value=fake_config),
        patch("openchatbi.catalog.catalog_loader.sync_catalog_from_data_warehouse", return_value=False),
        patch("openchatbi.catalog.catalog_loader.reload_catalog_indexes") as reload_mock,
    ):
        r = client.post(
            f"/api/admin/database-connections/{a['id']}/activate", headers=_auth(tok["access_token"])
        )
    assert r.status_code == 200
    body = r.json()
    # Sync failed after tentatively activating: roll back is_active and runtime URI.
    assert body["is_active"] is False
    apply_status = body["runtime_apply"]
    assert apply_status["catalog_sync_status"] == "failed"
    assert apply_status["index_reload_status"] == "skipped"
    assert apply_status["message"]
    assert "catalog schema sync failed" in apply_status["message"].lower()
    assert "rolled back" in apply_status["message"].lower()
    reload_mock.assert_not_called()
    # New URI was applied then previous warehouse config restored.
    assert fake_catalog_store.set_data_warehouse_config.call_count == 2
    restored = fake_catalog_store.set_data_warehouse_config.call_args_list[-1][0][0]
    assert restored["uri"] == previous_dw["uri"]
    assert fake_config.data_warehouse_config["uri"] == previous_dw["uri"]
    assert fake_config.dialect == "sqlite"

    listing = client.get("/api/admin/database-connections", headers=_auth(tok["access_token"])).json()
    assert listing["active_connection_id"] is None


def test_activate_reports_index_reload_failure(client):
    tok = _bootstrap_admin(client)
    a = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY).json()

    fake_catalog_store = MagicMock()
    fake_catalog_store.get_data_warehouse_config.return_value = {}
    fake_config = MagicMock()
    fake_config.catalog_store = fake_catalog_store
    fake_config.data_warehouse_config = {}
    fake_config.dialect = "sqlite"

    with (
        patch("openchatbi.config.get", return_value=fake_config),
        patch("openchatbi.catalog.catalog_loader.sync_catalog_from_data_warehouse", return_value=True),
        patch("openchatbi.catalog.catalog_loader.reload_catalog_indexes", side_effect=RuntimeError("index boom")),
    ):
        r = client.post(
            f"/api/admin/database-connections/{a['id']}/activate", headers=_auth(tok["access_token"])
        )
    assert r.status_code == 200
    apply_status = r.json()["runtime_apply"]
    assert apply_status["catalog_sync_status"] == "success"
    assert apply_status["index_reload_status"] == "failed"
    assert "index boom" in apply_status["message"]

def test_activate_sync_failure_restores_previous_active_and_runtime(client):
    """Failed sync must not leave Text2SQL on new-URI + old-catalog."""
    tok = _bootstrap_admin(client)
    a = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=_MYSQL_BODY).json()
    b_body = {
        **_MYSQL_BODY,
        "name": "staging-mysql",
        "host": "staging.example.com",
        "database": "staging",
    }
    b = client.post("/api/admin/database-connections", headers=_auth(tok["access_token"]), json=b_body).json()

    previous_dw = {"uri": "mysql+pymysql://reader:sk-secret-db-9999@db.example.com:3306/analytics"}
    fake_catalog_store = MagicMock()
    fake_catalog_store.get_data_warehouse_config.return_value = dict(previous_dw)
    fake_config = MagicMock()
    fake_config.catalog_store = fake_catalog_store
    fake_config.data_warehouse_config = dict(previous_dw)
    fake_config.dialect = "mysql"

    # First activation succeeds and becomes the live connection.
    with (
        patch("openchatbi.config.get", return_value=fake_config),
        patch("openchatbi.catalog.catalog_loader.sync_catalog_from_data_warehouse", return_value=True),
        patch("openchatbi.catalog.catalog_loader.reload_catalog_indexes"),
    ):
        r_a = client.post(
            f"/api/admin/database-connections/{a['id']}/activate", headers=_auth(tok["access_token"])
        )
    assert r_a.status_code == 200
    assert r_a.json()["is_active"] is True

    # After success, runtime points at A; capture that as the "previous" for B's attempt.
    a_applied = fake_catalog_store.set_data_warehouse_config.call_args[0][0]
    fake_catalog_store.get_data_warehouse_config.return_value = dict(a_applied)
    fake_config.data_warehouse_config = dict(a_applied)
    fake_config.dialect = "mysql"
    fake_catalog_store.set_data_warehouse_config.reset_mock()

    with (
        patch("openchatbi.config.get", return_value=fake_config),
        patch("openchatbi.catalog.catalog_loader.sync_catalog_from_data_warehouse", return_value=False),
        patch("openchatbi.catalog.catalog_loader.reload_catalog_indexes") as reload_mock,
    ):
        r_b = client.post(
            f"/api/admin/database-connections/{b['id']}/activate", headers=_auth(tok["access_token"])
        )
    assert r_b.status_code == 200
    body_b = r_b.json()
    assert body_b["id"] == b["id"]
    assert body_b["is_active"] is False
    assert body_b["runtime_apply"]["catalog_sync_status"] == "failed"
    assert "rolled back" in body_b["runtime_apply"]["message"].lower()
    reload_mock.assert_not_called()

    # Runtime must end on A's URI, not staging.
    restored = fake_catalog_store.set_data_warehouse_config.call_args_list[-1][0][0]
    assert "staging.example.com" not in restored["uri"]
    assert "db.example.com" in restored["uri"]
    assert fake_config.dialect == "mysql"
    assert "staging.example.com" not in fake_config.data_warehouse_config["uri"]

    listing = client.get("/api/admin/database-connections", headers=_auth(tok["access_token"])).json()
    active_flags = {row["id"]: row["is_active"] for row in listing["connections"]}
    assert active_flags[a["id"]] is True
    assert active_flags[b["id"]] is False
    assert listing["active_connection_id"] == a["id"]

