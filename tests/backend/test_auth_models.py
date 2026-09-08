from datetime import datetime, timezone

from backend import db
from backend.auth.models import RefreshToken, User


def test_create_user_row():
    db.Base.metadata.create_all(bind=db.engine)
    session = db.SessionLocal()
    try:
        u = User(username="alice", password_hash="x", role="analyst")
        session.add(u)
        session.commit()
        session.refresh(u)
        assert u.id
        assert u.role == "analyst"
        assert u.is_active is True
    finally:
        session.close()


def test_refresh_token_user_relationship():
    db.Base.metadata.create_all(bind=db.engine)
    session = db.SessionLocal()
    try:
        user = User(username="bob", password_hash="x", role="viewer")
        session.add(user)
        session.flush()

        now = datetime.now(timezone.utc)
        token = RefreshToken(
            user_id=user.id,
            token_hash="abc123hash",
            expires_at=now,
            revoked_at=now,
        )
        session.add(token)
        session.commit()
        session.refresh(user)
        session.refresh(token)

        assert token.user is user
        assert token.user_id == user.id
        assert token.revoked_at is not None
        assert user.refresh_tokens == [token]
    finally:
        session.close()
