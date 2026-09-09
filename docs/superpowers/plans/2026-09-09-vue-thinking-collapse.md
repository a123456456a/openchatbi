# Vue Thinking Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Vue 聊天助手气泡中把子 Agent 思考过程（`token.is_final === false`）与最终答案分开，用独立折叠区「思考过程」展示。

**Architecture:** `ChatMessage` 增加 `thinking` 字符串；`chat` store 按 `is_final` 分流 token；新建 `ThinkingCollapse.vue`；`MessageList` 顺序为正文 → 思考 → 工具步骤。不改后端协议。

**Tech Stack:** Vue 3 Composition API（`<script setup lang="ts">`）、Pinia、Element Plus `el-collapse`、现有 NDJSON chat stream

**Spec:** `docs/superpowers/specs/2026-09-09-vue-thinking-collapse-design.md`

## Global Constraints

- 仅改 Vue 前端；不改 `openchatbi/streaming.py` / API
- 无内容不渲染思考折叠区
- `final_answer` 只覆盖 `content`，不碰 `thinking`
- `token` 缺省 `is_final` 时按 `true`（写入 content）
- 错误回填仅在 `content` 为空时写入；不清除 thinking
- 不做设置开关、历史持久化、usage 展示
- Windows PowerShell：串联命令用 `;` 不用 `&&`
- 提交用 conventional commits；未要求时不要 push
- 仓库无前端单测框架：以 `pnpm exec vue-tsc -b` + 手工验收代替单元测试

---

## File Structure

```
frontend/src/
  types/stream.ts                          # ChatMessage + thinking
  stores/chat.ts                           # token 分流；新建消息带 thinking: ''
  components/chat/ThinkingCollapse.vue     # 新建：思考折叠
  components/chat/MessageList.vue          # 挂载 ThinkingCollapse
  components/chat/StepCollapse.vue         # 不改（仅对照样式）
```

---

### Task 1: 类型与 store 分流

**Files:**
- Modify: `frontend/src/types/stream.ts`
- Modify: `frontend/src/stores/chat.ts`

**Interfaces:**
- Produces:
  - `ChatMessage.thinking: string`
  - 新建 user/assistant 消息均带 `thinking: ''`（user 可空字符串以保持类型一致）
  - `applyEvent` 对 `token`：`event.is_final === false` → `thinking += text`；否则 → `content += text`

- [ ] **Step 1: 更新 `ChatMessage` 类型**

在 `frontend/src/types/stream.ts` 的 `ChatMessage` 中增加字段：

```ts
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking: string
  steps: ChatStep[]
  streaming?: boolean
}
```

- [ ] **Step 2: 新建消息初始化 `thinking`**

在 `frontend/src/stores/chat.ts` 的 `send` 中，`userMsg` 与 assistant 占位消息都加 `thinking: ''`：

```ts
const userMsg: ChatMessage = {
  id: uid(),
  role: 'user',
  content: input.trim(),
  thinking: '',
  steps: [],
}
messages.value.push(userMsg)

messages.value.push({
  id: uid(),
  role: 'assistant',
  content: '',
  thinking: '',
  steps: [],
  streaming: true,
})
```

- [ ] **Step 3: 按 `is_final` 分流 token**

把 `applyEvent` 里原来的：

```ts
} else if (event.type === 'token') {
  assistant.content += String(event.text ?? '')
}
```

替换为：

```ts
} else if (event.type === 'token') {
  const text = String(event.text ?? '')
  if (event.is_final === false) {
    assistant.thinking += text
  } else {
    assistant.content += text
  }
}
```

保持 `final_answer`、`step`、`interrupt`、错误回填逻辑不变（错误仍只写 `content`）。

- [ ] **Step 4: 类型检查**

Run（在 `frontend` 目录）:

```powershell
pnpm exec vue-tsc -b --pretty false
```

