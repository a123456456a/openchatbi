# Frontend React Dual-Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仓库内新建 `frontend-react/`（Vite React + shadcn + 青绿 SaaS），与现有 Vue `frontend/` 并行对接同一后端，实现登录、会话壳、流式聊天、设置与用户管理；不切换默认入口除非人工确认。

**Architecture:** React 侧独立应用；API/流式协议与 Vue 对齐（`/oauth/*`、`/api/*`）；Zustand 对应 Pinia stores；UI 参考 21st 方案 1（Minimal Login、Sidebar Light、Agent Chat、Input Bar），以 shadcn 原语落地。Vue 冻结新功能。

**Tech Stack:** Vite 6+、React 19、TypeScript、React Router 7、Zustand、Tailwind CSS 4、shadcn/ui、lucide-react、Vitest（纯逻辑）

**Spec:** `docs/superpowers/specs/2026-09-10-frontend-react-dual-track-design.md`

## Global Constraints

- 只新增/修改 `frontend-react/` 与相关文档；**不删除、不大改** `frontend/`（Vue）
- **不改**后端 API / 鉴权 / NDJSON 流式协议
- 主色 `#0F766E`；背景 `#FAFBFC`；浅色 SaaS；不做暗色模式
- React dev 端口 **5174**；Vue 保持 **5173**；proxy 指向 `http://127.0.0.1:8000`
- localStorage：`ocbi_refresh`、`ocbi_sessions`（与 Vue 同 key，便于对照）
- 本期**不**切换仓库默认入口 / 根 README 主启动路径为 React（Task 11 只写双轨说明）
- Windows PowerShell：串联命令用 `;` 不用 `&&`
- 提交用 conventional commits；未要求时不要 push
- 21st 组件以结构/视觉参考为主；优先 shadcn 原语，避免引入过重 demo 依赖

---

## File Structure

```
frontend-react/
  package.json
  vite.config.ts
  index.html
  components.json                 # shadcn
  src/
    main.tsx
    App.tsx
    index.css                     # tokens + Tailwind
    lib/utils.ts                  # cn()
    types/stream.ts
    constants/llmProviders.ts
    api/
      http.ts
      oauth.ts
      chat.ts
      llmSettings.ts
      users.ts
    lib/
      ndjson.ts                   # parse NDJSON chunks (testable)
    stores/
      auth.ts
      sessions.ts
      chat.ts
      settings.ts
    components/
      ui/                         # shadcn: button, input, textarea, dialog, …
      layout/
        AppShell.tsx
        SidebarFooter.tsx
        SettingsDialog.tsx
      chat/
        MessageList.tsx
        ThinkingCollapse.tsx
        StepCollapse.tsx
        ChatComposer.tsx
        InterruptDialog.tsx
    pages/
      LoginPage.tsx
      ChatPage.tsx
      admin/UsersPage.tsx
    routes/
      router.tsx
      RequireAuth.tsx
    test/
      setup.ts
  README.md
```

契约对照源（只读）：`frontend/src/api/*`、`frontend/src/stores/*`、`frontend/src/types/stream.ts`

---

### Task 1: 脚手架 `frontend-react`

**Files:**
- Create: `frontend-react/`（Vite React-TS 模板）
- Create: `frontend-react/vite.config.ts`（port 5174 + proxy）
- Create: `frontend-react/README.md`（如何启动）
- Test: `npm run build` in `frontend-react`

**Interfaces:**
- Produces: 可在 `http://127.0.0.1:5174` 启动的空 React 应用

- [ ] **Step 1: 用 Vite 创建项目**

在仓库根目录执行（PowerShell）：

```powershell
cd D:\my\code\openchatbi
npm create vite@latest frontend-react -- --template react-ts
cd frontend-react
npm install
```

- [ ] **Step 2: 配置 Vite proxy 与端口**

将 `frontend-react/vite.config.ts` 设为：

```ts
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/oauth': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
})
```

先安装依赖：

```powershell
npm install @tailwindcss/vite tailwindcss
npm install -D @types/node
```

