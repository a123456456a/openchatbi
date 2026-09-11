"""JWT-protected chat stream and current-user memories."""

from __future__ import annotations

import dataclasses
import hashlib
import json
from typing import Any

from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from langgraph.types import Command
from sqlalchemy.orm import Session

from backend.auth.deps import get_current_user
from backend.auth.models import User, UserLlmConfig
from backend.chat.schemas import ChatStreamRequest
from backend.db import get_db
from backend.llm.crypto import decrypt_api_key
from backend.llm.factory import build_chat_model
from backend.llm.graph_cache import get_or_build_graph
from backend.llm.service import DECRYPT_FAILED_DETAIL
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

MISSING_LLM_SETTINGS_DETAIL = "请先在设置中配置模型"


def llm_config_hash(model: str, base_url: str | None, api_key_encrypted: str) -> str:
    material = f"{model}|{base_url or ''}|{api_key_encrypted[:16]}"
    return hashlib.sha256(material.encode()).hexdigest()[:16]


def resolve_user_chat_llm(db: Session, user: User) -> tuple[str, Any, str]:
    """Return (provider, llm, config_hash) for the user's active settings."""
    provider = user.active_llm_provider
    if not provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MISSING_LLM_SETTINGS_DETAIL)

    row = (
        db.query(UserLlmConfig)
        .filter(UserLlmConfig.user_id == user.id, UserLlmConfig.provider == provider)
        .first()
    )
    if row is None or not row.api_key_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MISSING_LLM_SETTINGS_DETAIL)

    try:
        api_key = decrypt_api_key(row.api_key_encrypted)
    except InvalidToken as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=DECRYPT_FAILED_DETAIL,
        ) from exc

    try:
        llm = build_chat_model(provider, api_key, row.model, row.base_url)
    except (ValueError, ImportError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return provider, llm, llm_config_hash(row.model, row.base_url, row.api_key_encrypted)


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
    db: Session = Depends(get_db),
):
    """Stream agent responses as NDJSON (or legacy plain text).

    ``user_id`` is always taken from the authenticated JWT subject.
    Request body ``provider`` is ignored; the server active provider is used.
    """
    user_id = current_user.id
    session_id = req.session_id or "default"
    run_config = build_run_config(user_id=user_id, session_id=session_id)

    provider, llm, config_hash = resolve_user_chat_llm(db, current_user)
    try:
        graph = await get_or_build_graph(user_id, provider, llm, config_hash)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    # If the previous turn stopped on an `interrupt()` (e.g. AskHuman / low
    # confidence SQL review), the graph must be resumed via `Command(resume=...)`
    # on the same thread instead of being given a brand-new message; otherwise
    # LangGraph would start a fresh run and the paused node's answer would be lost.
    pending_state = await graph.aget_state(run_config)
    if pending_state.interrupts:
        stream_input: Any = Command(resume=req.input)
    else:
        stream_input = {"messages": [("user", req.input)]}

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
