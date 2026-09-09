from backend.llm.crypto import decrypt_api_key, encrypt_api_key, mask_api_key


def test_encrypt_decrypt_roundtrip(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-for-llm")
    monkeypatch.setenv("LLM_SETTINGS_SECRET", "llm-secret-32bytes-long!!!!!!")
    from backend.config import get_settings

    get_settings.cache_clear()
    # force crypto module to rebuild key if cached
    token = encrypt_api_key("sk-live-abcdef1234")
    assert token != "sk-live-abcdef1234"
    assert decrypt_api_key(token) == "sk-live-abcdef1234"


def test_mask_keeps_last4():
    assert mask_api_key("sk-live-abcdef1234").endswith("1234")
    assert "sk-live" not in mask_api_key("sk-live-abcdef1234")