Expected: 无因缺少 `thinking` 导致的类型错误；若其它文件构造了 `ChatMessage` 字面量，一并补上 `thinking: ''`。

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/types/stream.ts frontend/src/stores/chat.ts
git commit -m "feat(frontend): 按 is_final 分流思考与答案 token"
```

---

### Task 2: ThinkingCollapse 组件与 MessageList 挂载

**Files:**
- Create: `frontend/src/components/chat/ThinkingCollapse.vue`
- Modify: `frontend/src/components/chat/MessageList.vue`

**Interfaces:**
- Consumes: `ChatMessage.thinking: string`，`ChatMessage.streaming?: boolean`
- Produces: `ThinkingCollapse` props `{ thinking: string; streaming?: boolean }`

- [ ] **Step 1: 新建 `ThinkingCollapse.vue`**

创建 `frontend/src/components/chat/ThinkingCollapse.vue`（样式对齐 `StepCollapse.vue`）：

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  thinking: string
  streaming?: boolean
}>()

const activeNames = ref<string[]>([])

watch(
  () => [props.thinking, props.streaming] as const,
  ([text, streaming]) => {
    if (!text) {
      activeNames.value = []
      return
    }
    if (streaming) {
      activeNames.value = ['thinking']
    } else if (activeNames.value.includes('thinking') && !streaming) {
      // 流结束后默认折叠；若用户已手动折叠则保持
      activeNames.value = []
    }
  },
  { immediate: true },
)

const visible = computed(() => Boolean(props.thinking))
</script>

<template>
  <div v-if="visible" class="mt-3 space-y-1 border-t border-slate-100 pt-2">
    <el-collapse v-model="activeNames" class="thinking-collapse">
      <el-collapse-item title="思考过程" name="thinking">
        <pre
          class="m-0 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600"
          >{{ thinking }}</pre
        >
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.thinking-collapse :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 36px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-muted-foreground);
  background: transparent;
  border: none;
  line-height: 1.4;
  padding: 4px 0;
}

.thinking-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

.thinking-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 8px;
}

.thinking-collapse :deep(.el-collapse) {
  border: none;
}
</style>
```

说明：流式时 `streaming === true` 且有文本则展开；`streaming` 变为 `false` 时折叠。用户手动展开后若未再触发 watch 的折叠分支即可保留（上述 watch 在结束后主动清空 `activeNames`，符合 spec「结束后默认折叠」）。

- [ ] **Step 2: 在 `MessageList.vue` 挂载**

1. import：

```ts
import ThinkingCollapse from './ThinkingCollapse.vue'
```

2. 助手气泡内，在 `content` 与 `StepCollapse` 之间插入：

```vue
<div class="whitespace-pre-wrap break-words">
  {{ m.content || (m.streaming ? '' : '') }}
</div>
<ThinkingCollapse
  v-if="m.role === 'assistant'"
  :thinking="m.thinking"
  :streaming="m.streaming"
/>
<StepCollapse v-if="m.role === 'assistant'" :steps="m.steps" />
```

- [ ] **Step 3: 类型检查 / 构建**

Run（在 `frontend` 目录）:

```powershell
pnpm exec vue-tsc -b --pretty false
```

Expected: PASS（exit 0）

- [ ] **Step 4: 手工验收清单（实现者勾选）**

在本地 `pnpm dev` + 后端流式聊天中验证：

1. 出现子 Agent 思考 token 时，正文不含思考碎片；折叠区标题为「思考过程」
2. 流式中折叠默认展开，结束后折叠
3. 工具步骤仍在 `StepCollapse`
4. 最终答案正确；`final_answer` 覆盖后 thinking 仍在

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/chat/ThinkingCollapse.vue frontend/src/components/chat/MessageList.vue
git commit -m "feat(frontend): 添加思考过程独立折叠展示"
```

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| `ChatMessage.thinking` | Task 1 |
| token 按 `is_final` 分流 | Task 1 |
| `final_answer` 不碰 thinking | Task 1（保持原逻辑） |
| `ThinkingCollapse` 独立折叠 | Task 2 |
| 气泡顺序：答案 → 思考 → 步骤 | Task 2 |
| 流式展开 / 结束后折叠 | Task 2 |
| 无开关 / 无历史持久化 / 无 usage | 全局约束（不做） |

## Self-Review

- 无 TBD / 占位步骤
- 类型名与 props 在两任务间一致：`thinking: string`，`streaming?: boolean`
- 无前端测试框架；验证手段为 `vue-tsc` + 手工清单，与 spec「轻量测试」一致
