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
| 步骤（steps）展示 | ✅ `StepCollapse.vue` | ✅ `components/chat/StepCollapse.tsx` | 2026-09-10 修复：`use_tool`（主图）节点此前只处理工具报错，成功的工具结果被静默丢弃、从未到达 UI（只显示前置的「Using tool: ...」调用公告），见 `openchatbi/streaming.py`；现补发 `kind="tool_result"` 步骤。前端同时不再渲染纯「调用」类步骤（`tool`/`tool_call`/`sub_agent`），其余结果类步骤默认展开显示 |
| 思考过程折叠 | ✅ `ThinkingCollapse.vue` | ✅ `components/chat/ThinkingCollapse.tsx` | 流式中自动展开，结束后自动折叠；2026-09-10 调整消息内排版顺序为「思考过程 → 步骤结果 → 正文」，正文（最终回答）固定渲染在思考/步骤之后 |
| 停止生成 | ✅ `chat.stop()` | ✅ `chat.stop()`（AbortController） | |
| interrupt 确认弹窗 | ✅ `InterruptDialog.vue` | ✅ `components/chat/InterruptDialog.tsx` | |
| 设置 LLM（供应商/Key/模型/Base URL） | ✅ `SettingsDialog.vue` | ✅ `components/layout/SettingsDialog.tsx` | 同 `/api/me/llm-settings`（GET/PUT/DELETE） |
| 保存校验（`requires_base_url`、已有 key 免填） | ✅ | ✅ | |
| 管理员用户管理（列表/创建/改角色/启停） | ✅ `views/admin/UsersView.vue` | ✅ `pages/admin/UsersPage.tsx` | 同 `/api/users` |
| 消息 / 步骤 Markdown 渲染 | ✅ `components/common/Markdown.vue`（`markdown-it` + DOMPurify，`@tailwindcss/typography`） | ✅ `components/common/Markdown.tsx`（同上） | 2026-09-10 新增：此前消息内容与步骤详情用 `whitespace-pre-wrap` 纯文本渲染，标题/粗体/列表/表格/代码块等均显示原始符号（bug）；现统一走 sanitize 后的 markdown 渲染 |
| 可视化图表展示（`visualization_dsl` + CSV） | ✅ `components/chat/ChartView.vue`（Chart.js） | ✅ `components/chat/ChartView.tsx`（Chart.js） | 2026-09-10 新增：此前 `ChatStep` 未携带后端 `generate_visualization` 步骤的 `data`（`visualization_dsl` + CSV），图表数据被直接丢弃、无法显示（bug）；现补上 `data` 字段并用 Chart.js 渲染 line/bar/pie/scatter/histogram，`table`/`box` 与 DSL 报错场景渲染为数据表 |
| 管理员数据库连接管理（增删改/测试连接/切换当前数据源） | ✅ `views/admin/DatabasesView.vue` | ✅ `pages/admin/DatabasesPage.tsx` | 2026-09-10 新增：同 `/api/admin/database-connections`（GET/POST/PATCH/DELETE + `/{id}/activate` + `/test`、`/{id}/test`）；支持 mysql/postgresql/presto/trino/sqlite；激活新连接会热更新 `catalog_store` 的数据仓库配置并清空 agent graph 缓存，无需重启进程；正在使用中的连接不可删除 |
| 聊天欢迎/空状态界面（居中标题 + 快捷提示） | ✅ `components/chat/ChatWelcome.vue` | ✅ `components/chat/ChatWelcome.tsx` | 2026-09-10 新增：参考 TailGrids AI Chat 模板视觉重构；无消息时展示居中标题「嗨，需要我帮你分析什么？」+ 输入框 + 4 个 BI 场景快捷提示（点击填充输入框，不自动发送）；有消息后切回常规底部输入栏布局。刻意不引入模板中的「Projects」侧栏分组与模型选择下拉（按需求裁剪，本应用无此概念） |
| 会话侧栏搜索 + 按日期分组（今天/昨天/更早） | ✅ `AppShell.vue` | ✅ `components/layout/AppShell.tsx` | 2026-09-10 新增：按标题本地过滤会话列表；活跃会话按 `updatedAt` 分为「今天/昨天/更早」三组展示 |

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
