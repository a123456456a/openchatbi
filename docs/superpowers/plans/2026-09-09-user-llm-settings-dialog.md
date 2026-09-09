# User LLM Settings Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个登录用户提供 Dialog 形式的多供应商 LLM 设置（Key / 模型 / Base URL），配置加密存库，JWT 聊天路径按用户配置动态建连，不再依赖 yaml `llm_providers`。

**Architecture:** `backend/llm/` 提供供应商目录、Fernet 加密、Chat 模型工厂与 `/api/me/llm-settings`；`users.active_llm_provider` + `user_llm_configs` 按用户持久化；聊天建图时用 contextvar 覆盖 `get_llm()`，图缓存键为 `user_id:provider:config_hash`。前端用 `SettingsDialog` 替换 Drawer。

**Tech Stack:** FastAPI、SQLAlchemy、cryptography (Fernet)、LangChain ChatOpenAI / ChatAnthropic（可选 extras）、Vue 3、Pinia、Element Plus

**Spec:** `docs/superpowers/specs/2026-09-09-user-llm-settings-dialog-design.md`

## Global Constraints

- Key 仅后端按用户存储；GET 只返回掩码 + `has_key`
- 每人自管；禁止跨用户读写
- 字段：`api_key` + `model` + 可选 `base_url`；`openai_compatible` 必填 `base_url`
- 内置目录驱动聊天（deepseek / zhipu / openai / anthropic / gemini / openai_compatible）；不要求 yaml 声明
- 聊天忽略请求体 `provider`，以服务端 `active_llm_provider` 为准
- 无 active / 无 Key → chat `400`；不回退 yaml
- 图缓存按用户隔离；改配置后失效
- 首期 chat/text2sql/analysis 共用同一用户 chat 模型
- 提交用 conventional commits；未要求时不要 push
- Windows PowerShell：串联命令用 `;` 不用 `&&`

---

## File Structure

```
backend/
  config.py                          # + LLM_SETTINGS_SECRET
  auth/models.py                     # + User.active_llm_provider, UserLlmConfig
  llm/
    __init__.py
    providers.py                     # 内置目录常量
    crypto.py                        # Fernet encrypt/decrypt/mask
    factory.py                       # build_chat_model(...)
    schemas.py                       # Pydantic 请求/响应
    service.py                       # 读/写/删配置、失效缓存钩子
    routes.py                        # /api/me/llm-settings
  chat/routes.py                     # 按用户配置建图 + 缓存键改造
openchatbi/llm/llm.py                # contextvar LLM override
frontend/src/
  api/llmSettings.ts
  stores/settings.ts                 # 对接 API
  constants/llmProviders.ts          # 与后端目录镜像
  components/layout/SettingsDialog.vue
  components/layout/AppShell.vue     # 引用 Dialog
  # 删除或停用 SettingsDrawer.vue
tests/backend/
  test_llm_crypto.py
  test_llm_factory.py
  test_llm_settings_routes.py
  test_chat_user_llm.py
```

---

### Task 1: Fernet 加密工具

**Files:**
- Modify: `backend/config.py`
- Modify: `pyproject.toml`（若尚未传递依赖 `cryptography`，显式加入）
- Create: `backend/llm/__init__.py`, `backend/llm/crypto.py`
- Test: `tests/backend/test_llm_crypto.py`

**Interfaces:**
- Produces:
  - `encrypt_api_key(plain: str) -> str`
  - `decrypt_api_key(token: str) -> str`
  - `mask_api_key(plain: str) -> str`（长度≤8 则全 `*`；否则保留末 4 位，如 `****abcd`）
  - Settings 字段 `llm_settings_secret: str | None`（env `LLM_SETTINGS_SECRET`）；为空时用 `JWT_SECRET` 派生 Fernet key 并允许测试通过

- [ ] **Step 1: 写失败测试**

