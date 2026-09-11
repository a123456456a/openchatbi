"""Production-safety defaults: reject insecure JWT unless explicitly exempted."""

import os

import pytest

from backend.config import (
    Settings,
    demo_warehouse_allowed,
    get_settings,
    insecure_defaults_allowed,
    is_insecure_jwt_secret,
)


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_default_jwt_secret_is_recognized_as_insecure():
    assert is_insecure_jwt_secret("dev-only-change-me")
    assert is_insecure_jwt_secret("")
    assert is_insecure_jwt_secret("  secret  ")
    assert not is_insecure_jwt_secret("a-sufficiently-long-random-secret")


def test_default_jwt_rejected_without_exemption(monkeypatch):
    monkeypatch.delenv("OPENCHATBI_TEST_MODE", raising=False)
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_INSECURE_DEFAULTS", "false")

    with pytest.raises(ValueError, match="insecure/default JWT_SECRET"):
        Settings()

    # Restore a safe secret before other fixture teardowns call get_settings().
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("OPENCHATBI_TEST_MODE", "true")


def test_strong_jwt_allowed_in_production(monkeypatch):
    monkeypatch.delenv("OPENCHATBI_TEST_MODE", raising=False)
    monkeypatch.setenv("JWT_SECRET", "prod-grade-secret-value-9f3a")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_INSECURE_DEFAULTS", "false")

    settings = Settings()
    assert settings.jwt_secret == "prod-grade-secret-value-9f3a"

    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("OPENCHATBI_TEST_MODE", "true")


def test_allow_insecure_defaults_permits_demo_secret(monkeypatch):
    monkeypatch.delenv("OPENCHATBI_TEST_MODE", raising=False)
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_INSECURE_DEFAULTS", "true")

    settings = Settings()
    assert settings.jwt_secret == "dev-only-change-me"
    assert settings.allow_insecure_defaults is True

    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("OPENCHATBI_TEST_MODE", "true")


@pytest.mark.parametrize("app_env", ["development", "dev", "local", "test"])
def test_app_env_development_permits_demo_secret(monkeypatch, app_env):
    monkeypatch.delenv("OPENCHATBI_TEST_MODE", raising=False)
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    monkeypatch.setenv("ALLOW_INSECURE_DEFAULTS", "false")
    monkeypatch.setenv("APP_ENV", app_env)

    settings = Settings()
    assert settings.app_env == app_env

    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("OPENCHATBI_TEST_MODE", "true")


def test_get_settings_respects_exemption(monkeypatch):
    monkeypatch.delenv("OPENCHATBI_TEST_MODE", raising=False)
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    monkeypatch.setenv("ALLOW_INSECURE_DEFAULTS", "true")
    monkeypatch.setenv("APP_ENV", "production")

    settings = get_settings()
    assert settings.jwt_secret == "dev-only-change-me"

    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("OPENCHATBI_TEST_MODE", "true")


def test_insecure_defaults_allowed_helper():
    assert insecure_defaults_allowed(True, "production")
    assert insecure_defaults_allowed(False, "development")
    assert insecure_defaults_allowed(False, "dev")
    assert not insecure_defaults_allowed(False, "production")


def test_openchatbi_test_mode_permits_demo_secret(monkeypatch):
    monkeypatch.setenv("OPENCHATBI_TEST_MODE", "true")
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_INSECURE_DEFAULTS", "false")

    settings = Settings()
    assert settings.jwt_secret == "dev-only-change-me"


def test_demo_warehouse_allowed_helper():
    assert demo_warehouse_allowed(True, "production")
    assert demo_warehouse_allowed(False, "development")
    assert not demo_warehouse_allowed(False, "production")


def test_allow_demo_warehouse_setting(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "prod-grade-secret-value-9f3a")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_INSECURE_DEFAULTS", "false")
    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", "true")
    monkeypatch.delenv("OPENCHATBI_TEST_MODE", raising=False)

    settings = Settings()
    assert settings.allow_demo_warehouse is True
    assert demo_warehouse_allowed(settings.allow_demo_warehouse, settings.app_env)

    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("OPENCHATBI_TEST_MODE", "true")
