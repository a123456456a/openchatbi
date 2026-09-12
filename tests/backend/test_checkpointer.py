"""Persistent Sqlite checkpointer survives reopen (process-restart stand-in)."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from backend.llm.checkpointer import (
    cleanup_async_checkpointer,
    clear_all_checkpoint_threads,
    clear_all_checkpoint_threads_sync,
    get_async_checkpointer,
    list_checkpoint_thread_ids,
    reset_async_checkpointer_for_tests,
)


class _State(TypedDict):
    value: str


def _build_graph(checkpointer):
    def set_value(state: _State) -> _State:
        return {"value": state["value"] + "-saved"}

    g = StateGraph(_State)
    g.add_node("set_value", set_value)
    g.add_edge(START, "set_value")
    g.add_edge("set_value", END)
    return g.compile(checkpointer=checkpointer)


@pytest.fixture
def checkpointer_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "checkpoints.db"
    monkeypatch.setenv("CHECKPOINTER_BACKEND", "sqlite")
    monkeypatch.setenv("CHECKPOINTER_SQLITE_PATH", str(db_path))
    from backend.config import get_settings

    get_settings.cache_clear()
    reset_async_checkpointer_for_tests()
    yield db_path
    asyncio.run(cleanup_async_checkpointer())
    reset_async_checkpointer_for_tests()
    get_settings.cache_clear()


def test_sqlite_checkpointer_persists_across_reopen(checkpointer_env: Path):
    """Same session/thread remains readable after releasing and reopening the DB."""

    async def write_then_reopen():
        cp1 = await get_async_checkpointer()
        graph = _build_graph(cp1)
        cfg = {"configurable": {"thread_id": "user-session-1"}}
        await graph.ainvoke({"value": "hello"}, config=cfg)
        state = await graph.aget_state(cfg)
        assert state.values["value"] == "hello-saved"

        await cleanup_async_checkpointer()
        reset_async_checkpointer_for_tests()

        cp2 = await get_async_checkpointer()
        graph2 = _build_graph(cp2)
        restored = await graph2.aget_state(cfg)
        assert restored.values["value"] == "hello-saved"
        assert checkpointer_env.exists()

    asyncio.run(write_then_reopen())


def test_postgres_backend_requires_url(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CHECKPOINTER_BACKEND", "postgres")
    monkeypatch.delenv("CHECKPOINTER_POSTGRES_URL", raising=False)
    from backend.config import get_settings

    get_settings.cache_clear()
    reset_async_checkpointer_for_tests()
    with pytest.raises(ValueError, match="CHECKPOINTER_POSTGRES_URL"):
        asyncio.run(get_async_checkpointer())
    reset_async_checkpointer_for_tests()
    get_settings.cache_clear()


def test_interrupt_survives_process_restart(checkpointer_env: Path):
    """Acceptance: after process restart, the same session can still resume an interrupt."""
    from langgraph.types import Command, interrupt

    class _AskState(TypedDict):
        value: str

    def ask_node(state: _AskState) -> _AskState:
        answer = interrupt({"text": "continue?"})
        return {"value": f"{state['value']}-{answer}"}

    def build(checkpointer):
        g = StateGraph(_AskState)
        g.add_node("ask", ask_node)
        g.add_edge(START, "ask")
        g.add_edge("ask", END)
        return g.compile(checkpointer=checkpointer)

    async def run():
        cp1 = await get_async_checkpointer()
        graph = build(cp1)
        cfg = {"configurable": {"thread_id": "user-interrupt-1"}}
        async for _ in graph.astream({"value": "hi"}, config=cfg):
            pass
        paused = await graph.aget_state(cfg)
        assert paused.interrupts
        assert paused.interrupts[0].value == {"text": "continue?"}

        await cleanup_async_checkpointer()
        reset_async_checkpointer_for_tests()

        cp2 = await get_async_checkpointer()
        graph2 = build(cp2)
        restored = await graph2.aget_state(cfg)
        assert restored.interrupts
        assert restored.interrupts[0].value == {"text": "continue?"}

        await graph2.ainvoke(Command(resume="yes"), config=cfg)
        done = await graph2.aget_state(cfg)
        assert not done.interrupts
        assert done.values["value"] == "hi-yes"

    asyncio.run(run())


def test_clear_all_checkpoint_threads_removes_every_user_thread(checkpointer_env: Path):
    """Warehouse is global: clearing drops all users' threads, including analysis children."""

    async def run():
        cp = await get_async_checkpointer()
        graph = _build_graph(cp)
        for tid in ("user-a-default", "user-b-default", "user-a-default:data_analysis"):
            await graph.ainvoke({"value": "x"}, config={"configurable": {"thread_id": tid}})
        ids = await list_checkpoint_thread_ids()
        assert ids == {"user-a-default", "user-b-default", "user-a-default:data_analysis"}

        cleared = await clear_all_checkpoint_threads()
        assert cleared == 3
        assert await list_checkpoint_thread_ids() == set()
        for tid in ("user-a-default", "user-b-default", "user-a-default:data_analysis"):
            state = await graph.aget_state({"configurable": {"thread_id": tid}})
            assert state.values == {} or state.values.get("value") is None

    asyncio.run(run())


def test_clear_all_checkpoint_threads_sync_sqlite(checkpointer_env: Path):
    """Sync Sqlite path deletes without requiring an async checkpointer cache."""

    async def seed():
        cp = await get_async_checkpointer()
        graph = _build_graph(cp)
        await graph.ainvoke({"value": "seed"}, config={"configurable": {"thread_id": "u1-s1"}})
        await graph.ainvoke({"value": "seed"}, config={"configurable": {"thread_id": "u2-s2"}})

    asyncio.run(seed())
    asyncio.run(cleanup_async_checkpointer())
    reset_async_checkpointer_for_tests()

    cleared = clear_all_checkpoint_threads_sync()
    assert cleared == 2

    async def assert_empty():
        assert await list_checkpoint_thread_ids() == set()

    asyncio.run(assert_empty())