```python
# tests/backend/test_llm_crypto.py
from backend.llm.crypto import decrypt_api_key, encrypt_api_key, mask_api_key


def test_encrypt_decrypt_roundtrip(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-for-llm")
    monkeypatch.setenv("LLM_SETTINGS_SECRET", "llm-secret-32bytes-long!!!!!!")
    from backend.config import get_settings
    get_settings.cache_clear()
    # force crypto module to rebuild key if cached
    token = encrypt_api_key("sk-live-abcdef1234")
    assert token != "sk-live-abcdef1234"
    assert decrypt_api_key(token) == "sk-live-abcdef1234"


def test_mask_keeps_last4():
    assert mask_api_key("sk-live-abcdef1234").endswith("1234")
    assert "sk-live" not in mask_api_key("sk-live-abcdef1234")
```

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/backend/test_llm_crypto.py -v`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `backend/config.py` 增加字段**

```python
llm_settings_secret: str | None = Field(default=None, alias="LLM_SETTINGS_SECRET")
```

- [ ] **Step 4: 实现 `backend/llm/crypto.py`**

用 `cryptography.fernet.Fernet`；从 `LLM_SETTINGS_SECRET` 或 `JWT_SECRET` 经 `hashlib.sha256` → `base64.urlsafe_b64encode` 得到 32-byte Fernet key。`mask_api_key` 按 Interfaces。

- [ ] **Step 5: 跑通测试**

Run: `pytest tests/backend/test_llm_crypto.py -v`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/config.py backend/llm pyproject.toml tests/backend/test_llm_crypto.py
git commit -m "feat(llm): add Fernet helpers for user API keys"
```

---

### Task 2: 供应商目录与 Chat 模型工厂

**Files:**
- Create: `backend/llm/providers.py`, `backend/llm/factory.py`
- Test: `tests/backend/test_llm_factory.py`

**Interfaces:**
- Produces:
  - `PROVIDER_CATALOG: dict[str, ProviderMeta]`，`ProviderMeta` 含 `id`, `label`, `default_base_url: str | None`, `default_model: str`, `requires_base_url: bool`
  - ids: `deepseek`, `zhipu`, `openai`, `anthropic`, `gemini`, `openai_compatible`
  - `build_chat_model(provider: str, api_key: str, model: str, base_url: str | None) -> BaseChatModel`
  - 未知 provider → `ValueError`
  - `openai_compatible` 且无 base_url → `ValueError`
  - deepseek 默认 `https://api.deepseek.com/v1`；zhipu 默认 `https://open.bigmodel.cn/api/paas/v4/`；二者用 `langchain_openai.ChatOpenAI`
  - openai → `ChatOpenAI`；anthropic → `ChatAnthropic`（缺依赖则 `ImportError` 包装为 `ValueError` 提示安装）
  - gemini → 优先 `langchain_google_genai.ChatGoogleGenerativeAI`；不可用则 `ValueError` 说明安装 extras

- [ ] **Step 1: 写失败测试**

```python
# tests/backend/test_llm_factory.py
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/backend/test_llm_factory.py -v`  
Expected: FAIL

- [ ] **Step 3: 实现 providers + factory**

`deepseek` / `zhipu` / `openai` / `openai_compatible` 统一走 `ChatOpenAI(api_key=..., model=..., base_url=...)`。  
`anthropic`：`ChatAnthropic(api_key=..., model=...)`。  
`gemini`：`ChatGoogleGenerativeAI(google_api_key=..., model=...)`（若 import 失败 raise ValueError）。

- [ ] **Step 4: 跑通测试**

Run: `pytest tests/backend/test_llm_factory.py -v`  
Expected: PASS（gemini/anthropic 若环境缺包，工厂应在被调用时才 import；catalog 测试不实例化）

- [ ] **Step 5: Commit**

```bash
git add backend/llm/providers.py backend/llm/factory.py tests/backend/test_llm_factory.py
git commit -m "feat(llm): add provider catalog and chat model factory"
```

---

### Task 3: ORM — UserLlmConfig + active_llm_provider

**Files:**
- Modify: `backend/auth/models.py`
- Modify: `backend/app.py`（确保 import 新模型以便 `create_all`；可 `import backend.auth.models` 已足够若模型写在同文件）
- Test: `tests/backend/test_llm_settings_routes.py`（本 Task 先写「表可创建」小测，或并入 Task 4；推荐本 Task 单独轻量测）

**Interfaces:**
- Produces:
  - `User.active_llm_provider: Mapped[str | None]`
  - `class UserLlmConfig`：字段见 spec；`UniqueConstraint("user_id", "provider")`
  - `User.llm_configs` relationship

- [ ] **Step 1: 写失败测试**

