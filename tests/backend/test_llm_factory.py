import pytest
from backend.llm.factory import build_chat_model
from backend.llm.providers import PROVIDER_CATALOG


def test_catalog_contains_domestic_and_foreign():
    for pid in ("deepseek", "zhipu", "openai", "anthropic", "gemini", "openai_compatible"):
        assert pid in PROVIDER_CATALOG


def test_openai_compatible_requires_base_url():
    with pytest.raises(ValueError, match="base_url"):
        build_chat_model("openai_compatible", "k", "m", None)


def test_unknown_provider():
    with pytest.raises(ValueError, match="Unknown"):
        build_chat_model("nope", "k", "m", None)


def test_deepseek_builds_chat_openai():
    llm = build_chat_model("deepseek", "sk-test", "deepseek-chat", None)
    assert llm is not None
    assert getattr(llm, "model_name", None) or getattr(llm, "model", None)