若 `path` / `__dirname` 在 ESM 下报错，改用：

```ts
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
```

- [ ] **Step 3: 写入最小 `src/index.css`**

```css
@import 'tailwindcss';

:root {
  --color-primary: #0f766e;
  --color-on-primary: #ffffff;
  --color-background: #fafbfc;
  --color-foreground: #0f172a;
  --color-muted: #f0fdfa;
  --color-muted-foreground: #64748b;
  --color-border: #e2e8f0;
  --color-card: #ffffff;
  --color-ring: #0f766e;
  --radius: 0.75rem;
  --font-sans: 'Geist', 'Inter', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--color-foreground);
  background: var(--color-background);
}
```

在 `main.tsx` 确保 `import './index.css'`。

- [ ] **Step 4: 验证构建**

```powershell
cd D:\my\code\openchatbi\frontend-react
npm run build
```

Expected: 成功，无错误。

- [ ] **Step 5: 写 `frontend-react/README.md`**

说明：端口 5174、需后端 `8000`、与 `frontend/`（5173）对照、不替换 Vue。

- [ ] **Step 6: Commit**

```powershell
git add frontend-react
git commit -m "chore(frontend-react): scaffold Vite React app on port 5174"
```

---

### Task 2: shadcn 原语 + 路径别名

**Files:**
- Create: `frontend-react/components.json`
- Create: `frontend-react/src/lib/utils.ts`
- Create: `frontend-react/src/components/ui/button.tsx`（及 input、textarea、dialog、label、dropdown-menu）
- Modify: `frontend-react/tsconfig*.json`（`@/*` paths）
- Modify: `frontend-react/src/index.css`（补齐 shadcn CSS 变量若 init 要求）

**Interfaces:**
- Produces: `cn(...inputs)`；可用 `<Button>` / `<Input>` / `<Textarea>` / `<Dialog>`

- [ ] **Step 1: 初始化 shadcn**

```powershell
cd D:\my\code\openchatbi\frontend-react
npx shadcn@latest init
```

选项倾向：TypeScript、Vite、别名 `@`、neutral/zinc 底，稍后用 CSS 把 primary 改成 teal。

再添加组件：

```powershell
npx shadcn@latest add button input textarea dialog label dropdown-menu avatar separator
```

- [ ] **Step 2: 把 primary 映射到青绿**

在 shadcn 生成的 CSS 变量中，将 `--primary` 设为接近 `#0F766E`（可用 oklch 等价或 hex，与项目 Tailwind 版本一致即可）。确保按钮默认色为青绿。

- [ ] **Step 3: 冒烟页面**

临时在 `App.tsx` 渲染一个 `<Button>OpenChatBI</Button>`，`npm run dev` 打开 5174 确认样式。

