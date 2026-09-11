from typing import Literal

from pydantic import BaseModel


class ChatStreamRequest(BaseModel):
    """Chat stream body. user_id is never accepted from the client."""

    input: str
    session_id: str = "default"
    provider: str | None = None
    mode: Literal["events", "text"] | None = "events"


class AbortInterruptResponse(BaseModel):
    aborted: bool
    had_interrupt: bool


class CancelRunResponse(BaseModel):
    """Result of server-side 「停止生成」 cancel."""

    cancelled: bool
    had_running_run: bool
    thread_cleared: bool
