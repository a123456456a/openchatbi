import type { ChatStep } from '../types/stream'

/** Invocation-only steps carry no result and are not rendered. */
export const HIDDEN_STEP_KINDS = new Set(['tool', 'tool_call', 'sub_agent'])

/** Tool outcome steps: shown collapsed after the final answer body. */
export const TOOL_STEP_KINDS = new Set(['tool_result', 'tool_error'])

export function isHiddenStep(step: ChatStep): boolean {
  return HIDDEN_STEP_KINDS.has(step.kind)
}

export function isToolStep(step: ChatStep): boolean {
  return TOOL_STEP_KINDS.has(step.kind)
}

/** SQL / visualization / tables / … — intermediate process, stay above the body. */
export function processSteps(steps: ChatStep[]): ChatStep[] {
  return steps.filter((s) => !isHiddenStep(s) && !isToolStep(s))
}

/** Successful or failed tool results — rendered in the body and as a collapsed panel. */
export function toolSteps(steps: ChatStep[]): ChatStep[] {
  return steps.filter((s) => isToolStep(s))
}

/** Full tool payload for the answer body (prefers `data.result` / `data.error` over the truncated preview). */
export function toolBodyText(step: ChatStep): string {
  const result = step.data?.result
  if (typeof result === 'string' && result) return result
  const error = step.data?.error
  if (typeof error === 'string' && error) return error
  return step.text
}

export function toolStepTitle(step: ChatStep): string {
  const tool = typeof step.data?.tool === 'string' ? step.data.tool : ''
  if (step.kind === 'tool_error') return tool ? `${tool} 失败` : '工具失败'
  return tool || '工具结果'
}

export function stepTitle(step: ChatStep): string {
  if (isToolStep(step)) return toolStepTitle(step)
  return step.label || step.kind || '结果'
}

export function assistantCopyText(content: string, steps: ChatStep[]): string {
  const bodies = toolSteps(steps).map(toolBodyText).filter(Boolean)
  return [content, ...bodies].filter(Boolean).join('\n\n')
}