- [ ] **Step 4: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add shadcn ui primitives and teal primary"
```

---

### Task 3: API 层与流式类型（无 UI）

**Files:**
- Create: `frontend-react/src/types/stream.ts`
- Create: `frontend-react/src/api/oauth.ts`
- Create: `frontend-react/src/api/http.ts`
- Create: `frontend-react/src/api/chat.ts`
- Create: `frontend-react/src/api/llmSettings.ts`
- Create: `frontend-react/src/api/users.ts`
- Create: `frontend-react/src/lib/ndjson.ts`
- Create: `frontend-react/src/constants/llmProviders.ts`
- Test: `frontend-react/src/lib/ndjson.test.ts`

**Interfaces:**
- Produces（与 Vue 对齐）:
  - `passwordGrant(username, password): Promise<TokenResponse>`
  - `refreshGrant(refreshToken): Promise<TokenResponse>`
  - `revokeToken(refreshToken, accessToken): Promise<void>`
  - `fetchUserInfo(accessToken): Promise<UserInfo>`
  - `bootstrapAdmin(username, password): Promise<void>`
  - `http(input, options?): Promise<Response>` — 401 时调用传入的 `refresh()` 后重试一次
  - `httpJson<T>(...)`
  - `streamChat(body, onEvent, signal?, deps): Promise<void>`
  - `parseNdjsonBuffer(buffer, onEvent): string`（返回未消费残余）
  - 类型：`StreamEvent`、`ChatMessage`、`ChatStep` 与 Vue `types/stream.ts` 一致

- [ ] **Step 1: 安装测试依赖并配置 Vitest**

```powershell
cd D:\my\code\openchatbi\frontend-react
npm install -D vitest jsdom
```

`package.json` scripts 增加 `"test": "vitest run"`。

- [ ] **Step 2: 复制契约类型与 oauth**

`stream.ts` 内容与 `frontend/src/types/stream.ts` 相同。  
`oauth.ts` 逻辑与 `frontend/src/api/oauth.ts` 相同（端点路径不变）。  
`llmProviders.ts` 与 Vue `constants/llmProviders.ts` 相同。  
`llmSettings.ts` / `users.ts` 与 Vue 对应文件相同，但 `httpJson` 从 `./http` 引入。

- [ ] **Step 3: 实现可测的 NDJSON 解析**

`frontend-react/src/lib/ndjson.ts`:

```ts
export function parseNdjsonChunk(
  buffer: string,
  chunk: string,
  onLine: (line: string) => void,
): string {
  const next = buffer + chunk
  const lines = next.split('\n')
  const rest = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) onLine(trimmed)
  }
  return rest
}
```

- [ ] **Step 4: 写失败测试再实现**

`frontend-react/src/lib/ndjson.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { parseNdjsonChunk } from './ndjson'

describe('parseNdjsonChunk', () => {
  it('emits complete lines and keeps remainder', () => {
    const onLine = vi.fn()
    let buf = ''
    buf = parseNdjsonChunk(buf, '{"a":1}\n{"b":', onLine)
    expect(onLine).toHaveBeenCalledTimes(1)
    expect(onLine).toHaveBeenCalledWith('{"a":1}')
    buf = parseNdjsonChunk(buf, '2}\n', onLine)
    expect(onLine).toHaveBeenCalledTimes(2)
    expect(onLine).toHaveBeenCalledWith('{"b":2}')
    expect(buf).toBe('')
  })
})
```

Run: `npm test`  
Expected: PASS（实现后）。

- [ ] **Step 5: `http.ts` 接受 auth 依赖（避免循环）**

```ts
export type AuthBridge = {
  getAccessToken: () => string | null
  refresh: () => Promise<boolean>
  onAuthFailure?: () => void
}

let bridge: AuthBridge | null = null

export function setHttpAuthBridge(b: AuthBridge) {
  bridge = b
}

export async function http(input: string, options: RequestInit & { skipAuth?: boolean } = {}) {
  const { skipAuth = false, headers, ...rest } = options
  const doFetch = () => {
    const h = new Headers(headers)
    if (!skipAuth && bridge?.getAccessToken() && !h.has('Authorization')) {
      h.set('Authorization', `Bearer ${bridge.getAccessToken()}`)
    }
    return fetch(input, { ...rest, headers: h })
  }
  let res = await doFetch()
  if (res.status !== 401 || skipAuth || !bridge) return res
  const ok = await bridge.refresh()
  if (!ok) {
    bridge.onAuthFailure?.()
    return res
  }
  return doFetch()
}

