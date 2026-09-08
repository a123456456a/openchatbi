# Vue3 前端分离 + OAuth 风格 JWT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在同仓 Monorepo 中落地 `frontend/`（Vue3+TS+Tailwind+Element Plus）与 `backend/`（FastAPI 自建 JWT 鉴权 + 流式聊天），替换 Streamlit 作为产品主路径。

**Architecture:** `backend/` 从 `sample_api/async_api.py` 演进，鉴权边界全部在 HTTP 层；`user_id` 仅来自 JWT `sub`。前端 SPA 经 Vite 代理调用 `/oauth/*` 与 `/api/*`；侧栏底栏左用户、右设置。Agent 核心 `openchatbi/` 以库方式复用。

**Tech Stack:** Python 3.11+、FastAPI、SQLAlchemy、PyJWT、argon2-cffi、Vue 3、TypeScript、Vite、Tailwind CSS、Element Plus、Pinia、Vue Router

**Spec:** `docs/superpowers/specs/2026-09-08-vue-oauth-jwt-design.md`

## Global Constraints

- 同仓：`frontend/` + `backend/`（不用 `openchatbi/api/`）
- 鉴权：B3 — `POST /oauth/token`（password / refresh_token），预留 Code+PKCE
- JWT：首期 HS256；Access 15–30m；Refresh 7–30d 哈希落库可吊销
- 角色：`admin` | `analyst` | `viewer`（P2）
- Chat：NDJSON 事件类型保持 `step|token|interrupt|usage|final_answer`
- 禁止客户端传 `user_id`；报告下载需 `analyst`+
- 首用户：`POST /api/auth/bootstrap`（仅库空时）
- 旧 `sample_ui` 保留为 demo，不删除
- 提交信息用 conventional commits；未要求时不要 push

---

## File Structure

```
backend/
  __init__.py
  app.py                 # FastAPI 入口、CORS、挂载路由
  config.py              # JWT_SECRET、TTL、DB URL、CORS
  db.py                  # engine、SessionLocal、get_db
  auth/
    models.py            # User、RefreshToken
    passwords.py         # hash_password / verify_password
    jwt_service.py       # create_access_token / decode_access_token / issue_refresh / rotate
    deps.py              # get_current_user / require_roles
    schemas.py           # TokenRequest、TokenResponse、UserInfo
    routes.py            # /oauth/*、/api/auth/bootstrap
  users/
    schemas.py
    routes.py            # admin CRUD
  chat/
    schemas.py
    routes.py            # /api/chat/stream（JWT → user_id）
  sessions/
    models.py            # 可选 SessionMeta
    routes.py

frontend/
  package.json
  vite.config.ts
  tailwind.config.js
  src/
    main.ts
    App.vue
    api/{http.ts,oauth.ts,chat.ts,users.ts}
    stores/{auth.ts,chat.ts,sessions.ts,settings.ts}
    router/index.ts
    views/{LoginView.vue,ChatView.vue,admin/UsersView.vue}
    components/layout/{AppShell.vue,SidebarFooter.vue,SettingsDrawer.vue}
    components/chat/{MessageList.vue,StepCollapse.vue,InterruptDialog.vue}
    composables/useNdjsonStream.ts
    types/stream.ts

tests/backend/
  test_passwords.py
  test_jwt_service.py
  test_oauth_routes.py
  test_chat_auth.py
  test_users_admin.py
```

---

### Task 1: 后端依赖与脚手架

**Files:**
- Modify: `pyproject.toml`
- Create: `backend/__init__.py`, `backend/config.py`, `backend/db.py`, `backend/app.py`
- Create: `run_backend.py`

**Interfaces:**
- Produces: `backend.config.get_settings() -> Settings`；`backend.db.get_db()` 生成器；`app: FastAPI` 可 `uvicorn` 启动

- [ ] **Step 1: 在 `pyproject.toml` 的 `dependencies` 中追加（若尚未直接声明）**

```toml
"fastapi>=0.115.0,<1.0.0",
"uvicorn[standard]>=0.30.0,<1.0.0",
"python-multipart>=0.0.9,<1.0.0",
"PyJWT>=2.8.0,<3.0.0",
"argon2-cffi>=23.1.0,<26.0.0",
```

- [ ] **Step 2: 同步依赖**

Run: `uv sync`
Expected: 成功，无冲突报错

- [ ] **Step 3: 创建 `backend/config.py`**

