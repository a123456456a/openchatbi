"""Per-user agent graph cache keyed by user, provider, and config hash."""

from __future__ import annotations

import asyncio
import threading
from typing import Any

from langgraph.checkpoint.memory import MemorySaver

from openchatbi import config
from openchatbi.agent_graph import build_agent_graph_async
from openchatbi.llm.llm import reset_llm_override, set_llm_override
from openchatbi.tool.memory import get_async_memory_store

_graphs: dict[str, Any] = {}
_graphs_lock = threading.Lock()
_graphs_build_lock = asyncio.Lock()
# Shared across compiled graphs; sessions are isolated by thread_id in run config.
_checkpointer = MemorySaver()


def graph_cache_key(user_id: str, provider: str, config_hash: str) -> str:
    return f"{user_id}:{provider}:{config_hash}"


def _get_cached(key: str) -> Any | None:
    with _graphs_lock:
        return _graphs.get(key)


def _set_cached(key: str, graph: Any) -> Any:
    with _graphs_lock:
        _graphs[key] = graph
        return graph


async def get_or_build_graph(user_id: str, provider: str, llm, config_hash: str):
    """Get a cached graph or build one under the user's LLM override."""
    key = graph_cache_key(user_id, provider, config_hash)
    cached = _get_cached(key)
    if cached is not None:
        return cached
    async with _graphs_build_lock:
        cached = _get_cached(key)
        if cached is not None:
            return cached
        token = set_llm_override(llm)
        try:
            graph = await build_agent_graph_async(
                config.get().catalog_store,
                checkpointer=_checkpointer,
                memory_store=await get_async_memory_store(),
                llm_provider=None,
            )
        finally:
            reset_llm_override(token)
        return _set_cached(key, graph)


def invalidate_graphs_for_user(user_id: str) -> None:
    prefix = f"{user_id}:"
    with _graphs_lock:
        for key in [cached_key for cached_key in _graphs if cached_key.startswith(prefix)]:
            del _graphs[key]
