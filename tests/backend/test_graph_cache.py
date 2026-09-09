"""Graph cache get/set/invalidate is serialized with a shared threading lock."""

import asyncio
import threading
from unittest.mock import AsyncMock, MagicMock, patch

from backend.llm.graph_cache import (
    _graphs,
    _graphs_lock,
    get_or_build_graph,
    graph_cache_key,
    invalidate_graphs_for_user,
)


def test_invalidate_graphs_for_user_is_selective():
    _graphs.clear()
    try:
        _graphs["u1:deepseek:deadbeefdeadbeef"] = object()
        _graphs["u2:deepseek:deadbeefdeadbeef"] = object()
        invalidate_graphs_for_user("u1")
        assert "u1:deepseek:deadbeefdeadbeef" not in _graphs
        assert "u2:deepseek:deadbeefdeadbeef" in _graphs
    finally:
        _graphs.clear()


def test_get_or_build_survives_concurrent_invalidate():
    user_id = "u-race"
    provider = "deepseek"
    config_hash = "0123456789abcdef"
    key = graph_cache_key(user_id, provider, config_hash)
    sentinel = object()
    errors: list[BaseException] = []
    ready = threading.Event()
    stop = threading.Event()

    def invalidator() -> None:
        ready.wait(timeout=2)
        while not stop.is_set():
            invalidate_graphs_for_user(user_id)

    async def reader() -> None:
        with _graphs_lock:
            _graphs[key] = sentinel
        ready.set()
        with patch(
            "backend.llm.graph_cache.build_agent_graph_async",
            new=AsyncMock(return_value=sentinel),
        ):
            for _ in range(200):
                got = await get_or_build_graph(user_id, provider, MagicMock(), config_hash)
                assert got is sentinel

    worker = threading.Thread(target=invalidator)
    worker.start()
    try:
        asyncio.run(reader())
    except BaseException as exc:
        errors.append(exc)
    finally:
        stop.set()
        worker.join(timeout=2)
        _graphs.clear()

    assert not errors
