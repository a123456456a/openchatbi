from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderMeta:
    id: str
    label: str
    default_base_url: str | None
    default_model: str
    requires_base_url: bool


PROVIDER_CATALOG: dict[str, ProviderMeta] = {
    "deepseek": ProviderMeta(
        id="deepseek",
        label="DeepSeek",
        default_base_url="https://api.deepseek.com/v1",
        default_model="deepseek-chat",
        requires_base_url=False,
    ),
    "zhipu": ProviderMeta(
        id="zhipu",
        label="智谱 AI",
        default_base_url="https://open.bigmodel.cn/api/paas/v4/",
        default_model="glm-4-flash",
        requires_base_url=False,
    ),
    "openai": ProviderMeta(
        id="openai",
        label="OpenAI",
        default_base_url=None,
        default_model="gpt-4o-mini",
        requires_base_url=False,
    ),
    "anthropic": ProviderMeta(
        id="anthropic",
        label="Anthropic",
        default_base_url=None,
        default_model="claude-sonnet-4-20250514",
        requires_base_url=False,
    ),
    "gemini": ProviderMeta(
        id="gemini",
        label="Google Gemini",
        default_base_url=None,
        default_model="gemini-2.0-flash",
        requires_base_url=False,
    ),
    "openai_compatible": ProviderMeta(
        id="openai_compatible",
        label="OpenAI Compatible",
        default_base_url=None,
        default_model="gpt-4o-mini",
        requires_base_url=True,
    ),
}
