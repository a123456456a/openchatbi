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
    monkeypatch.setenv("CHECKPOINTER_BACKEND", "sqlite")
    monkeypatch.setenv("CHECKPOINTER_SQLITE_PATH", str(tmp_path / "checkpoints.db"))
    monkeypatch.setenv("RUN_CANCEL_SQLITE_PATH", str(tmp_path / "run_cancels.db"))
    get_settings.cache_clear()
    reset_engine()
    from backend.chat.run_control import reset_run_control_for_tests
    from backend.llm.checkpointer import reset_async_checkpointer_for_tests

    reset_run_control_for_tests()
    reset_async_checkpointer_for_tests()
    yield
    reset_run_control_for_tests()
    reset_async_checkpointer_for_tests()
    get_settings.cache_clear()
    reset_engine()
