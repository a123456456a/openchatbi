import base64
import hashlib

from cryptography.fernet import Fernet

from backend.config import get_settings


def _get_fernet() -> Fernet:
    settings = get_settings()
    secret = settings.llm_settings_secret or settings.jwt_secret
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def encrypt_api_key(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_api_key(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()


def mask_api_key(plain: str) -> str:
    if len(plain) <= 8:
        return "*" * len(plain)
    return "*" * (len(plain) - 4) + plain[-4:]
