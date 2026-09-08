from pydantic import BaseModel, Field


class TokenRequest(BaseModel):
    grant_type: str
    username: str | None = None
    password: str | None = None
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    role: str
    user_id: str


class RevokeRequest(BaseModel):
    refresh_token: str


class BootstrapRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)


class UserInfoResponse(BaseModel):
    user_id: str
    username: str
    role: str