```python
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    jwt_secret: str = Field(default="dev-only-change-me", alias="JWT_SECRET")
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    database_url: str = Field(default="sqlite:///./data/auth.db", alias="AUTH_DATABASE_URL")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

若项目未装 `pydantic-settings`，改为用 `os.environ` 读取同等字段，保持接口名 `get_settings()`。

- [ ] **Step 4: 创建 `backend/db.py` 与最小 `backend/app.py`（仅 health）**

```python
# backend/db.py
from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import get_settings


class Base(DeclarativeBase):
    pass


def _engine():
    url = get_settings().database_url
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


engine = _engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

```python
# backend/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings

app = FastAPI(title="OpenChatBI API")
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
```

```python
# run_backend.py
import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
```

- [ ] **Step 5: 冒烟启动**

Run: `uv run python -c "from backend.app import app; print(app.title)"`
Expected: `OpenChatBI API`

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml uv.lock backend run_backend.py
git commit -m "chore: scaffold FastAPI backend package"
```

---

### Task 2: User / RefreshToken 模型与建表

**Files:**
- Create: `backend/auth/models.py`, `backend/auth/__init__.py`
- Modify: `backend/app.py`（lifespan 里 `Base.metadata.create_all`）
- Test: `tests/backend/test_auth_models.py`

**Interfaces:**
- Produces: `User(id, username, password_hash, role, is_active, created_at)`；`RefreshToken(...)`；`Role` 字面量 `"admin"|"analyst"|"viewer"`

- [ ] **Step 1: 写失败测试**

```python
# tests/backend/test_auth_models.py
from backend.auth.models import User
from backend.db import Base, SessionLocal, engine


def test_create_user_row():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        u = User(username="alice", password_hash="x", role="analyst")
        db.add(u)
        db.commit()
        db.refresh(u)
        assert u.id
        assert u.role == "analyst"
        assert u.is_active is True
    finally:
        db.close()
```

- [ ] **Step 2: 跑测试确认失败**

Run: `uv run pytest tests/backend/test_auth_models.py -v`
Expected: FAIL（模块/表不存在）

- [ ] **Step 3: 实现模型**

```python
# backend/auth/models.py
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db import Base


class Role(str, enum.Enum):
    admin = "admin"
    analyst = "analyst"
    viewer = "viewer"


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default=Role.viewer.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")
```

在 `backend/app.py` lifespan 中调用 `Base.metadata.create_all(bind=engine)`，并 `import backend.auth.models` 确保元数据注册。

- [ ] **Step 4: 跑测试通过**

Run: `uv run pytest tests/backend/test_auth_models.py -v`
Expected: PASS（可用临时 sqlite：测试前 monkeypatch `AUTH_DATABASE_URL` 或 `get_settings.cache_clear()` + 环境变量）

- [ ] **Step 5: Commit**

```bash
git add backend/auth tests/backend/test_auth_models.py backend/app.py
git commit -m "feat(auth): add user and refresh token models"
```

---

### Task 3: 密码哈希与 JWT / Refresh 服务

**Files:**
- Create: `backend/auth/passwords.py`, `backend/auth/jwt_service.py`
- Test: `tests/backend/test_passwords.py`, `tests/backend/test_jwt_service.py`

**Interfaces:**
- Produces:
  - `hash_password(plain: str) -> str`
  - `verify_password(plain: str, password_hash: str) -> bool`
  - `create_access_token(user_id: str, username: str, role: str) -> str`
  - `decode_access_token(token: str) -> dict`（校验 `typ=="access"`，过期抛错）
  - `create_refresh_token_value() -> str`（随机 urlsafe）
  - `hash_token(raw: str) -> str`（sha256 hex）

- [ ] **Step 1: 写失败测试**

```python
# tests/backend/test_passwords.py
from backend.auth.passwords import hash_password, verify_password


def test_hash_and_verify():
    h = hash_password("secret-pass")
    assert h != "secret-pass"
    assert verify_password("secret-pass", h)
    assert not verify_password("wrong", h)
```

```python
# tests/backend/test_jwt_service.py
import pytest
from backend.auth.jwt_service import create_access_token, decode_access_token


def test_access_token_roundtrip(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    from backend.config import get_settings
    get_settings.cache_clear()
    token = create_access_token("u1", "alice", "analyst")
    payload = decode_access_token(token)
    assert payload["sub"] == "u1"
    assert payload["role"] == "analyst"
    assert payload["typ"] == "access"
```

- [ ] **Step 2: 跑测试确认失败**

Run: `uv run pytest tests/backend/test_passwords.py tests/backend/test_jwt_service.py -v`
Expected: FAIL

- [ ] **Step 3: 实现**

```python
# backend/auth/passwords.py
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_ph = PasswordHasher()


def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, plain)
    except VerifyMismatchError:
        return False
