"""Persistent LangGraph checkpointer for multi-worker / process-restart survival.

Default backend is SQLite (AsyncSqliteSaver). Postgres is selectable via
``CHECKPOINTER_BACKEND=postgres`` when ``langgraph-checkpoint-postgres`` is
installed; otherwise startup fails with a clear error.
"""

from __future__ import annotations

import asyncio
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

    raise ValueError(f"Unsupported CHECKPOINTER_BACKEND={backend!r}; use 'sqlite' or 'postgres'.")


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


# --- warehouse switch: clear LangGraph threads ---


def _list_thread_ids_sqlite_sql(db_path: str) -> set[str]:
    """Read distinct thread_ids from the Sqlite checkpoint file (no async loop)."""
    import sqlite3

    path = Path(db_path)
    if not path.exists():
        return set()
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=60)
    try:
        conn.execute("PRAGMA busy_timeout=60000")
        try:
            rows = conn.execute("SELECT DISTINCT thread_id FROM checkpoints").fetchall()
        except sqlite3.OperationalError as exc:
            if "no such table" in str(exc).lower():
                return set()
            raise
        return {str(row[0]) for row in rows if row and row[0]}
    finally:
        conn.close()


def _clear_sqlite_threads_via_sql(db_path: str) -> int:
    """Delete all checkpoint rows for every thread_id in the Sqlite DB.

    Used by sync warehouse activation so we do not bind the process-wide async
    checkpointer to a short-lived ``asyncio.run`` loop.
    """
    import sqlite3

    path = Path(db_path)
    if not path.exists():
        return 0
    conn = sqlite3.connect(str(path), timeout=60)
    try:
        conn.execute("PRAGMA busy_timeout=60000")
        try:
            row = conn.execute("SELECT COUNT(DISTINCT thread_id) FROM checkpoints").fetchone()
        except sqlite3.OperationalError as exc:
            if "no such table" in str(exc).lower():
                return 0
            raise
        count = int(row[0] if row else 0)
        if count:
            conn.execute("DELETE FROM writes")
            conn.execute("DELETE FROM checkpoints")
            conn.commit()
        return count
    finally:
        conn.close()


async def list_checkpoint_thread_ids() -> set[str]:
    """Return every distinct LangGraph ``thread_id`` in the shared checkpointer."""
    checkpointer = await get_async_checkpointer()
    conn = getattr(checkpointer, "conn", None)
    if conn is not None:
        try:
            async with conn.execute("SELECT DISTINCT thread_id FROM checkpoints") as cur:
                rows = await cur.fetchall()
            return {str(row[0]) for row in rows if row and row[0]}
        except Exception:  # noqa: BLE001
            logger.debug("DISTINCT thread_id query failed; falling back to alist", exc_info=True)

    thread_ids: set[str] = set()
    async for item in checkpointer.alist(None):
        configurable = (getattr(item, "config", None) or {}).get("configurable") or {}
        tid = configurable.get("thread_id")
        if tid:
            thread_ids.add(str(tid))
    return thread_ids


async def clear_all_checkpoint_threads() -> int:
    """Delete all LangGraph checkpoint threads via ``adelete_thread``.

    Strategy (multi-user / same warehouse): the active warehouse is
    **process-global**, so Text2SQL context in *any* user's thread can mix with
    the newly activated warehouse. ``thread_id`` is ``{user_id}-{session_id}``
    (plus ``:data_analysis`` children) and is **not** warehouse-scoped; we
    therefore clear **all** threads rather than prefix-filtering by user.
    """
    checkpointer = await get_async_checkpointer()
    thread_ids = await list_checkpoint_thread_ids()
    for thread_id in thread_ids:
        await checkpointer.adelete_thread(thread_id)
    if thread_ids:
        logger.info("Cleared %s LangGraph checkpoint thread(s)", len(thread_ids))
    return len(thread_ids)


def clear_all_checkpoint_threads_sync() -> int:
    """Sync entry point for warehouse activation (sync FastAPI routes).

    Sqlite (default): delete via a short-lived ``sqlite3`` connection so we do
    not create/bind the async checkpointer on an ephemeral loop.

    Postgres: schedule ``clear_all_checkpoint_threads`` on the existing
    checkpointer loop when available; otherwise ``asyncio.run``.
    """
    settings = _settings()
    backend = (settings.checkpointer_backend or "sqlite").strip().lower()
    if backend == "sqlite":
        return _clear_sqlite_threads_via_sql(settings.checkpointer_sqlite_path)

    existing = _async_checkpointer
    if existing is not None:
        loop = getattr(existing, "loop", None)
        if loop is not None and loop.is_running():
            return asyncio.run_coroutine_threadsafe(clear_all_checkpoint_threads(), loop).result(timeout=120)

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        try:
            return asyncio.run(clear_all_checkpoint_threads())
        finally:
            # Ephemeral loop would leave a dead cached saver; drop the cache.
            reset_async_checkpointer_for_tests()

    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, clear_all_checkpoint_threads()).result(timeout=120)
