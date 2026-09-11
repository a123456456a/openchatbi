import os

import pytest

from backend.config import get_settings
from backend.db import reset_engine

# Ensure backend test collection/teardown never trips production JWT refusal.
os.environ.setdefault("JWT_SECRET", "test-secret")


@pytest.fixture(autouse=True)
def isolated_auth_db(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("AUTH_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("JWT_SECRET", os.environ.get("JWT_SECRET", "test-secret"))
    # Existing chat tests mock the graph and do not activate a warehouse; allow demo
    # unless a test explicitly fail-closes with APP_ENV=production + ALLOW_DEMO_WAREHOUSE=false.
    monkeypatch.setenv("ALLOW_DEMO_WAREHOUSE", os.environ.get("ALLOW_DEMO_WAREHOUSE", "true"))
    get_settings.cache_clear()
    reset_engine()
    yield
    get_settings.cache_clear()
    reset_engine()
