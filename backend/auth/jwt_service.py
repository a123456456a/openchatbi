import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from backend.config import get_settings


def create_access_token(user_id: str, username: str, role: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_minutes),
        "jti": secrets.token_urlsafe(8),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    s = get_settings()
    payload = jwt.decode(token, s.jwt_secret, algorithms=["HS256"])
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("not an access token")
    return payload


def create_refresh_token_value() -> str:
    return secrets.token_urlsafe(48)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
