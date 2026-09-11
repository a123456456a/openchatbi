import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.auth.models import Role, User
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


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_viewer_cannot_create_user(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    _create_user("viewer1", "Viewer123!", Role.viewer.value)
    viewer_tok = _password_token(client, "viewer1", "Viewer123!")

    r = client.post(
        "/api/users",
        headers=_auth(viewer_tok["access_token"]),
        json={"username": "newbie", "password": "Pass123!", "role": "viewer"},
    )
    assert r.status_code == 403


def test_admin_can_create_user(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    admin_tok = _password_token(client, "admin", "Admin123!")

    r = client.post(
        "/api/users",
        headers=_auth(admin_tok["access_token"]),
        json={"username": "newbie", "password": "Pass123!", "role": "analyst"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["username"] == "newbie"
    assert body["role"] == "analyst"
    assert body["is_active"] is True
    assert "id" in body
    assert "password" not in body
    assert "password_hash" not in body


def test_admin_list_and_patch_user(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    admin_tok = _password_token(client, "admin", "Admin123!")
    headers = _auth(admin_tok["access_token"])

    created = client.post(
        "/api/users",
        headers=headers,
        json={"username": "analyst1", "password": "Pass123!", "role": "analyst"},
    ).json()

    listed = client.get("/api/users", headers=headers)
    assert listed.status_code == 200
    usernames = {u["username"] for u in listed.json()}
    assert "admin" in usernames
    assert "analyst1" in usernames

    patched = client.patch(
        f"/api/users/{created['id']}",
        headers=headers,
        json={"role": "viewer", "is_active": False},
    )
    assert patched.status_code == 200
    assert patched.json()["role"] == "viewer"
    assert patched.json()["is_active"] is False


def test_report_download_requires_analyst_or_admin(client, monkeypatch):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    _create_user("viewer1", "Viewer123!", Role.viewer.value)
    _create_user("analyst1", "Analyst123!", Role.analyst.value)

    viewer_tok = _password_token(client, "viewer1", "Viewer123!")
    analyst_tok = _password_token(client, "analyst1", "Analyst123!")
    admin_tok = _password_token(client, "admin", "Admin123!")

    from fastapi.responses import PlainTextResponse

    monkeypatch.setattr(
        "backend.users.routes.get_report_download_response",
        lambda filename, user_id=None: PlainTextResponse(f"ok:{filename}:{user_id}"),
    )

    forbidden = client.get(
        "/api/download/report/demo.md",
        headers=_auth(viewer_tok["access_token"]),
    )
    assert forbidden.status_code == 403

    for tok in (analyst_tok, admin_tok):
        allowed = client.get(
            "/api/download/report/demo.md",
            headers=_auth(tok["access_token"]),
        )
        assert allowed.status_code == 200
        assert allowed.text.startswith("ok:demo.md:")


def test_report_download_owner_allowed_cross_user_denied(client, tmp_path, monkeypatch):
    """Owner can download; other users (including admin) cannot — no admin bypass."""
    report_root = tmp_path / "reports"

    monkeypatch.setattr(
        "openchatbi.config.get",
        lambda: type("Cfg", (), {"report_directory": str(report_root)})(),
    )

    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    owner_id = _create_user("owner1", "Owner123!", Role.analyst.value)
    _create_user("other1", "Other123!", Role.analyst.value)

    owner_dir = report_root / owner_id
    owner_dir.mkdir(parents=True)
    report_file = owner_dir / "secret.md"
    report_file.write_text("owner-secret", encoding="utf-8")

    owner_tok = _password_token(client, "owner1", "Owner123!")
    other_tok = _password_token(client, "other1", "Other123!")
    admin_tok = _password_token(client, "admin", "Admin123!")

    allowed = client.get(
        "/api/download/report/secret.md",
        headers=_auth(owner_tok["access_token"]),
    )
    assert allowed.status_code == 200
    assert allowed.content == b"owner-secret"

    # Non-owner analyst → 404 (do not leak existence)
    denied_other = client.get(
        "/api/download/report/secret.md",
        headers=_auth(other_tok["access_token"]),
    )
    assert denied_other.status_code == 404

    # Admin must NOT bypass ownership by default
    denied_admin = client.get(
        "/api/download/report/secret.md",
        headers=_auth(admin_tok["access_token"]),
    )
    assert denied_admin.status_code == 404


def test_report_download_rejects_path_traversal(client, tmp_path, monkeypatch):
    report_root = tmp_path / "reports"
    monkeypatch.setattr(
        "openchatbi.config.get",
        lambda: type("Cfg", (), {"report_directory": str(report_root)})(),
    )

    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    owner_id = _create_user("owner2", "Owner123!", Role.analyst.value)
    owner_dir = report_root / owner_id
    owner_dir.mkdir(parents=True)
    (owner_dir / "ok.md").write_text("ok", encoding="utf-8")

    # Plant a file outside the user dir that traversal might try to reach
    (report_root / "escaped.md").write_text("nope", encoding="utf-8")

    owner_tok = _password_token(client, "owner2", "Owner123!")
    r = client.get(
        "/api/download/report/../escaped.md",
        headers=_auth(owner_tok["access_token"]),
    )
    assert r.status_code in (400, 404)
