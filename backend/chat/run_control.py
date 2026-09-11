"""Server-side cancel for in-flight chat runs.

Combines an in-process ``asyncio.Event`` (same-worker fast path) with a shared
SQLite cancel ledger so multi-worker deployments on a shared filesystem can
observe cancels issued on another worker. Cancel always pairs with clearing the
LangGraph thread so the next user message starts a fresh turn.
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path

import aiosqlite

logger = logging.getLogger(__name__)

_local_events: dict[str, asyncio.Event] = {}
_local_lock = asyncio.Lock()
_db_ready = False


def _cancel_db_path() -> str:
    from backend.config import get_settings

    settings = get_settings()
    path = Path(settings.run_cancel_sqlite_path)
    if path.parent and str(path.parent) not in ("", "."):
        path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


async def _ensure_db() -> str:
    global _db_ready
    path = _cancel_db_path()
    if not _db_ready:
        async with aiosqlite.connect(path) as db:
            await db.execute("PRAGMA journal_mode=WAL")
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS run_cancels (
                    thread_id TEXT PRIMARY KEY,
                    created_at REAL NOT NULL
                )
                """
            )
            await db.commit()
        _db_ready = True
    return path


async def register_run(thread_id: str) -> asyncio.Event:
    """Register an in-flight run; clears any stale cancel flag for this thread."""
    event = asyncio.Event()
    async with _local_lock:
        old = _local_events.get(thread_id)
        if old is not None:
            old.set()
        _local_events[thread_id] = event
    path = await _ensure_db()
    async with aiosqlite.connect(path) as db:
        await db.execute("DELETE FROM run_cancels WHERE thread_id = ?", (thread_id,))
        await db.commit()
    return event


async def unregister_run(thread_id: str, event: asyncio.Event | None = None) -> None:
    async with _local_lock:
        current = _local_events.get(thread_id)
        if event is None or current is event:
            _local_events.pop(thread_id, None)


async def request_cancel(thread_id: str) -> bool:
    """Signal cancel for ``thread_id``. Returns True if a local run was live."""
    path = await _ensure_db()
    async with aiosqlite.connect(path) as db:
        await db.execute(
            "INSERT OR REPLACE INTO run_cancels(thread_id, created_at) VALUES (?, ?)",
            (thread_id, time.time()),
        )
        await db.commit()

    async with _local_lock:
        event = _local_events.get(thread_id)
        if event is not None:
            event.set()
            return True
    return False


async def is_cancel_requested(thread_id: str) -> bool:
    async with _local_lock:
        event = _local_events.get(thread_id)
        if event is not None and event.is_set():
            return True
    path = await _ensure_db()
    async with aiosqlite.connect(path) as db:
        async with db.execute(
            "SELECT 1 FROM run_cancels WHERE thread_id = ? LIMIT 1", (thread_id,)
        ) as cur:
            row = await cur.fetchone()
            return row is not None


async def clear_cancel(thread_id: str) -> None:
    path = await _ensure_db()
    async with aiosqlite.connect(path) as db:
        await db.execute("DELETE FROM run_cancels WHERE thread_id = ?", (thread_id,))
        await db.commit()


def reset_run_control_for_tests() -> None:
    global _db_ready
    _local_events.clear()
    _db_ready = False
