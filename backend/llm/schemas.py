from pydantic import BaseModel, Field


class ProviderCatalogItem(BaseModel):
    id: str
    label: str
    default_model: str
    default_base_url: str | None
    requires_base_url: bool


class LlmConfigOut(BaseModel):
    provider: str
    has_key: bool
    api_key_masked: str | None
    model: str
    base_url: str | None


class LlmSettingsResponse(BaseModel):
    active_provider: str | None
    catalog: list[ProviderCatalogItem]
    configs: list[LlmConfigOut]


class LlmConfigIn(BaseModel):
    provider: str
    api_key: str | None = None
    model: str = Field(min_length=1)
    base_url: str | None = None


class LlmSettingsUpdate(BaseModel):
    active_provider: str | None = None
    configs: list[LlmConfigIn] | None = None
