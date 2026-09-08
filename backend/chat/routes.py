"""JWT-protected chat stream and current-user memories."""

from __future__ import annotations

import asyncio
import dataclasses
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from backend.auth.deps import get_current_user
from backend.auth.models import User
from backend.chat.schemas import ChatStreamRequest
from openchatbi import config
from openchatbi.agent_graph import build_agent_graph_async
from openchatbi.observability.tracing import build_run_config
from openchatbi.streaming import (
    AgentStreamProcessor,
    StreamInterrupt,
    StreamStep,
    StreamToken,
    StreamUsage,
    extract_final_answer,
)
from openchatbi.tool.memory import get_async_memory_store

chat_router = APIRouter(prefix="/api", tags=["chat"])

_graphs: dict[str, Any] = {}
_graphs_lock = asyncio.Lock()


async def get_or_build_graph(provider: str | None):
    """Get (or lazily build) a graph for the requested provider."""
    key = provider or "__default__"
    if key in _graphs:
        return _graphs[key]
    async with _graphs_lock:
        if key in _graphs:
            return _graphs[key]
        _graphs[key] = await build_agent_graph_async(config.get().catalog_store, llm_provider=provider)
        return _graphs[key]


def _event_to_dict(event) -> dict[str, Any]:
    if isinstance(event, StreamStep):
        return {
            "type": "step",
            "kind": event.kind,
            "level": event.level,
            "label": event.label,
            "text": event.text,
            "data": _json_safe(event.data),
        }
    if isinstance(event, StreamToken):
        return {
            "type": "token",
            "level": event.level,
            "label": event.label,
            "is_final": event.is_final,
            "text": event.text,
        }
    if isinstance(event, StreamInterrupt):
        return {"type": "interrupt", "text": event.text, "buttons": _json_safe(event.buttons)}
    if isinstance(event, StreamUsage):
        return {
            "type": "usage",
            "turn_tokens": event.turn_tokens,
            "turn_cost_usd": event.turn_cost_usd,
            "by_model": event.by_model,
        }
    return {"type": "unknown"}


def _json_safe(obj: Any) -> Any:
    try:
        json.dumps(obj)
        return obj
    except TypeError:
        if dataclasses.is_dataclass(obj):
            return dataclasses.asdict(obj)
        return str(obj)


@chat_router.post("/chat/stream")
async def chat_stream(
    req: ChatStreamRequest,
    current_user: User = Depends(get_current_user),
):
    """Stream agent responses as NDJSON (or legacy plain text).

    ``user_id`` is always taken from the authenticated JWT subject.
    """
    user_id = current_user.id
    session_id = req.session_id or "default"
    stream_input = {"messages": [("user", req.input)]}
    run_config = build_run_config(user_id=user_id, session_id=session_id)

    try:
        graph = await get_or_build_graph(req.provider)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    async def text_generator():
        processor = AgentStreamProcessor()
        async for namespace, event_type, event_value in graph.astream(
            stream_input, config=run_config, stream_mode=["updates", "messages"], subgraphs=True
        ):
            for event in processor.process(namespace, event_type, event_value):
                if isinstance(event, StreamToken) and event.is_final and event.text:
                    yield event.text

    async def event_generator():
        processor = AgentStreamProcessor()
        async for namespace, event_type, event_value in graph.astream(
            stream_input, config=run_config, stream_mode=["updates", "messages"], subgraphs=True
        ):
            for event in processor.process(namespace, event_type, event_value):
                yield json.dumps(_event_to_dict(event), ensure_ascii=False) + "\n"

        usage = processor.emit_turn_usage()
        if usage is not None:
            yield json.dumps(_event_to_dict(usage), ensure_ascii=False) + "\n"

        state = await graph.aget_state(run_config)
        if state.interrupts:
            value = state.interrupts[0].value or {}
            interrupt = StreamInterrupt(text=value.get("text", ""), buttons=value.get("buttons", []) or [])
            yield json.dumps(_event_to_dict(interrupt), ensure_ascii=False) + "\n"
        else:
            final = extract_final_answer(processor.final_response)
            yield json.dumps({"type": "final_answer", "text": final}, ensure_ascii=False) + "\n"

    if (req.mode or "events") == "text":
        return StreamingResponse(text_generator(), media_type="text/plain")
    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


@chat_router.get("/me/memories")
async def get_my_memories(current_user: User = Depends(get_current_user)):
    """Return memories for the authenticated user only."""
    user_id = current_user.id
    try:
        memory_store = await get_async_memory_store()
        memories: list[dict[str, Any]] = []
        namespace = ("memories", user_id)

        try:
            search_results = await memory_store.asearch(namespace)
            for item in search_results:
                try:
                    if isinstance(item.value, bytes):
                        content = json.loads(item.value.decode("utf-8"))
                    elif isinstance(item.value, str):
                        content = json.loads(item.value)
                    else:
                        content = item.value
                except (json.JSONDecodeError, AttributeError):
                    content = str(item.value)

                memories.append(
                    {
                        "key": item.key,
                        "content": content,
                        "namespace": str(namespace),
                        "created_at": getattr(item, "created_at", "Unknown"),
                        "updated_at": getattr(item, "updated_at", "Unknown"),
                    }
                )

            return {"user_id": user_id, "total_memories": len(memories), "memories": memories}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error retrieving memories: {e}",
            ) from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to access memory store: {e}",
        ) from e