```

```python
# backend/auth/jwt_service.py
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from backend.config import get_settings


def create_access_token(user_id: str, username: str, role: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_minutes),
        "jti": secrets.token_urlsafe(8),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    s = get_settings()
    payload = jwt.decode(token, s.jwt_secret, algorithms=["HS256"])
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("not an access token")
    return payload


def create_refresh_token_value() -> str:
    return secrets.token_urlsafe(48)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
```

- [ ] **Step 4: 跑测试通过**

Run: `uv run pytest tests/backend/test_passwords.py tests/backend/test_jwt_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/auth/passwords.py backend/auth/jwt_service.py tests/backend/test_passwords.py tests/backend/test_jwt_service.py
git commit -m "feat(auth): add password hashing and JWT helpers"
```

---

### Task 4: OAuth 风格路由（token / revoke / userinfo / bootstrap）

**Files:**
- Create: `backend/auth/schemas.py`, `backend/auth/routes.py`
- Modify: `backend/app.py`（`include_router`）
- Test: `tests/backend/test_oauth_routes.py`

**Interfaces:**
- Produces:
  - `POST /oauth/token` body JSON: `{grant_type, username?, password?, refresh_token?}` → `{access_token, token_type:"bearer", expires_in, refresh_token, role, user_id}`
  - `POST /oauth/revoke` Authorization Bearer + `{refresh_token}`
  - `GET /oauth/userinfo` → `{user_id, username, role}`
  - `POST /api/auth/bootstrap` `{username, password}` → 仅当 users 表为空时创建 admin

- [ ] **Step 1: 用 FastAPI TestClient 写失败测试（核心路径）**

```python
# tests/backend/test_oauth_routes.py
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.config import get_settings
from backend.db import Base, engine


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("AUTH_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    get_settings.cache_clear()
    # 重新绑定 engine：若 db.engine 已缓存，测试中需提供 reset_engine() 或在 db.py 用懒加载
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


def test_bootstrap_then_password_grant(client):
    r = client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    assert r.status_code == 201
    r2 = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": "admin", "password": "Admin123!"},
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["role"] == "admin"
```

实现时若 `engine` 单例导致测试 DB 难切换，在 `backend/db.py` 增加 `reset_engine()` 供测试调用，并在 fixture 中调用。

- [ ] **Step 2: 跑测试确认失败**

Run: `uv run pytest tests/backend/test_oauth_routes.py::test_bootstrap_then_password_grant -v`
Expected: FAIL（404 或 import）

- [ ] **Step 3: 实现 schemas + routes（最小可用）**

要点：
- password grant：查 User → verify_password → 签发 access + 存 refresh 哈希（`expires_at = now + refresh_token_days`）
- refresh grant：按 hash 查未吊销且未过期 RefreshToken → 可选轮换（吊销旧+发新）→ 新 access
- revoke：标记 `revoked_at`
- bootstrap：`db.query(User).count()==0` 否则 409
- userinfo：依赖 Task 5 的 `get_current_user`；若本 Task 先做，可临时内联 Bearer 解码，Task 5 再抽 deps

- [ ] **Step 4: 补测 refresh / 错误密码 / 二次 bootstrap**

```python
def test_refresh_and_revoke(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    tok = client.post(
        "/oauth/token",
        json={"grant_type": "password", "username": "admin", "password": "Admin123!"},
    ).json()
    refreshed = client.post(
        "/oauth/token",
        json={"grant_type": "refresh_token", "refresh_token": tok["refresh_token"]},
    )
    assert refreshed.status_code == 200
    rev = client.post(
        "/oauth/revoke",
        headers={"Authorization": f"Bearer {refreshed.json()['access_token']}"},
        json={"refresh_token": refreshed.json()["refresh_token"]},
    )
    assert rev.status_code == 204


def test_bootstrap_only_once(client):
    client.post("/api/auth/bootstrap", json={"username": "admin", "password": "Admin123!"})
    r = client.post("/api/auth/bootstrap", json={"username": "other", "password": "x"})
    assert r.status_code == 409
```

- [ ] **Step 5: 全部通过后 Commit**

```bash
git add backend/auth tests/backend/test_oauth_routes.py backend/app.py backend/db.py
git commit -m "feat(auth): oauth-style token bootstrap revoke userinfo"
```

---

### Task 5: `get_current_user` 与 `require_roles`

**Files:**
- Create: `backend/auth/deps.py`
- Modify: `backend/auth/routes.py`（userinfo / revoke 使用 deps）
- Test: `tests/backend/test_deps_roles.py`

**Interfaces:**
- Produces:
  - `get_current_user(credentials, db) -> User`（401 if missing/invalid/inactive）
  - `require_roles(*roles: str)` → 依赖，403 if role 不匹配

```python
# backend/auth/deps.py（实现要点）
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.auth.jwt_service import decode_access_token
from backend.auth.models import User
from backend.db import get_db

security = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_access_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token") from None
    user = db.get(User, payload["sub"])
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or missing")
    return user


def require_roles(*roles: str):
    def _inner(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _inner
```

- [ ] **Step 1–4: TDD** — 无 Token 访问 `/oauth/userinfo` → 401；viewer token 访问仅 admin 的探针路由 → 403；admin → 200  
- [ ] **Step 5: Commit** `feat(auth): add current-user and role dependencies`

---

### Task 6: 受 JWT 保护的 Chat Stream

**Files:**
- Create: `backend/chat/schemas.py`, `backend/chat/routes.py`, `backend/chat/__init__.py`
- Modify: `backend/app.py`
- 参考逻辑：`sample_api/async_api.py`（NDJSON generator、`AgentStreamProcessor`）
- Test: `tests/backend/test_chat_auth.py`

**Interfaces:**
- Produces: `POST /api/chat/stream`  
  Body: `{input: str, session_id: str, provider: str | null, mode: "events"|"text"}`  
  **无 user_id 字段**；内部 `user_id = current_user.id`  
  Header: `Authorization: Bearer ...`

- [ ] **Step 1: 测试无 Token → 401；有 Token 时 mock graph 返回一行 NDJSON**

```python
def test_chat_stream_requires_auth(client):
    r = client.post("/api/chat/stream", json={"input": "hi", "session_id": "s1", "mode": "events"})
    assert r.status_code == 401
```

- [ ] **Step 2: 从 `sample_api/async_api.py` 迁移 stream 实现到 `backend/chat/routes.py`，删除对 body.user_id 的读取**
- [ ] **Step 3: 记忆接口改为 `GET /api/me/memories`（`user_id=current_user.id`），旧开放路径不挂到新 app**
- [ ] **Step 4: Commit** `feat(chat): jwt-protected ndjson chat stream`

---

### Task 7: Admin 用户管理 API

**Files:**
- Create: `backend/users/schemas.py`, `backend/users/routes.py`
- Test: `tests/backend/test_users_admin.py`

**Interfaces:**
- `GET /api/users` — admin  
- `POST /api/users` — `{username, password, role}` admin  
- `PATCH /api/users/{id}` — `{role?, is_active?, password?}` admin  
- 报告下载路由：`require_roles("analyst", "admin")`

- [ ] **Step 1–4: TDD** viewer 调 POST /api/users → 403；admin → 201  
- [ ] **Step 5: Commit** `feat(users): admin user CRUD endpoints`

---

### Task 8: 前端脚手架（Vue3 + TS + Tailwind + Element Plus）

**Files:**
- Create: `frontend/**`（Vite 官方 vue-ts 模板基础上改）

**Interfaces:**
- Produces: `npm run dev` 于 `:5173`；`vite.config.ts` 将 `/oauth`、`/api`、`/health` 代理到 `http://127.0.0.1:8000`

- [ ] **Step 1: 脚手架**

```bash
cd D:/my/code/openchatbi
npm create vite@latest frontend -- --template vue-ts
cd frontend
npm install
npm install element-plus @element-plus/icons-vue vue-router pinia
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: 配置 Tailwind（Vite plugin）与 Element Plus 全量或按需引入；`main.ts` 注册 Pinia、Router、ElementPlus**
- [ ] **Step 3: `vite.config.ts` proxy**

```ts
server: {
  port: 5173,
  proxy: {
    "/oauth": "http://127.0.0.1:8000",
    "/api": "http://127.0.0.1:8000",
    "/health": "http://127.0.0.1:8000",
  },
},
```

- [ ] **Step 4: 页面显示 Hello + 请求 `/health` 成功**
- [ ] **Step 5: Commit** `chore: scaffold vue3 frontend with element-plus and tailwind`

---

### Task 9: 前端登录与 Auth Store

**Files:**
- Create: `frontend/src/api/http.ts`, `frontend/src/api/oauth.ts`, `frontend/src/stores/auth.ts`, `frontend/src/views/LoginView.vue`, `frontend/src/router/index.ts`

**Interfaces:**
- `authStore.login(username, password)` → 调 `/oauth/token`  
- `authStore.refresh()` → `grant_type=refresh_token`  
- `authStore.logout()` → `/oauth/revoke` + 清状态  
- access 存内存（Pinia）；refresh 存 `localStorage` 键 `ocbi_refresh`（首期；后续可改 Cookie）  
- axios/fetch 拦截：401 时单飞 refresh 后重试

- [ ] **Step 1: 实现 `LoginView`（Element Plus Form）与路由守卫：无 access 且 refresh 失败 → `/login`**
- [ ] **Step 2: 手工验收：bootstrap 用户后可登录并进入占位 `/chat`**
- [ ] **Step 3: Commit** `feat(frontend): login flow and auth store`

---

### Task 10: AppShell 侧栏底栏（左用户 / 右设置）

**Files:**
- Create: `frontend/src/components/layout/AppShell.vue`, `SidebarFooter.vue`, `SettingsDrawer.vue`
- Create: `frontend/src/stores/settings.ts`
- Modify: `ChatView.vue` 使用 AppShell

**Interfaces:**
- 侧栏底部固定条：左侧头像+`username` 下拉（资料占位、admin→`/admin/users`、退出）；右侧齿轮打开 SettingsDrawer  
- Settings：`provider` 下拉（首期可写死选项或 `GET /api/llm/providers` 若已加只读接口）；写入 `settingsStore`，聊天请求带 `provider`

- [ ] **Step 1: 按 spec 布局实现侧栏底栏，禁止把用户/齿轮放在主内容区**
- [ ] **Step 2: Commit** `feat(frontend): sidebar footer user and settings`

---

### Task 11: NDJSON 流式聊天 UI

**Files:**
- Create: `frontend/src/types/stream.ts`, `frontend/src/composables/useNdjsonStream.ts`, `frontend/src/api/chat.ts`, `frontend/src/stores/chat.ts`, `frontend/src/components/chat/*.vue`
- Modify: `ChatView.vue`

**Interfaces:**
- `useNdjsonStream(url, body, headers, onEvent)` 按行 parse  
- 事件渲染：`step` 折叠、`token` 追加、`interrupt` 对话框、`final_answer` 固化消息  
- `session_id`：`crypto.randomUUID()`，侧栏会话列表本地 Pinia 持久化（可选 localStorage）

```ts
// types/stream.ts
export type StreamEvent =
  | { type: "step"; kind: string; level: number; label: string; text: string; data?: unknown }
  | { type: "token"; level: number; label: string; is_final: boolean; text: string }
  | { type: "interrupt"; text: string; buttons: unknown[] }
  | { type: "usage"; turn_tokens?: number; turn_cost_usd?: number; by_model?: unknown }
  | { type: "final_answer"; text: string };
```

- [ ] **Step 1: 对接 `POST /api/chat/stream`，Bearer 自动带上**
- [ ] **Step 2: 与后端联调一条简单问题（可用 mock graph 若无 LLM key）**
- [ ] **Step 3: Commit** `feat(frontend): ndjson streaming chat view`

---

### Task 12: Admin 用户页 + 文档收尾

**Files:**
- Create: `frontend/src/views/admin/UsersView.vue`, `frontend/src/api/users.ts`
- Modify: `README.md`（主路径改为 frontend+backend；Streamlit 标 demo）
- Create: `docs` 小节或 README「Development」：`uv run python run_backend.py` + `cd frontend && npm run dev`
- Optional: `GET /api/llm/providers` 只读，供设置抽屉

- [ ] **Step 1: Users 表格 + 创建用户表单；路由 `meta.roles=['admin']`**
- [ ] **Step 2: README 更新启动方式与角色说明**
- [ ] **Step 3: 对照 spec DoD 手工勾选验收**
- [ ] **Step 4: Commit** `docs: document vue+jwt main path; add admin users ui`

---

## Spec Coverage Checklist

| Spec 项 | Task |
|---------|------|
| Monorepo frontend/backend | 1, 8 |
| HS256 JWT + refresh 落库 | 3, 4 |
| /oauth/token\|revoke\|userinfo | 4 |
| bootstrap 首 admin | 4 |
| P2 角色守卫 | 5, 7 |
| Chat 强制 JWT、无客户端 user_id | 6 |
| NDJSON 事件对齐 | 6, 11 |
| 侧栏底栏左用户右齿轮 | 10 |
| 设置模型 provider | 10, 12 |
| Admin 用户管理 | 7, 12 |
| 旧 UI demo | 12 |
| 报告下载 analyst+ | 7 |

## Execution Handoff

Plan 已保存。实现时推荐按 Task 1→12 顺序，每 Task 结束后跑对应 pytest / 手工冒烟再进下一 Task。
