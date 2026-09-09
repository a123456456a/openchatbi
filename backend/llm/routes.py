from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from backend.auth.deps import get_current_user
from backend.auth.models import User
from backend.db import get_db
from backend.llm.schemas import LlmSettingsResponse, LlmSettingsUpdate
from backend.llm.service import (
    DecryptFailed,
    LlmSettingsError,
    ProviderConfigNotFound,
    delete_provider,
    get_settings_for_user,
    upsert_settings,
)

llm_settings_router = APIRouter(prefix="/api/me", tags=["llm-settings"])


@llm_settings_router.get("/llm-settings", response_model=LlmSettingsResponse)
def get_llm_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LlmSettingsResponse:
    try:
        return get_settings_for_user(db, user)
    except DecryptFailed as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=exc.detail) from exc


@llm_settings_router.put("/llm-settings", response_model=LlmSettingsResponse)
def put_llm_settings(
    body: LlmSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LlmSettingsResponse:
    try:
        return upsert_settings(db, user, body)
    except DecryptFailed as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=exc.detail) from exc
    except LlmSettingsError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.detail) from exc


@llm_settings_router.delete("/llm-settings/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def delete_llm_settings(
    provider: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_provider(db, user, provider)
    except ProviderConfigNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.detail) from exc
    except LlmSettingsError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.detail) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
