import pytest
from fastapi.testclient import TestClient

from backend.app import app
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


def test_bootstrap_then_password_grant(client):
    r = client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    assert r.status_code == 201
    r2 = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": "admin", "password": "Admin123!"},
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["role"] == "admin"
    assert body["user_id"]
    assert body["expires_in"] > 0


def test_refresh_and_revoke(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": "admin", "password": "Admin123!"},
    ).json()
    refreshed = client.post(
        "/oauth/token",
        json={"grant_type": "refresh_token", "refresh_token": tok["refresh_token"]},
    )
    assert refreshed.status_code == 200
    body = refreshed.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["refresh_token"] != tok["refresh_token"]

    rev = client.post(
        "/oauth/revoke",
        headers={"Authorization": f"Bearer {body['access_token']}"},
        json={"refresh_token": body["refresh_token"]},
    )
    assert rev.status_code == 204

    # revoked refresh cannot be reused
    again = client.post(
        "/oauth/token",
        json={"grant_type": "refresh_token", "refresh_token": body["refresh_token"]},
    )
    assert again.status_code == 401


def test_bootstrap_only_once(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    r = client.post("/api/auth/bootstrap", json={"username": "other", "password": "x"})
    assert r.status_code == 409


def test_password_grant_wrong_password(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    r = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": "admin", "password": "wrong"},
    )
    assert r.status_code == 401


def test_userinfo(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": "admin", "password": "Admin123!"},
    ).json()
    r = client.get(
        "/oauth/userinfo",
        headers={"Authorization": f"Bearer {tok['access_token']}"},
    )
    assert r.status_code == 200
    info = r.json()
    assert info["username"] == "admin"
    assert info["role"] == "admin"
    assert info["user_id"] == tok["user_id"]
