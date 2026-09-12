import logging

from backend.llm.crypto import (
    _reset_fallback_warning_for_tests,
    decrypt_api_key,
    encrypt_api_key,
    mask_api_key,
)


def test_encrypt_decrypt_roundtrip(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-for-llm")
    monkeypatch.setenv("LLM_SETTINGS_SECRET", "llm-secret-32bytes-long!!!!!!")
    from backend.config import get_settings

    get_settings.cache_clear()
    token = encrypt_api_key("sk-live-abcdef1234")
    assert token != "sk-live-abcdef1234"
    assert decrypt_api_key(token) == "sk-live-abcdef1234"


def test_llm_settings_secret_survives_jwt_rotation(monkeypatch):
    """Rotating JWT_SECRET must not break keys encrypted with LLM_SETTINGS_SECRET."""
    monkeypatch.setenv("JWT_SECRET", "jwt-secret-before-rotation")
    monkeypatch.setenv("LLM_SETTINGS_SECRET", "dedicated-llm-settings-secret")
    from backend.config import get_settings

    get_settings.cache_clear()
    token = encrypt_api_key("sk-keep-after-jwt-rotate")

    monkeypatch.setenv("JWT_SECRET", "jwt-secret-after-rotation-different")
    get_settings.cache_clear()
    assert decrypt_api_key(token) == "sk-keep-after-jwt-rotate"


def test_fallback_to_jwt_secret_when_llm_settings_secret_unset(monkeypatch, caplog):
    monkeypatch.delenv("LLM_SETTINGS_SECRET", raising=False)
    monkeypatch.setenv("JWT_SECRET", "jwt-only-fallback-secret")
    from backend.config import get_settings

    get_settings.cache_clear()
    _reset_fallback_warning_for_tests()

    with caplog.at_level(logging.WARNING, logger="backend.llm.crypto"):
        token = encrypt_api_key("sk-legacy-fallback")
        assert decrypt_api_key(token) == "sk-legacy-fallback"

    assert any(
        "LLM_SETTINGS_SECRET is not set" in record.getMessage()
        and "falling back to JWT_SECRET" in record.getMessage()
        for record in caplog.records
    )


def test_blank_llm_settings_secret_falls_back_to_jwt(monkeypatch, caplog):
    monkeypatch.setenv("LLM_SETTINGS_SECRET", "   ")
    monkeypatch.setenv("JWT_SECRET", "jwt-used-when-blank")
    from backend.config import get_settings

    get_settings.cache_clear()
    _reset_fallback_warning_for_tests()

    with caplog.at_level(logging.WARNING, logger="backend.llm.crypto"):
        token = encrypt_api_key("sk-blank-secret")
        assert decrypt_api_key(token) == "sk-blank-secret"

    assert any("falling back to JWT_SECRET" in record.getMessage() for record in caplog.records)


def test_mask_keeps_last4():
    assert mask_api_key("sk-live-abcdef1234").endswith("1234")
    assert "sk-live" not in mask_api_key("sk-live-abcdef1234")