```python
# tests/backend/test_user_llm_model.py
from backend.auth.models import User, UserLlmConfig
from backend.auth.passwords import hash_password
from backend.db import Base, SessionLocal
import backend.db as db


def test_user_llm_config_persists(client_db_ready := None):
    # 使用与 test_users_admin 相同的 client fixture 模式：create_all 后插入
    pass
```

改为可运行版本：复制 `test_users_admin.py` 的 `client` fixture 模式，在测试里：

```python
def test_user_llm_config_roundtrip(client):
    from backend.auth.models import User, UserLlmConfig
    from backend.auth.passwords import hash_password
    import backend.db as db

    sess = db.SessionLocal()
    try:
        u = User(username="u1", password_hash=hash_password("Pass123!"), role="viewer")
        sess.add(u)
        sess.commit()
        sess.refresh(u)
        row = UserLlmConfig(
            user_id=u.id,
            provider="deepseek",
            api_key_encrypted="enc",
            model="deepseek-chat",
            base_url=None,
        )
        sess.add(row)
        u.active_llm_provider = "deepseek"
        sess.commit()
        sess.refresh(u)
        assert u.active_llm_provider == "deepseek"
        assert sess.query(UserLlmConfig).filter_by(user_id=u.id).count() == 1
    finally:
        sess.close()
```

