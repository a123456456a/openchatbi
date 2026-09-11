"""Persistent LangGraph checkpointer for multi-worker / process-restart survival.

Default backend is SQLite (AsyncSqliteSaver). Postgres is selectable via
``CHECKPOINTER_BACKEND=postgres`` when ``langgraph-checkpoint-postgres`` is
installed; otherwise startup fails with a clear error.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_async_checkpointer: Any | None = None
_async_cm: Any | None = None


def _settings():
    from backend.config import get_settings

    return get_settings()


def _ensure_parent_dir(path: str) -> str:
    p = Path(path)
    if p.parent and str(p.parent) not in ("", "."):
        p.parent.mkdir(parents=True, exist_ok=True)
    return str(p)


async def get_async_checkpointer() -> Any:
    """Return the process-wide async checkpointer (created once, shared by graphs)."""
    global _async_checkpointer, _async_cm
    if _async_checkpointer is not None:
        return _async_checkpointer

    settings = _settings()
    backend = (settings.checkpointer_backend or "sqlite").strip().lower()

    if backend == "sqlite":
        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

        db_path = _ensure_parent_dir(settings.checkpointer_sqlite_path)
        _async_cm = AsyncSqliteSaver.from_conn_string(db_path)
        _async_checkpointer = await _async_cm.__aenter__()
        await _async_checkpointer.setup()
        logger.info("LangGraph checkpointer: sqlite at %s", db_path)
        return _async_checkpointer

    if backend in {"postgres", "postgresql"}:
        url = settings.checkpointer_postgres_url
        if not url:
            raise ValueError(
                "CHECKPOINTER_BACKEND=postgres requires CHECKPOINTER_POSTGRES_URL "
                "(e.g. postgresql://user:pass@host:5432/dbname)."
            )
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        except ImportError as exc:  # pragma: no cover - optional extra
            raise ImportError(
                "Postgres checkpointer requires langgraph-checkpoint-postgres. "
                "Install it or set CHECKPOINTER_BACKEND=sqlite."
            ) from exc
        _async_cm = AsyncPostgresSaver.from_conn_string(url)
        _async_checkpointer = await _async_cm.__aenter__()
        await _async_checkpointer.setup()
        logger.info("LangGraph checkpointer: postgres")
        return _async_checkpointer

    raise ValueError(
        f"Unsupported CHECKPOINTER_BACKEND={backend!r}; use 'sqlite' or 'postgres'."
    )


async def cleanup_async_checkpointer() -> None:
    """Release the async checkpointer connection (app shutdown)."""
    global _async_checkpointer, _async_cm
    if _async_cm is not None:
        try:
            await _async_cm.__aexit__(None, None, None)
        except Exception as exc:  # pragma: no cover
            logger.warning("Error cleaning up checkpointer: %s", exc)
        finally:
            _async_checkpointer = None
            _async_cm = None


def reset_async_checkpointer_for_tests() -> None:
    """Drop cached checkpointer without awaiting cleanup (test isolation)."""
    global _async_checkpointer, _async_cm
    _async_checkpointer = None
    _async_cm = None
