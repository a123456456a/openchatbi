from cryptography.fernet import InvalidToken
from sqlalchemy.orm import Session

from backend.auth.models import User, UserLlmConfig
from backend.llm.crypto import decrypt_api_key, encrypt_api_key, mask_api_key
from backend.llm.graph_cache import invalidate_graphs_for_user
from backend.llm.providers import PROVIDER_CATALOG
from backend.llm.schemas import (
    LlmConfigIn,
    LlmConfigOut,
    LlmSettingsResponse,
    LlmSettingsUpdate,
    ProviderCatalogItem,
)


DECRYPT_FAILED_DETAIL = "Failed to decrypt API key; please save the key again"


class LlmSettingsError(Exception):
    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class ProviderConfigNotFound(LlmSettingsError):
    pass


class DecryptFailed(LlmSettingsError):
    def __init__(self, detail: str = DECRYPT_FAILED_DETAIL):
        super().__init__(detail)


def get_settings_for_user(db: Session, user: User) -> LlmSettingsResponse:
    rows = (
        db.query(UserLlmConfig)
        .filter(UserLlmConfig.user_id == user.id)
        .order_by(UserLlmConfig.provider.asc())
        .all()
    )
    return LlmSettingsResponse(
        active_provider=user.active_llm_provider,
        catalog=_catalog_items(),
        configs=[_to_config_out(row) for row in rows],
    )


def upsert_settings(db: Session, user: User, update: LlmSettingsUpdate) -> LlmSettingsResponse:
    if update.configs:
        for item in update.configs:
            _upsert_config(db, user, item)
        db.flush()

    if "active_provider" in update.model_fields_set:
        _apply_active_provider(db, user, update.active_provider)

    db.commit()
    db.refresh(user)
    invalidate_graphs_for_user(user.id)
    return get_settings_for_user(db, user)


def delete_provider(db: Session, user: User, provider: str) -> None:
    row = _find_config(db, user.id, provider)
    if row is None:
        raise ProviderConfigNotFound(f"No config for provider {provider}")
    db.delete(row)
    if user.active_llm_provider == provider:
        user.active_llm_provider = None
    db.commit()
    invalidate_graphs_for_user(user.id)


def _catalog_items() -> list[ProviderCatalogItem]:
    return [
        ProviderCatalogItem(
            id=meta.id,
            label=meta.label,
            default_model=meta.default_model,
            default_base_url=meta.default_base_url,
            requires_base_url=meta.requires_base_url,
        )
        for meta in PROVIDER_CATALOG.values()
    ]


def _upsert_config(db: Session, user: User, item: LlmConfigIn) -> None:
    meta = PROVIDER_CATALOG.get(item.provider)
    if meta is None:
        raise LlmSettingsError(f"Unknown provider: {item.provider}")

    base_url = _normalized_optional(item.base_url)
    if meta.requires_base_url and not base_url:
        raise LlmSettingsError("base_url is required for openai_compatible provider")

    existing = _find_config(db, user.id, item.provider)
    ciphertext = _resolve_ciphertext(existing, item.api_key)
    if existing is None:
        db.add(
            UserLlmConfig(
                user_id=user.id,
                provider=item.provider,
                api_key_encrypted=ciphertext,
                model=item.model,
                base_url=base_url,
            )
        )
        return

    existing.api_key_encrypted = ciphertext
    existing.model = item.model
    existing.base_url = base_url


def _resolve_ciphertext(existing: UserLlmConfig | None, api_key: str | None) -> str:
    incoming = _normalized_optional(api_key)
    if incoming:
        return encrypt_api_key(incoming)
    if existing is not None and existing.api_key_encrypted:
        return existing.api_key_encrypted
    raise LlmSettingsError("API key is required for this provider")


def _apply_active_provider(db: Session, user: User, provider: str | None) -> None:
    if provider is None:
        user.active_llm_provider = None
        return
    if provider not in PROVIDER_CATALOG:
        raise LlmSettingsError(f"Unknown provider: {provider}")
    row = _find_config(db, user.id, provider)
    if row is None or not row.api_key_encrypted:
        raise LlmSettingsError("Cannot set active provider without an API key")
    user.active_llm_provider = provider


def _find_config(db: Session, user_id: str, provider: str) -> UserLlmConfig | None:
    return (
        db.query(UserLlmConfig)
        .filter(UserLlmConfig.user_id == user_id, UserLlmConfig.provider == provider)
        .first()
    )


def _to_config_out(row: UserLlmConfig) -> LlmConfigOut:
    has_key = bool(row.api_key_encrypted)
    masked = None
    if has_key:
        try:
            plain = decrypt_api_key(row.api_key_encrypted)
        except InvalidToken as exc:
            raise DecryptFailed() from exc
        masked = mask_api_key(plain)
    return LlmConfigOut(
        provider=row.provider,
        has_key=has_key,
        api_key_masked=masked,
        model=row.model,
        base_url=row.base_url,
    )


def _normalized_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None