export async function httpJson<T>(input: string, options?: RequestInit & { skipAuth?: boolean }): Promise<T> {
  const res = await http(input, options)
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
```

- [ ] **Step 6: `chat.ts` 用 `parseNdjsonChunk` 读流**

行为对齐 Vue：`/api/chat/stream`、401 refresh 重试、`Accept: application/x-ndjson`。从 bridge 取 token；解析每行 `JSON.parse` 为 `StreamEvent`。

- [ ] **Step 7: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add API clients and NDJSON parser"
```

---

### Task 4: Auth store + 路由守卫骨架

**Files:**
- Create: `frontend-react/src/stores/auth.ts`
- Create: `frontend-react/src/routes/RequireAuth.tsx`
- Create: `frontend-react/src/routes/router.tsx`
- Create: `frontend-react/src/stores/auth.test.ts`
- Modify: `frontend-react/src/main.tsx` / `App.tsx`
- Install: `zustand` `react-router`

**Interfaces:**
- Produces:
  - `useAuthStore`: `{ accessToken, userId, username, role, isAuthenticated, login, refresh, logout, bootstrap, getStoredRefresh, clearSession }`
  - `REFRESH_KEY = 'ocbi_refresh'`
  - `refresh()` single-flight（并发只跑一次）
  - 启动时 `setHttpAuthBridge({ getAccessToken, refresh, onAuthFailure })`

- [ ] **Step 1: 安装依赖**

```powershell
cd D:\my\code\openchatbi\frontend-react
npm install zustand react-router
```

- [ ] **Step 2: 写 auth refresh single-flight 测试**

用 vitest mock `refreshGrant`：两次并行 `refresh()` 只调用一次 grant。实现 `auth.ts` 使测试通过（可把 grant 函数注入或 vi.mock `../api/oauth`）。

- [ ] **Step 3: 实现 `stores/auth.ts`**

逻辑对齐 `frontend/src/stores/auth.ts`（Zustand）：

```ts
import { create } from 'zustand'
// login / refresh / logout / bootstrap 同 Vue 行为
```

在 `main.tsx` 调用 `setHttpAuthBridge`。

- [ ] **Step 4: 路由骨架**

```tsx
// routes/router.tsx
import { createBrowserRouter, Navigate } from 'react-router'
// /login public
// /chat, /chat/:sessionId protected
// /admin/users admin only
// / -> /chat
```

`RequireAuth`：未登录则尝试 `getStoredRefresh` + `refresh`；失败跳转 `/login?redirect=`。  
Admin：`role !== 'admin'` 则 `Navigate` 到 `/chat`。

临时页面可用占位 `<div>Chat</div>`。

- [ ] **Step 5: `npm test` + `npm run build`**

Expected: PASS。

- [ ] **Step 6: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add auth store and route guards"
```

---

### Task 5: 登录页（Minimal + mint 氛围）

**Files:**
- Create: `frontend-react/src/pages/LoginPage.tsx`
- Modify: `frontend-react/src/routes/router.tsx`

**Interfaces:**
- Consumes: `useAuthStore().login` / `bootstrap`
- Produces: 可登录并跳转 `redirect` 或 `/chat`

- [ ] **Step 1: 实现 LoginPage**

布局：全屏弱 mint 渐变背景；居中白卡片；标题 OpenChatBI；副文案「用对话探索业务数据」；用户名/密码 `Input`；主 `Button`「登录」；次要「初始化管理员」。

行为对齐 Vue `LoginView.vue`：校验空值；成功 `navigate(redirect || '/chat')`；已登录访问 `/login` 时跳转 `/chat`。

- [ ] **Step 2: 手工验收**

后端运行时：打开 `http://127.0.0.1:5174/login`，登录成功进入占位聊天页。

- [ ] **Step 3: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add minimal teal login page"
```

---

### Task 6: Sessions + AppShell（Sidebar Light）

**Files:**
- Create: `frontend-react/src/stores/sessions.ts`
- Create: `frontend-react/src/components/layout/AppShell.tsx`
- Create: `frontend-react/src/components/layout/SidebarFooter.tsx`
- Modify: `frontend-react/src/pages/ChatPage.tsx`（壳 + outlet）

**Interfaces:**
- Produces:
  - `SessionMeta { id, title, updatedAt }`
  - `useSessionsStore`: `sessions`, `upsert(id, title?)`, `ensure(id)`，`SESSIONS_KEY = 'ocbi_sessions'`
  - `AppShell`: 左栏 ~260px，品牌、新建会话、列表、底栏

- [ ] **Step 1: 实现 sessions store**

逻辑对齐 Vue `stores/sessions.ts`（localStorage 读写、按 `updatedAt` 排序）。

- [ ] **Step 2: 实现 AppShell**

- 品牌行：青绿方标 + OpenChatBI  
- 「新建会话」：`crypto.randomUUID()` → `ensure` → `navigate(/chat/:id)`  
- 列表：`NavLink`/`button`；激活：淡青绿底 + 左侧 3px `bg-primary`  
- `SidebarFooter`：用户名、下拉（退出；admin 显示用户管理）、设置按钮（先 `console` 或空，Task 9 接 Dialog）

- [ ] **Step 3: ChatPage 无 sessionId 时生成并 replace**

对齐 Vue `ChatView`：`useParams` 无 id 则创建 UUID 并 `navigate(..., { replace: true })`。

- [ ] **Step 4: 手工验收侧栏新建/切换会话**

- [ ] **Step 5: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add sessions store and sidebar shell"
```

---

### Task 7: Chat store + 流式发送/停止

**Files:**
- Create: `frontend-react/src/stores/chat.ts`
- Create: `frontend-react/src/stores/settings.ts`（最小：`activeProvider`、`chatProvider()`、`settingsOpen`；load/save 可在 Task 9 补全）
- Create: `frontend-react/src/stores/chat.test.ts`
- Modify: ChatPage 接线

**Interfaces:**
- Produces:
  - `useChatStore`: `messages`, `streaming`, `lastInterrupt`, `error`, `clear()`, `send(sessionId, input)`, `stop()`
  - token：`is_final === false` → `thinking`；否则 → `content`
  - `final_answer` 只覆盖 `content`
  - AbortError 不写 error；其它错误在 content 空时回填 `错误：…`

- [ ] **Step 1: 写 chat.applyEvent 风格单测**

抽出纯函数 `applyStreamEvent(assistant: ChatMessage, event: StreamEvent): void` 到 `stores/chatEvents.ts` 并测：

- step 追加 steps  
- token is_final false → thinking  
- token 缺省/true → content  
- final_answer 覆盖 content  
- interrupt 由 store 单独处理也可测返回值  

- [ ] **Step 2: 实现 chat store**

对齐 Vue `stores/chat.ts`：`send` 里 push user + assistant；调用 `streamChat`；`stop` abort。

`settings.chatProvider()` 先返回 `activeProvider`（可 null）。

- [ ] **Step 3: `npm test`**

Expected: PASS。

- [ ] **Step 4: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add chat store with thinking/token split"
```

---

### Task 8: 聊天 UI（Agent Chat + Input Bar）

**Files:**
- Create: `frontend-react/src/components/chat/MessageList.tsx`
- Create: `frontend-react/src/components/chat/ThinkingCollapse.tsx`
- Create: `frontend-react/src/components/chat/StepCollapse.tsx`
- Create: `frontend-react/src/components/chat/ChatComposer.tsx`
- Create: `frontend-react/src/components/chat/InterruptDialog.tsx`
- Modify: `frontend-react/src/pages/ChatPage.tsx`

**Interfaces:**
- Consumes: `useChatStore`
- Produces: 完整对话 UI（顶栏、消息、composer、interrupt）

- [ ] **Step 1: MessageList**

- 用户：右对齐，青绿实底白字  
- 助手：左对齐，白底边框  
- 顺序：content → ThinkingCollapse → StepCollapse  
- 空列表：居中短引导「输入数据分析问题开始」

Thinking/Step：轻量 `<details>` 或 shadcn Collapsible；无内容不渲染。

- [ ] **Step 2: ChatComposer**

圆角容器 + Textarea；Enter 发送、Shift+Enter 换行；streaming 时显示停止按钮；禁用输入。

- [ ] **Step 3: InterruptDialog**

展示 `lastInterrupt.text` 与 buttons 标签；确认后清空。

- [ ] **Step 4: ChatPage 组装**

顶栏短 sessionId +「生成中…」pill；切换 `sessionId` 时 `clear()`。

- [ ] **Step 5: 手工流式验收**

对后端发一问，确认 thinking/content/steps 与停止可用。

- [ ] **Step 6: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add agent chat UI and composer"
```

---

### Task 9: Settings Dialog（LLM）

**Files:**
- Create: `frontend-react/src/components/layout/SettingsDialog.tsx`
- Modify: `frontend-react/src/stores/settings.ts`（完整 load/save/remove）
- Modify: `SidebarFooter` 打开设置

**Interfaces:**
- Produces: 与 Vue SettingsDialog 同等校验与 API 调用  
- `SettingsForm { provider, api_key, model, base_url }`  
- `canSave` 规则对齐 Vue（requires_base_url、已有 key 等）

- [ ] **Step 1: 补全 settings store**

对齐 Vue `stores/settings.ts`：`load` / `save` / `removeProvider` / `openSettings` / `closeSettings` / `chatProvider`。

- [ ] **Step 2: SettingsDialog UI**

shadcn Dialog；provider 选择、api_key、model、base_url；保存/删除；打开时 `load()`。

- [ ] **Step 3: 手工验收保存后聊天带 provider**

- [ ] **Step 4: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add LLM settings dialog"
```

---

### Task 10: 管理用户页

**Files:**
- Create: `frontend-react/src/pages/admin/UsersPage.tsx`
- Modify: router（已有 `/admin/users`）

**Interfaces:**
- Consumes: `listUsers` / `createUser` / `patchUser`
- Produces: 列表、创建、改角色/启用/重置密码（对齐 Vue UsersView 能力；若 Vue 有精简 UI，React 保持同等，不扩展）

- [ ] **Step 1: 阅读 Vue `UsersView.vue` 并实现同等操作**

用简单 table + Dialog 表单；主色青绿。页面包在 AppShell 内。

- [ ] **Step 2: 手工验收（admin 账号）**

非 admin 访问应回到 `/chat`。

- [ ] **Step 3: `npm run build`**

Expected: PASS。

- [ ] **Step 4: Commit**

```powershell
git add frontend-react
git commit -m "feat(frontend-react): add admin users page"
```

---

### Task 11: 双轨文档与对照清单（不切换默认入口）

**Files:**
- Modify: `frontend-react/README.md`
- Modify: 根 `README.md`（若存在前端说明：增加「可选 React 对照前端」一小段，**不要**把主路径改成 React）
- Create: `docs/superpowers/plans/checklists/2026-09-10-react-vue-parity.md`（对照清单）

**Interfaces:**
- Produces: 启动说明 + 功能对照清单；默认入口仍为 Vue

- [ ] **Step 1: 写对照清单**

勾选项：登录、bootstrap、refresh、新建会话、流式、thinking/steps、停止、interrupt、设置 LLM、admin 用户、角色守卫。

- [ ] **Step 2: 更新文档**

明确：`frontend` = 5173（当前默认），`frontend-react` = 5174（并行）。切换默认入口需满足 spec 条件并人工确认（另开任务，不在本期）。

- [ ] **Step 3: Commit**

```powershell
git add frontend-react/README.md README.md docs/superpowers/plans/checklists
git commit -m "docs: add React/Vue dual-track runbook and parity checklist"
```

---

## Spec Coverage Self-Check

| Spec 要求 | Task |
|-----------|------|
| 新建 `frontend-react` + proxy/token | 1–2 |
| 青绿浅色 SaaS | 1–2, 5–8 |
| 登录 + bootstrap | 5 |
| 路由 parity + 鉴权 | 4–5 |
| Sidebar + sessions | 6 |
| Agent Chat + Composer + 流式/thinking | 7–8 |
| Settings LLM | 9 |
| Admin users | 10 |
| Vue 保留、不切换默认入口 | 11 + Global Constraints |
| 不改后端 | Global Constraints |

## Placeholder / Consistency Scan

- 无 TBD；API 路径与 Vue 一致  
- `ocbi_refresh` / `ocbi_sessions` 跨 Task 一致  
- `chatProvider()` 在 Task 7 最小、Task 9 完整，`send` 始终调用同一方法  

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-10-frontend-react-dual-track.md`.

**Two execution options:**

1. **Subagent-Driven（推荐）** — 每任务新开子 agent，任务间审查，迭代快  
2. **Inline Execution** — 本会话按 executing-plans 批量执行并设检查点  

选哪种？
