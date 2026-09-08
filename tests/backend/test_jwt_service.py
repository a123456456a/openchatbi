import pytest
from backend.auth.jwt_service import create_access_token, decode_access_token


def test_access_token_roundtrip(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    from backend.config import get_settings

    get_settings.cache_clear()
    token = create_access_token("u1", "alice", "analyst")
    payload = decode_access_token(token)
    assert payload["sub"] == "u1"
    assert payload["role"] == "analyst"
    assert payload["typ"] == "access"
