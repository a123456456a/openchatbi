from backend import db
from backend.auth.models import User


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
