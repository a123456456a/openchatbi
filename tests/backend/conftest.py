import pytest

from backend.config import get_settings
from backend.db import reset_engine


@pytest.fixture(autouse=True)
def isolated_auth_db(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("AUTH_DATABASE_URL", f"sqlite:///{db_path}")
    get_settings.cache_clear()
    reset_engine()
    yield
    get_settings.cache_clear()
    reset_engine()
