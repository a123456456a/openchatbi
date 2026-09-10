# OpenChatBI 前端双轨重设计（React 并行）

**日期：** 2026-09-10  
**状态：** 待实现（设计已评审同意）  
**范围：** 新建 React 前端与现有 Vue 前端并行；视觉采用 21st.dev「方案 1：Agent 工作台风」

## 背景与目标

现有 `frontend/` 为 Vue 3 + Element Plus + Tailwind，整体偏蓝白工具感。目标是用更现代的浅色 SaaS 视觉（青绿强调色）替换整站 UI，并更好对接 21st.dev / shadcn 生态。

经权衡后采用 **双轨策略**：

- 保留 Vue 前端作对照与回退
- 新建 React 前端作为主交付与长期方向
- 同一后端 API；达标且人工确认后再切换默认入口

## 决策摘要

| 项 | 选择 |
|----|------|
| 范围 | 整站（登录 + 壳层 + 聊天 + 设置/管理） |
| 视觉方向 | 现代浅色 SaaS（偏 Linear / Notion） |
| 强调色 | 青绿 / 薄荷绿（约 teal-700 `#0F766E`） |
| 落地方式 | 双轨：新建 `frontend-react/`，Vue 暂留 |
| 21st 方案 | 方案 1「Agent 工作台风」 |

## 21st.dev 组件参考（方案 1）

| 区域 | 参考 | 用途 |
|------|------|------|
| 登录 | Clean & Minimal sign in（preetsuthar17） | 居中极简登录卡 |
| 登录氛围 | mint / teal glow 背景类组件 | 仅登录页弱渐变/光晕 |
| 侧栏 | Sidebar Light（inference-sh） | 会话列表壳层 |
| 聊天 | Agent Chat（serafimcloud） | 消息列、空状态、错误态 |
| 输入 | Input Bar（serafimcloud） | Composer、发送/停止 |

不整包依赖 React 以外的运行时假设；以 shadcn/ui 为底座，按需安装/裁剪 21st 组件。

## 架构

### 仓库布局

```
frontend/           # 现有 Vue（冻结新功能；仅修 blocker）
frontend-react/     # 新建 React 前端（本期主交付）
docs/superpowers/specs/  # 本设计
```

### React 技术栈

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- React Router（路由 parity 见下）
- Zustand（职责对齐现有 Pinia stores）
- 开发代理指向同一后端

### 路由 parity

| 路径 | 页面 |
|------|------|
| `/login` | 登录 + 首个管理员 bootstrap |
| `/chat`、`/chat/:sessionId` | App 壳 + 对话 |
| `/admin/users` | 用户管理（admin） |
| `/` | 重定向 `/chat` |

鉴权行为与 Vue 对齐：public 路由、refresh、角色守卫、`redirect` query。

### 逻辑模块映射（代码不共享）

| Vue | React |
|-----|--------|
| `stores/auth` + oauth / bootstrap API | auth store + 同端点 |
| `stores/chat` + `/api/chat/stream` NDJSON | chat store + 同协议 |
| `stores/sessions` | sessions store |
| `SettingsDialog` + `/api/me/llm-settings` | Settings Dialog |
| `UsersView` + `/api/users` | Admin Users |

可共享的只有：**API 契约**与**设计 token 约定**；Vue 与 React 组件代码不互相复用或自动转译。

## 视觉与 Token

- 主色：`#0F766E`（teal-700），悬停略深
- 背景：近白 `#FAFBFC`；卡片纯白；边框极淡灰
- 侧栏：白底；激活项淡青绿底 + 左侧 3px 强调条
- 用户气泡：浅青绿实底；助手：白底细边框
- 圆角约 10–12px；阴影极轻，靠边框分层
- 字体：现代无衬线 + 中文系统回退

## 页面设计要点

### 登录

- 居中窄卡片；品牌 OpenChatBI + 副文案
- 全屏弱 mint/teal 氛围；卡片白底细边框
- 用户名 / 密码；主按钮登录；bootstrap 为次要操作

### AppShell / 侧栏

- 宽约 260px：品牌 → 新建会话 → 会话列表 → 底栏（用户菜单 + 设置）
- 主内容区浅灰底，与侧栏白底分层

### 聊天主区

- 顶栏极简：会话标识 + 流式状态
- 消息列 + Thinking / Step 折叠（保留能力，样式变轻）
- 底部 Input Bar 风格 Composer；Enter 发送 / 停止逻辑与现网一致

### 设置与管理

- shadcn Dialog + 表单；管理页轻量表格；主色青绿

## 实施节奏

1. 脚手架：`frontend-react` + token + proxy  
2. 鉴权：登录 / refresh / bootstrap / 路由守卫  
3. 壳层：Sidebar Light 结构  
4. 聊天：Agent Chat + Input Bar + NDJSON 流式  
5. 设置 + 管理用户  
6. 与 Vue 对照验收；**显式确认后**再切默认入口  

## 切换默认入口的条件

须全部满足，且产品负责人确认：

1. 路由与功能与 Vue 行为一致（含角色跳转）  
2. 视觉统一为浅色 + 青绿（方案 1）  
3. 构建与关键路径冒烟通过  
4. 启动文档写明双前端；切换步骤可回退  

切换前 Vue 保持可启动。

## 明确不做（本期）

- 不删除 Vue 前端  
- 不修改后端 API / 鉴权 / 流式协议  
- 不做暗色模式、营销落地页、社交 IM 能力（表情/已读等）  
- 不把 Vue 组件自动转换成 React  
- 不在未确认时切换默认入口  

## 风险

| 风险 | 对策 |
|------|------|
| 流式/鉴权与 Vue 不一致 | 以现有 `frontend/src/api/*` 与 stores 为契约逐条对照 |
| 21st 组件过重 | 优先 shadcn 原语；布局参考、按需裁剪 |
| 双前端维护成本 | Vue 冻结功能；新能力只进 React |
| 过早切换入口 | 强制满足切换条件 + 人工确认 |

## 验收标准

- React 具备：登录、会话、流式对话、停止、设置 LLM、管理员用户管理  
- 视觉：浅色 SaaS + 青绿；登录 / 壳 / 聊天统一  
- 与 Vue 对照无功能回退；常见笔记本宽度下侧栏+消息区可用  
- README / 文档说明两套前端启动方式  

## 附录：曾考虑的替代方案

1. **仅 Vue 换皮 / 渐进 shadcn 风格原语** — 工期短，但 21st 还原成本高（曾作为方案 1 的 Vue 落地版同意，后改为双轨）  
2. **立即全量替换为 React 并删除 Vue** — 还原度高，但无对照、风险大  
3. **双轨并行（本文）** — 可选对照与回退，接受短期双目录成本  
