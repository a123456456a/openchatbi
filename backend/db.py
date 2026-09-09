from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import get_settings


class Base(DeclarativeBase):
    pass


def _engine():
    url = get_settings().database_url
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


engine = _engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def reset_engine() -> None:
    global engine, SessionLocal
    engine.dispose()
    engine = _engine()
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_sqlite_schema(bind: Engine | None = None) -> None:
    """Add columns that create_all will not alter on an existing SQLite database."""
    target = bind if bind is not None else engine
    if target.dialect.name != "sqlite":
        return
    inspector = inspect(target)
    if "users" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("users")}
    if "active_llm_provider" in columns:
        return
    with target.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN active_llm_provider VARCHAR(64)"))
