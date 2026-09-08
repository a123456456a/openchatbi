import pytest
from fastapi import Depends
from fastapi.testclient import TestClient

from backend.app import app
from backend.auth.models import Role, User
from backend.auth.passwords import hash_password
from backend.config import get_settings
from backend.db import Base, reset_engine
import backend.db as db

_PROBE_PATH = "/__probe/admin-only"
_probe_registered = False


def _ensure_admin_probe() -> None:
    global _probe_registered
    if _probe_registered:
        return
    from backend.auth.deps import require_roles

    @app.get(_PROBE_PATH)
    def _admin_probe(_user: User = Depends(require_roles("admin"))):
        return {"ok": True}

    _probe_registered = True


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("AUTH_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    get_settings.cache_clear()
    reset_engine()
    Base.metadata.drop_all(bind=db.engine)
    Base.metadata.create_all(bind=db.engine)
    _ensure_admin_probe()
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


def test_userinfo_without_token_returns_401(client):
    r = client.get("/oauth/userinfo")
    assert r.status_code == 401


def test_require_roles_viewer_forbidden_admin_ok(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    _create_user("viewer1", "Viewer123!", Role.viewer.value)

    admin_tok = _password_token(client, "admin", "Admin123!")
    viewer_tok = _password_token(client, "viewer1", "Viewer123!")

    forbidden = client.get(
        _PROBE_PATH,
        headers={"Authorization": f"Bearer {viewer_tok['access_token']}"},
    )
    assert forbidden.status_code == 403

    allowed = client.get(
        _PROBE_PATH,
        headers={"Authorization": f"Bearer {admin_tok['access_token']}"},
    )
    assert allowed.status_code == 200
    assert allowed.json()["ok"] is True


def test_revoke_rejects_other_users_refresh_token(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    _create_user("viewer1", "Viewer123!", Role.viewer.value)

    admin_tok = _password_token(client, "admin", "Admin123!")
    viewer_tok = _password_token(client, "viewer1", "Viewer123!")

    rev = client.post(
        "/oauth/revoke",
        headers={"Authorization": f"Bearer {viewer_tok['access_token']}"},
        json={"refresh_token": admin_tok["refresh_token"]},
    )
    assert rev.status_code == 403

    # victim refresh still usable
    refreshed = client.post(
        "/oauth/token",
        json={"grant_type": "refresh_token", "refresh_token": admin_tok["refresh_token"]},
    )
    assert refreshed.status_code == 200


def test_inactive_user_token_rejected(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    user_id = _create_user("inactive1", "Pass123!", Role.viewer.value)
    tok = _password_token(client, "inactive1", "Pass123!")

    sess = db.SessionLocal()
    try:
        user = sess.get(User, user_id)
        user.is_active = False
        sess.commit()
    finally:
        sess.close()

    r = client.get(
        "/oauth/userinfo",
        headers={"Authorization": f"Bearer {tok['access_token']}"},
    )
    assert r.status_code == 401
