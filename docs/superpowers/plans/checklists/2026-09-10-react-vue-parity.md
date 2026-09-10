# React / Vue 前端功能对照清单

**日期：** 2026-09-10
**关联：** `docs/superpowers/plans/2026-09-10-frontend-react-dual-track.md`、`docs/superpowers/specs/2026-09-10-frontend-react-dual-track-design.md`

用于跟踪 `frontend-react/`（React，端口 5174，并行对照）与 `frontend/`（Vue，端口 5173，默认入口）之间的功能对齐情况。默认入口在下列「切换默认入口的条件」全部满足并经人工确认前保持 Vue。

## 对照清单

| 能力 | Vue (`frontend/`) | React (`frontend-react/`) | 说明 |
|---|---|---|---|
| 登录（用户名/密码） | ✅ `views/LoginView.vue` | ✅ `pages/LoginPage.tsx` | 同 `/oauth/token`（password grant） |
| 首个管理员 bootstrap | ✅ | ✅ | 同 `POST /api/auth/bootstrap` |
| Token refresh（单飞/single-flight） | ✅ `stores/auth.ts` | ✅ `stores/auth.ts` + `auth.test.ts` | 并发 refresh 只触发一次 `/oauth/token`(refresh_token) |
| 401 自动重试一次 | ✅ `api/http.ts` | ✅ `api/http.ts`（`AuthBridge` 解耦） | |
| 路由角色守卫（admin） | ✅ `router/index.ts` | ✅ `routes/RequireAuth.tsx` | 非 admin 访问 `/admin/users` 回退 `/chat` |
| 未登录重定向 + `redirect` query | ✅ | ✅ | |
| 新建会话 | ✅ `AppShell.vue` | ✅ `components/layout/AppShell.tsx` | `crypto.randomUUID()` |
| 会话列表持久化（localStorage） | ✅ `ocbi_sessions` | ✅ `ocbi_sessions`（同 key） | |
| 会话切换恢复历史消息（按会话持久化） | ✅ `stores/chat.ts`（`loadSession`）+ `stores/sessions.ts`（`ocbi_session_messages`） | ✅ `stores/chat.ts`（`loadSession`）+ `stores/sessions.ts`（`ocbi_session_messages`） | 2026-09-10 修复：此前切换会话会清空消息且无法恢复（bug），现改为按会话 id 持久化消息并在切回时恢复；切换时若原会话仍在流式生成会自动 `stop()` 中止 |
| 会话归档 / 恢复 / 删除 | ✅ `AppShell.vue`（`el-dropdown` + `el-collapse`「已归档」区） | ✅ `AppShell.tsx`（`DropdownMenu` + `Collapsible`「已归档」区） | 新增能力：会话条目右侧常驻「更多操作」按钮，可归档/删除；已归档区可恢复/永久删除（删除前二次确认）；删除当前会话会自动创建新会话 |
| 流式聊天（NDJSON） | ✅ `api/chat.ts` | ✅ `api/chat.ts` + `lib/ndjson.ts`（含单测） | `/api/chat/stream`，`mode: 'events'` |
| thinking / content 分流（`is_final`） | ✅ `stores/chat.ts` | ✅ `stores/chatEvents.ts`（含单测） | `is_final === false` → thinking |
| `final_answer` 覆盖 content | ✅ | ✅ | |
| 步骤（steps）展示 | ✅ `StepCollapse.vue` | ✅ `components/chat/StepCollapse.tsx` | |
| 思考过程折叠 | ✅ `ThinkingCollapse.vue` | ✅ `components/chat/ThinkingCollapse.tsx` | 流式中自动展开，结束后自动折叠 |
| 停止生成 | ✅ `chat.stop()` | ✅ `chat.stop()`（AbortController） | |
| interrupt 确认弹窗 | ✅ `InterruptDialog.vue` | ✅ `components/chat/InterruptDialog.tsx` | |
| 设置 LLM（供应商/Key/模型/Base URL） | ✅ `SettingsDialog.vue` | ✅ `components/layout/SettingsDialog.tsx` | 同 `/api/me/llm-settings`（GET/PUT/DELETE） |
| 保存校验（`requires_base_url`、已有 key 免填） | ✅ | ✅ | |
| 管理员用户管理（列表/创建/改角色/启停） | ✅ `views/admin/UsersView.vue` | ✅ `pages/admin/UsersPage.tsx` | 同 `/api/users` |

## 已知差异（视觉，非功能性）

- Vue：Element Plus 组件库，蓝色系主色。
- React：shadcn/ui（Radix）组件库，青绿 `#0F766E` 主色，浅色 SaaS 视觉（本次双轨设计的目标方向）。
- 两侧组件代码不共享、不互相转译；仅共享后端 API 契约与 localStorage key 约定（`ocbi_refresh`、`ocbi_sessions`），便于并排调试对照。

## 切换默认入口的条件（摘自设计文档）

须全部满足，且产品负责人确认：

1. 路由与功能与 Vue 行为一致（含角色跳转）
2. 视觉统一为浅色 + 青绿
3. 构建与关键路径冒烟通过
4. 启动文档写明双前端；切换步骤可回退

切换前 Vue 保持可启动。本清单应随后续变更持续更新。