（`client` fixture 同 `tests/backend/test_users_admin.py`，保证 `create_all`。）

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/backend/test_user_llm_model.py -v`  
Expected: FAIL（无 UserLlmConfig）

- [ ] **Step 3: 扩展 models**

在 `User` 上增加 `active_llm_provider`；新增 `UserLlmConfig`；`api_key_encrypted` 用 `Text`；`updated_at` 用 `server_default=func.now()` + `onupdate`。

- [ ] **Step 4: 跑通测试**

Run: `pytest tests/backend/test_user_llm_model.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/auth/models.py tests/backend/test_user_llm_model.py
git commit -m "feat(auth): add user_llm_configs and active_llm_provider"
```

---

### Task 4: `/api/me/llm-settings` 路由

**Files:**
- Create: `backend/llm/schemas.py`, `backend/llm/service.py`, `backend/llm/routes.py`
- Modify: `backend/app.py` — `app.include_router(llm_settings_router)`
- Test: `tests/backend/test_llm_settings_routes.py`

**Interfaces:**
- Produces:
  - `GET /api/me/llm-settings` → `{ active_provider, catalog, configs: [{provider, has_key, api_key_masked, model, base_url}] }`
  - `PUT /api/me/llm-settings` body: `{ active_provider?: str|null, configs?: [{provider, api_key?, model, base_url?}] }`
  - `DELETE /api/me/llm-settings/{provider}`
  - service: `get_settings_for_user(db, user) -> ...`；`upsert_settings(...)`；`delete_provider(...)`；空 `api_key` 保留原密文
  - 设 active 时必须已有 Key（本次或已存）

- [ ] **Step 1: 写失败测试（节选）**

```python
def test_put_and_get_masks_key(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = _password_token(client, "admin", "Admin123!")
    r = client.put(
        "/api/me/llm-settings",
        headers=_auth(tok["access_token"]),
        json={
            "active_provider": "deepseek",
            "configs": [{
                "provider": "deepseek",
                "api_key": "sk-secret-key-9999",
                "model": "deepseek-chat",
                "base_url": None,
            }],
        },
    )
    assert r.status_code == 200
    g = client.get("/api/me/llm-settings", headers=_auth(tok["access_token"]))
    assert g.status_code == 200
    body = g.json()
    assert body["active_provider"] == "deepseek"
    cfg = next(c for c in body["configs"] if c["provider"] == "deepseek")
    assert cfg["has_key"] is True
    assert "sk-secret-key-9999" not in str(body)
    assert cfg["api_key_masked"].endswith("9999")


def test_user_b_cannot_see_user_a_keys(client):
    # bootstrap admin; create second user via admin API; each PUT own key; B's GET must not list A's provider secrets
    ...


def test_put_empty_key_preserves(client):
    # first PUT with key; second PUT api_key "" or omit; decrypt still old
    ...


def test_openai_compatible_requires_base_url(client):
    ...
    assert r.status_code == 400
```

（辅助函数 `_password_token` / `_auth` 从现有测试复制。）

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/backend/test_llm_settings_routes.py -v`  
Expected: FAIL（404）

- [ ] **Step 3: 实现 schemas / service / routes 并挂载**

Router: `APIRouter(prefix="/api/me", tags=["llm-settings"])`，依赖 `get_current_user` + `get_db`。  
DELETE 若删掉 active → `user.active_llm_provider = None`。

- [ ] **Step 4: 跑通测试**

Run: `pytest tests/backend/test_llm_settings_routes.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/llm backend/app.py tests/backend/test_llm_settings_routes.py
git commit -m "feat(api): add /api/me/llm-settings for per-user providers"
```

---

### Task 5: `get_llm` contextvar 覆盖

**Files:**
- Modify: `openchatbi/llm/llm.py`
- Test: `tests/test_llm_override.py`（或 `tests/backend/test_llm_override.py`）

**Interfaces:**
- Produces:
  - `set_llm_override(llm: BaseChatModel) -> Token`
  - `reset_llm_override(token) -> None`
  - `get_default_llm` / `get_llm` / `get_text2sql_llm` / `get_analysis_llm`：若 override 非空则直接返回 override（忽略 provider yaml）

- [ ] **Step 1: 写失败测试**

```python
from unittest.mock import MagicMock
from openchatbi.llm.llm import get_llm, reset_llm_override, set_llm_override


def test_override_wins():
    fake = MagicMock(name="UserLLM")
    token = set_llm_override(fake)
    try:
        assert get_llm() is fake
        assert get_llm("openai") is fake
    finally:
        reset_llm_override(token)
```

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/test_llm_override.py -v`  
Expected: FAIL

- [ ] **Step 3: 实现 contextvars**

```python
import contextvars
_llm_override: contextvars.ContextVar[BaseChatModel | None] = contextvars.ContextVar(
    "openchatbi_llm_override", default=None
)

def set_llm_override(llm: BaseChatModel):
    return _llm_override.set(llm)

def reset_llm_override(token):
    _llm_override.reset(token)
```

在 `get_default_llm` 开头：`ov = _llm_override.get(); if ov is not None: return ov`。  
`get_text2sql_llm` / `get_analysis_llm` 同样优先 override。

- [ ] **Step 4: 跑通测试**

Run: `pytest tests/test_llm_override.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add openchatbi/llm/llm.py tests/test_llm_override.py
git commit -m "feat(llm): allow request-scoped LLM override via contextvar"
```

---

### Task 6: 聊天路径接用户配置 + 图缓存隔离

**Files:**
- Modify: `backend/chat/routes.py`
- Modify: `backend/llm/service.py`（导出 `invalidate_user_graphs(user_id)` 回调或 chat 模块提供 registry）
- Test: `tests/backend/test_chat_user_llm.py`
- 调整：`tests/backend/test_chat_auth.py`（现有 mock `get_or_build_graph`；若签名变了，同步 patch 目标）

**Interfaces:**
- Produces:
  - `get_or_build_graph(user_id: str, provider: str, llm, config_hash: str)`
  - 缓存键 `f"{user_id}:{provider}:{config_hash}"`
  - `config_hash = sha256(f"{model}|{base_url or ''}|{api_key_encrypted[:16]}")[:16]`
  - chat_stream：无 active / 无行 / 解密失败 → HTTP 400，detail 含「请先在设置中配置模型」
  - 建图前 `set_llm_override(llm)`，`build_agent_graph_async(...)` 后 `reset`；**缓存的是已绑定该 llm 的 graph**，后续命中缓存不再需要 override
  - PUT/DELETE settings 成功后调用 `invalidate_graphs_for_user(user_id)` 删除 `_graphs` 中 `key.startswith(user_id + ":")` 的项
  - 忽略 `req.provider`

- [ ] **Step 1: 写失败测试**

```python
def test_chat_without_llm_settings_returns_400(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = _password_token(client, "admin", "Admin123!")
    r = client.post(
        "/api/chat/stream",
        headers=_auth(tok["access_token"]),
        json={"input": "hi", "session_id": "s1", "mode": "events"},
    )
    assert r.status_code == 400
    assert "设置" in r.json()["detail"]


def test_chat_with_settings_builds_graph_with_user_llm(client):
    # PUT deepseek settings; patch build_agent_graph_async + factory if needed;
    # assert get_or_build_graph path called / stream 200 with mocked graph
    ...
```

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/backend/test_chat_user_llm.py -v`  
Expected: FAIL（当前无配置仍可能因 mock/构图行为不同）

- [ ] **Step 3: 改造 `backend/chat/routes.py`**

伪代码：

```python
async def get_or_build_graph(user_id: str, provider: str, llm, config_hash: str):
    key = f"{user_id}:{provider}:{config_hash}"
    if key in _graphs:
        return _graphs[key]
    async with _graphs_lock:
        if key in _graphs:
            return _graphs[key]
        token = set_llm_override(llm)
        try:
            _graphs[key] = await build_agent_graph_async(
                config.get().catalog_store, llm_provider=None
            )
        finally:
            reset_llm_override(token)
        return _graphs[key]


def invalidate_graphs_for_user(user_id: str) -> None:
    prefix = f"{user_id}:"
    for k in list(_graphs):
        if k.startswith(prefix):
            del _graphs[k]
```

在 `chat_stream` 内：查 User + UserLlmConfig → decrypt → `build_chat_model` → hash → get_or_build_graph。

在 `backend/llm/service.py` 的 upsert/delete 末尾调用 `from backend.chat.routes import invalidate_graphs_for_user`（注意循环 import：可把 cache 抽到 `backend/llm/graph_cache.py` 若出现环）。

- [ ] **Step 4: 跑通相关测试**

Run: `pytest tests/backend/test_chat_user_llm.py tests/backend/test_chat_auth.py -v`  
Expected: PASS（更新 `test_chat_auth` 的 patch：先 PUT 设置，或 patch 更高层「加载用户 llm」函数）

推荐为可测性抽出：

```python
async def resolve_user_chat_llm(db, user) -> tuple[str, Any, str]:
    """returns provider, llm, config_hash; raises HTTPException 400"""
```

`test_chat_auth` 可 patch `resolve_user_chat_llm` + `get_or_build_graph`。

- [ ] **Step 5: Commit**

```bash
git add backend/chat/routes.py backend/llm tests/backend/test_chat_user_llm.py tests/backend/test_chat_auth.py
git commit -m "feat(chat): build agent graph from per-user LLM settings"
```

---

### Task 7: 前端 API + settings store

**Files:**
- Create: `frontend/src/api/llmSettings.ts`, `frontend/src/constants/llmProviders.ts`
- Modify: `frontend/src/stores/settings.ts`
- Modify: `frontend/src/stores/chat.ts`（`provider` 可传 `null` 或去掉对 localStorage provider 的依赖）

**Interfaces:**
- Produces:
  - `fetchLlmSettings()`, `saveLlmSettings(body)`, `deleteLlmProvider(provider)`
  - store: `activeProvider`, `configs`, `catalog`, `settingsOpen`, `load()`, `save(form)`, `openSettings/closeSettings`
  - `chatProvider()` 返回 `activeProvider`（兼容旧字段；服务端忽略）

- [ ] **Step 1: 实现 `llmProviders.ts` 常量（与后端 id/label/默认模型一致）**

- [ ] **Step 2: 实现 `llmSettings.ts`**

```typescript
import { httpJson } from './http'

export type LlmConfigRow = {
  provider: string
  has_key: boolean
  api_key_masked: string | null
  model: string
  base_url: string | null
}

export type LlmSettingsResponse = {
  active_provider: string | null
  catalog: { id: string; label: string; default_model: string; default_base_url: string | null; requires_base_url: boolean }[]
  configs: LlmConfigRow[]
}

export function fetchLlmSettings() {
  return httpJson<LlmSettingsResponse>('/api/me/llm-settings')
}

export function saveLlmSettings(body: {
  active_provider?: string | null
  configs?: { provider: string; api_key?: string; model: string; base_url?: string | null }[]
}) {
  return httpJson<LlmSettingsResponse>('/api/me/llm-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
```

- [ ] **Step 3: 重写 `settings.ts` store**（打开 Dialog 时 `load()`；去掉 `PROVIDER_OPTIONS` localStorage 主路径）

- [ ] **Step 4: 手动类型检查**

Run: `cd frontend; pnpm exec vue-tsc -b --pretty false`  
Expected: 无因本 Task 引入的错误（若 Dialog 尚未改，可暂留旧组件编译；下一 Task 替换）

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/llmSettings.ts frontend/src/constants/llmProviders.ts frontend/src/stores/settings.ts frontend/src/stores/chat.ts
git commit -m "feat(frontend): wire settings store to llm-settings API"
```

---

### Task 8: SettingsDialog UI 替换 Drawer

**Files:**
- Create: `frontend/src/components/layout/SettingsDialog.vue`
- Modify: `frontend/src/components/layout/AppShell.vue`
- Delete: `frontend/src/components/layout/SettingsDrawer.vue`（用 Delete 工具；勿用 shell rm）

**Interfaces:**
- Produces: Dialog 含供应商 select、API Key、模型、Base URL、取消/保存；`openai_compatible` 无 base_url 时禁用保存并提示

- [ ] **Step 1: 实现 `SettingsDialog.vue`**

结构要点：

```vue
<el-dialog v-model="settings.settingsOpen" title="模型设置" width="520px" @open="onOpen">
  <el-form label-position="top">
    <el-form-item label="供应商">
      <el-select v-model="form.provider" class="w-full" @change="onProviderChange">...</el-select>
    </el-form-item>
    <el-form-item label="API Key">
      <el-input v-model="form.api_key" type="password" show-password :placeholder="keyPlaceholder" />
    </el-form-item>
    <el-form-item label="模型">
      <el-input v-model="form.model" />
    </el-form-item>
    <el-form-item label="Base URL">
      <el-input v-model="form.base_url" :placeholder="basePlaceholder" />
    </el-form-item>
  </el-form>
  <template #footer>
    <el-button @click="settings.closeSettings()">取消</el-button>
    <el-button type="primary" :loading="saving" :disabled="!canSave" @click="onSave">保存并使用</el-button>
  </template>
</el-dialog>
```

- 打开时 `await settings.load()`，按 `active_provider` 或目录第一项填充  
- 切换供应商时从 `configs` 回填 model/base_url；Key 输入清空，placeholder 用 masked  
- 保存：`save({ active_provider: form.provider, configs: [{ ... }] })`，成功 `ElMessage.success` 并关闭  

- [ ] **Step 2: AppShell 改引用 Dialog；删除 Drawer**

- [ ] **Step 3: 构建前端**

Run: `cd frontend; pnpm run build`  
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/SettingsDialog.vue frontend/src/components/layout/AppShell.vue
git add -u frontend/src/components/layout/SettingsDrawer.vue
git commit -m "feat(frontend): replace settings drawer with LLM settings dialog"
```

---

### Task 9: 端到端验收与 README 短注

**Files:**
- Modify: `README.md`（简短说明：登录后在设置 Dialog 配置个人 LLM；主路径不再依赖 yaml provider 下拉）

- [ ] **Step 1: 跑后端相关测试全集**

Run: `pytest tests/backend/test_llm_crypto.py tests/backend/test_llm_factory.py tests/backend/test_user_llm_model.py tests/backend/test_llm_settings_routes.py tests/backend/test_chat_user_llm.py tests/backend/test_chat_auth.py tests/test_llm_override.py -v`  
Expected: 全部 PASS

- [ ] **Step 2: 手工验收清单（本地）**

1. 启动 backend + `pnpm dev`  
2. 登录 → 齿轮 → Dialog 选 DeepSeek → 填 Key/模型 → 保存  
3. 发一句聊天，确认不再 400  
4. 换浏览器配置文件或第二用户，确认看不到对方 Key  
5. GET `/api/me/llm-settings` 响应无完整 Key  

- [ ] **Step 3: README 补 5–10 行「用户 LLM 设置」**

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: note per-user LLM settings dialog on main path"
```

---

## Self-Review (plan vs spec)

| Spec 项 | Task |
|---------|------|
| Dialog UI | 8 |
| 供应商可选 + Key/model/base_url | 2, 4, 8 |
| DeepSeek/智谱/国内外 | 2 |
| 按用户后端存储 + 加密 | 1, 3, 4 |
| 每人自管 | 4 测试隔离 |
| 完全由用户配置驱动、不回退 yaml | 6 |
| 图缓存按用户 + 失效 | 6 |
| GET 掩码 | 1, 4 |
| 忽略客户端 provider | 6 |
| 首期共用 chat 模型 | 5 override 覆盖 text2sql/analysis |
| 测试要点 | 1–6, 9 |

无 TBD 占位；类型名前后一致：`UserLlmConfig`、`build_chat_model`、`set_llm_override`、`invalidate_graphs_for_user`。
