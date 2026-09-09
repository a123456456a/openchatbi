import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.config import get_settings
from backend.db import Base, reset_engine
import backend.db as db


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("AUTH_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    get_settings.cache_clear()
    reset_engine()
    Base.metadata.drop_all(bind=db.engine)
    Base.metadata.create_all(bind=db.engine)
    return TestClient(app)


def test_user_llm_config_roundtrip(client):
    from backend.auth.models import User, UserLlmConfig
    from backend.auth.passwords import hash_password

    sess = db.SessionLocal()
    try:
        u = User(username="u1", password_hash=hash_password("Pass123!"), role="viewer")
        sess.add(u)
        sess.commit()
        sess.refresh(u)
        row = UserLlmConfig(
            user_id=u.id,
            provider="deepseek",
            api_key_encrypted="enc",
            model="deepseek-chat",
            base_url=None,
        )
        sess.add(row)
        u.active_llm_provider = "deepseek"
        sess.commit()
        sess.refresh(u)
        assert u.active_llm_provider == "deepseek"
        assert sess.query(UserLlmConfig).filter_by(user_id=u.id).count() == 1
    finally:
        sess.close()
