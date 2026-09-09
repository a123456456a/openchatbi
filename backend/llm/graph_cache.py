"""Per-user agent graph cache keyed by user, provider, and config hash."""

from __future__ import annotations

import asyncio
from typing import Any

from openchatbi import config
from openchatbi.agent_graph import build_agent_graph_async
from openchatbi.llm.llm import reset_llm_override, set_llm_override

_graphs: dict[str, Any] = {}
_graphs_lock = asyncio.Lock()


def graph_cache_key(user_id: str, provider: str, config_hash: str) -> str:
    return f"{user_id}:{provider}:{config_hash}"


async def get_or_build_graph(user_id: str, provider: str, llm, config_hash: str):
    """Get a cached graph or build one under the user's LLM override."""
    key = graph_cache_key(user_id, provider, config_hash)
    if key in _graphs:
        return _graphs[key]
    async with _graphs_lock:
        if key in _graphs:
            return _graphs[key]
        token = set_llm_override(llm)
        try:
            _graphs[key] = await build_agent_graph_async(
                config.get().catalog_store, llm_provider=None
            )
        finally:
            reset_llm_override(token)
        return _graphs[key]


def invalidate_graphs_for_user(user_id: str) -> None:
    prefix = f"{user_id}:"
    for key in list(_graphs):
        if key.startswith(prefix):
            del _graphs[key]
