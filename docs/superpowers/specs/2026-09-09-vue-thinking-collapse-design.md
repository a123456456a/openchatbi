# Vue 聊天：独立「思考过程」折叠区

日期：2026-09-09  
状态：已确认

## 背景

后端 NDJSON 流已区分：

- `token` + `is_final: false`：子 Agent 思考文本
- `token` + `is_final: true`：主答案流式文本
- `step`：工具 / SQL 等中间步骤
- `final_answer`：回合最终答案

Vue 前端当前把所有 `token` 拼进 `content`，思考与正文混在一起。工具步骤已由 `StepCollapse` 展示。用户希望思考过程有**独立折叠区**（方案 A），与工具步骤分开。

## 目标

在 Vue 聊天助手气泡中：

1. 正文只显示最终答案（`is_final` / `final_answer`）
2. 思考过程单独可折叠展示
3. 工具步骤保持现有 `StepCollapse` 行为

## 非目标

- 设置页「显示思考」开关
- 历史会话持久化 thinking / steps
- `usage` 事件展示
- 后端协议变更

## 方案

采用「消息字段 + 独立组件」（相对把 thinking 塞进 steps，或大抽 composable 更贴合现有结构）。

### 数据模型

`ChatMessage` 增加：

```ts
thinking: string  // 默认 ''
```

新建助手消息时 `thinking: ''`。

### 事件分流（`frontend/src/stores/chat.ts`）

| 事件 | 行为 |
|------|------|
| `token` 且 `is_final === false` | `assistant.thinking += text` |
| `token` 且 `is_final === true`（或缺省视为 true） | `assistant.content += text` |
| `final_answer` | 有非空 `text` 时覆盖 `content`；不修改 `thinking` |
| `step` | 不变，写入 `steps` |
| 其余 | 不变 |

缺省：若流事件未带 `is_final`，按 `true` 处理（与主答案兼容）。

### UI

组件：

- 新建 `frontend/src/components/chat/ThinkingCollapse.vue`
  - props：`thinking: string`，可选 `streaming?: boolean`
  - 无内容时不渲染
  - 标题：「思考过程」
  - 流式进行中可默认展开；结束后默认折叠
  - 样式对齐 `StepCollapse`（细字、浅底、顶部分隔线）

- 修改 `MessageList.vue` 助手气泡顺序：
  1. `content`（最终答案）
  2. `ThinkingCollapse`（有 thinking 时）
  3. `StepCollapse`（有 steps 时）

### 类型

更新 `frontend/src/types/stream.ts` 中 `ChatMessage`。

## 错误与边界

- 仅有 thinking、尚无 content：流式时保留「思考中」；结束后若仍无 content，不强制清空 thinking
- 停止 / Abort：保留已收到的 thinking 与 content
- 错误回填：仅在 `content` 为空时写入错误文案；不清除已有 thinking

## 测试（轻量）

- 手工：提问触发子 Agent 时，思考进折叠区、正文为最终答案、步骤仍在下方
- 若仓库已有前端单测习惯可补 store 分流单测；无则不强求

## 验收

- [ ] `is_final: false` 的 token 不进入 `content`
- [ ] 思考有独立折叠「思考过程」
- [ ] 工具步骤仍通过 `StepCollapse` 展示
- [ ] `final_answer` 覆盖正文且不影响 thinking
