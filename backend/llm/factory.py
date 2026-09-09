from langchain_core.language_models import BaseChatModel

from backend.llm.providers import PROVIDER_CATALOG


def build_chat_model(
    provider: str,
    api_key: str,
    model: str,
    base_url: str | None,
) -> BaseChatModel:
    meta = PROVIDER_CATALOG.get(provider)
    if meta is None:
        raise ValueError(f"Unknown provider: {provider}")

    if meta.requires_base_url and not base_url:
        raise ValueError("base_url is required for openai_compatible provider")

    effective_base_url = base_url or meta.default_base_url

    if provider in ("deepseek", "zhipu", "openai", "openai_compatible"):
        from langchain_openai import ChatOpenAI

        kwargs: dict[str, str] = {"api_key": api_key, "model": model}
        if effective_base_url is not None:
            kwargs["base_url"] = effective_base_url
        return ChatOpenAI(**kwargs)

    if provider == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as exc:
            raise ValueError(
                "langchain-anthropic is not installed; install it to use the Anthropic provider"
            ) from exc
        return ChatAnthropic(api_key=api_key, model=model)

    if provider == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError as exc:
            raise ValueError(
                "langchain-google-genai is not installed; install the google-genai extra to use Gemini"
            ) from exc
        return ChatGoogleGenerativeAI(google_api_key=api_key, model=model)

    raise ValueError(f"Unknown provider: {provider}")
