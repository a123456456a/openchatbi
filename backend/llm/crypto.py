import base64
import hashlib
import logging

from cryptography.fernet import Fernet

from backend.config import get_settings

logger = logging.getLogger(__name__)

_fallback_warned = False


def _reset_fallback_warning_for_tests() -> None:
    """Test helper: allow asserting the fallback warning again."""
    global _fallback_warned
    _fallback_warned = False


def _resolve_encryption_secret() -> str:
    """Prefer LLM_SETTINGS_SECRET so JWT rotation does not break stored keys.

    When ``LLM_SETTINGS_SECRET`` is unset/blank, fall back to ``JWT_SECRET``
    (legacy behavior) and emit a one-time warning.
    """
    global _fallback_warned
    settings = get_settings()
    dedicated = (settings.llm_settings_secret or "").strip()
    if dedicated:
        return dedicated

    if not _fallback_warned:
        logger.warning(
            "LLM_SETTINGS_SECRET is not set; falling back to JWT_SECRET for "
            "Fernet encryption of stored LLM API keys and warehouse credentials. "
            "Set a dedicated LLM_SETTINGS_SECRET so rotating JWT_SECRET does not "
            "make previously encrypted values undecryptable."
        )
        _fallback_warned = True
    return settings.jwt_secret


def _get_fernet() -> Fernet:
    secret = _resolve_encryption_secret()
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
