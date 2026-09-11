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
