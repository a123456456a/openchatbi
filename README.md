# OpenChatBI

面向业务的对话式智能 BI：用自然语言查数、分析与可视化。本仓库以 **Vue 前端 + FastAPI 后端** 为产品主路径，内置用户体系、模型设置、数仓管理与 Text2SQL / 分析 Agent。

## 能力概览

- **自然语言问数**：自然语言转 SQL，支持 schema 检索与可配置的安全护栏
- **数据分析与可视化**：图表（Plotly 等）、报表下载（按用户隔离）
- **数据目录**：自动发现表结构，支持向量 / BM25 检索；可维护业务释义
- **多用户与权限**：`admin` / `analyst` / `viewer`，JWT 登录
- **每人一套模型**：侧栏「模型设置」配置供应商与 API Key（加密存储）
- **数仓管理**：管理端维护连接、测试、激活；切仓后清理对话 checkpoint，避免串上下文
- **人机协作**：AskHuman / 低置信度 SQL 等中断确认；停止生成会真正取消服务端任务
- **持久会话**：LangGraph checkpointer（默认 SQLite），多 worker / 重启可恢复 interrupt

可选对照前端：`frontend-react/`（非默认入口）。库层与分析算法细节见 `openchatbi/`、`openchatbi/analysis/README.md`。

## 环境要求

- Python 3.11+
- Node.js 22+、pnpm 10（前端）
- 可用的 LLM（DeepSeek / 智谱 / OpenAI / Anthropic / Gemini / OpenAI 兼容等）
- 数据仓库（MySQL、PostgreSQL、Presto、Trino、SQLite 等）

> Python 3.12+ 上中文分词会回退到简易标点分词（jieba 不兼容 3.12+）。

## 快速开始（产品主路径）

```bash
# 依赖
uv sync

# 生产务必使用强密钥；本地可显式豁免（切勿用于生产）
export JWT_SECRET="$(openssl rand -hex 32)"
# 建议单独配置，避免轮换 JWT 导致已加密的模型 Key / 数仓密码无法解密
export LLM_SETTINGS_SECRET="$(openssl rand -hex 32)"

# 终端 1：后端（默认 http://127.0.0.1:8000）
uv run python run_backend.py

# 终端 2：Vue 前端（默认 http://localhost:5173，已代理 /oauth、/api）
cd frontend && pnpm install && pnpm dev
```

首次打开登录页可「首次初始化」创建首个 `admin`，或调用 `POST /api/auth/bootstrap`。

### 本地演示（可选）

未激活数仓时，聊天默认 **失败关闭**（`400`：请先在管理端激活数仓），不会静默跑示例 SQLite。

本地演示可显式豁免，并会显示「演示数据」标识：

```bash
export ALLOW_DEMO_WAREHOUSE=true
# 或：export APP_ENV=development
```

弱 `JWT_SECRET` 同理：生产会拒绝启动；本地可用 `ALLOW_INSECURE_DEFAULTS=true` 或 `APP_ENV=development`。

## 常用配置

### 密钥与加密

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | 登录 JWT；禁止使用默认弱值 |
| `LLM_SETTINGS_SECRET` | 加密用户 LLM Key、数仓密码；未设置时回退 `JWT_SECRET` 并打警告 |
| `ALLOW_INSECURE_DEFAULTS` / `APP_ENV` | 仅本地开发豁免弱 JWT |
| `ALLOW_DEMO_WAREHOUSE` | 仅本地允许演示数仓 |

迁移建议：先将 `LLM_SETTINGS_SECRET` 设为**当前** `JWT_SECRET`，再独立轮换 JWT。

### LangGraph Checkpointer

```bash
export CHECKPOINTER_BACKEND=sqlite                    # 默认
export CHECKPOINTER_SQLITE_PATH=./data/checkpoints.db
export RUN_CANCEL_SQLITE_PATH=./data/run_cancels.db   # 「停止生成」跨 worker 共享
# 可选 Postgres：CHECKPOINTER_BACKEND=postgres + CHECKPOINTER_POSTGRES_URL
```

「停止生成」调用 `POST /api/chat/sessions/{session_id}/cancel`，会取消服务端 run 并清理 thread，下一条消息开启新回合。

### 产品示例配置

```bash
cp openchatbi/config.yaml.template openchatbi/config.yaml
# 或参考 example/config.yaml
```

示例 / 模板默认开启：

- `enable_fail_closed_sql_guard`：只允许只读 SQL 形态（仍须用只读数仓账号）
- `enable_confidence_gate`：低置信度时人机确认
- `report_ttl_days: 30`：用户报表目录按天清理（`0` / 环境变量 `REPORT_TTL_DAYS=0` 可关）

主路径聊天以用户「模型设置」为准；未配置 Key 时聊天返回 400，并引导打开设置。

### 数仓管理（admin）

侧栏 → 头像菜单 →「数据库管理」（`/admin/databases`）：

- 新增 / 编辑 / 测试 / 删除连接（MySQL、PostgreSQL、Presto、Trino、SQLite）
- 「设为当前」激活；成功后同步 catalog、重建索引，并清理相关对话 checkpoint
- 失败会回滚激活，管理端有明确提示；聊天页会对旧仓会话提示「数仓已切换，请新开对话」

API：`/api/admin/database-connections`（仅 admin）。

## 目录结构（简）

```
backend/           # FastAPI：认证、聊天、用户、数仓、LLM
frontend/          # Vue 产品前端（默认）
frontend-react/    # React 对照前端（可选）
openchatbi/        # Agent / Text2SQL / catalog / 分析能力
example/           # 示例配置与演示数据
tests/             # 后端与库测试
```

## 开发与测试

```bash
# 后端测试（含 coverage）
uv run pytest -v --cov=openchatbi --cov=backend

# React 前端测试
cd frontend-react && pnpm install && pnpm test

# Vue：当前以构建校验为主
cd frontend && pnpm install && pnpm build
```

CI 在 `main` / `local-main` 上跑后端 pytest 与 React vitest。

## 许可

见仓库根目录 `LICENSE`。
