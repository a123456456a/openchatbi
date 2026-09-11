# frontend-react

OpenChatBI 的 React 并行前端（与 `frontend/`（Vue）对照实现，同一后端 API）。

## 定位

- 参见设计文档：`docs/superpowers/specs/2026-09-10-frontend-react-dual-track-design.md`
- 参见实施计划：`docs/superpowers/plans/2026-09-10-frontend-react-dual-track.md`
- 本项目是**并行对照前端**，不替换默认入口。默认入口仍为 `frontend/`（Vue，端口 5173）。
- 与 Vue 前端共享的后端契约：`/oauth/*`、`/api/*`、NDJSON 流式协议；localStorage key 与 Vue 保持一致（`ocbi_refresh`、`ocbi_sessions:<user_id>`、`ocbi_session_messages:<user_id>`），方便对照调试。

## 技术栈

- Vite 6+ / React 19 / TypeScript
- React Router 7
- Zustand（对应 Vue 端 Pinia stores）
- Tailwind CSS 4 + shadcn/ui（青绿 `#0F766E` 主色的浅色 SaaS 视觉）
- Vitest（纯逻辑单测：NDJSON 解析、auth refresh 等）

## 启动

需要后端已在 `http://127.0.0.1:8000` 运行（见仓库根 README / `backend/`）。

```bash
cd frontend-react
pnpm install
pnpm dev
```

默认监听 `http://127.0.0.1:5174`，`/oauth`、`/api`、`/health` 会被代理到后端 `8000` 端口。

## 与 Vue 前端对照

| | Vue (`frontend/`) | React (`frontend-react/`) |
|---|---|---|
| 端口 | 5173（默认入口） | 5174（并行对照） |
| 状态管理 | Pinia | Zustand |
| UI 库 | Element Plus | shadcn/ui |
| 路由 | Vue Router | React Router |

功能对照清单见：`docs/superpowers/plans/checklists/2026-09-10-react-vue-parity.md`。

## 测试与构建

```bash
pnpm test     # vitest run
pnpm build    # tsc -b && vite build
```
