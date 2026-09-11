import type { ChatStep } from '@/types/stream'

/** Invocation-only steps carry no result and are not rendered. */
export const HIDDEN_STEP_KINDS = new Set(['tool', 'tool_call', 'sub_agent'])

/** Tool outcome steps: shown collapsed after the final answer body. */
export const TOOL_STEP_KINDS = new Set(['tool_result', 'tool_error'])

/** Matches the fixed `save_report` success message so a download card can be rendered from it,
 * regardless of which tool produced it (see `openchatbi/tool/save_report.py`). */
const DOWNLOAD_LINK_RE = /Download link:\s*(\/api\/download\/report\/([^\s)]+))/

export function isHiddenStep(step: ChatStep): boolean {
  return HIDDEN_STEP_KINDS.has(step.kind)
}

export function isToolStep(step: ChatStep): boolean {
  return TOOL_STEP_KINDS.has(step.kind)
}

export function isVisualizationStep(step: ChatStep): boolean {
  return step.kind === 'visualization'
}

export interface FileDownload {
  url: string
  filename: string
  ext: string
}

/** Extract a generated-file download link from a tool result, or `null` if it has none. */
export function extractFileDownload(step: ChatStep): FileDownload | null {
  if (!isToolStep(step)) return null
  const text = toolBodyText(step)
  const match = DOWNLOAD_LINK_RE.exec(text)
  if (!match) return null
  const [, url, filename] = match
  const ext = filename.includes('.') ? filename.split('.').pop() ?? '' : ''
  return { url, filename, ext }
}

export function isFileResultStep(step: ChatStep): boolean {
  return extractFileDownload(step) !== null
}

/** SQL / tables / rewrite / confidence — intermediate process, stays in the collapsed "过程" panel above the body.
 * Visualization and file-download results are excluded: they render inline in the main body instead. */
export function processSteps(steps: ChatStep[]): ChatStep[] {
  return steps.filter((s) => !isHiddenStep(s) && !isToolStep(s) && !isVisualizationStep(s))
}

/** Visualization steps — rendered inline in the answer body as charts/tables, not in a collapsed panel. */
export function visualizationSteps(steps: ChatStep[]): ChatStep[] {
  return steps.filter(isVisualizationStep)
}

/** Successful or failed tool results — rendered in the body and (non-file ones) again as a collapsed panel. */
export function toolSteps(steps: ChatStep[]): ChatStep[] {
  return steps.filter((s) => isToolStep(s))
}

/** File-producing tool results (e.g. `save_report`) — rendered inline as a download card. */
export function fileResultSteps(steps: ChatStep[]): ChatStep[] {
  return steps.filter((s) => isToolStep(s) && isFileResultStep(s))
}

/** Non-file tool results — shown only in the collapsed "工具结果" panel below the answer body,
 * never dumped directly into the main answer (raw tool payloads are often large JSON that is
 * both unreadable as prose and expensive to run through the full markdown pipeline). */
export function nonFileToolSteps(steps: ChatStep[]): ChatStep[] {
  return steps.filter((s) => isToolStep(s) && !isFileResultStep(s))
}

/** Full tool payload for the answer body (prefers `data.result` / `data.error` over the truncated preview). */
export function toolBodyText(step: ChatStep): string {
  const result = step.data?.result
  if (typeof result === 'string' && result) return result
  const error = step.data?.error
  if (typeof error === 'string' && error) return error
  return step.text
}

/** Upper bound on how much raw tool-result text is ever rendered. Structured schema/knowledge
 * lookups can return several KB of nested JSON; without a cap that text gets fully parsed by
 * the markdown pipeline (and painted into the DOM) on every render, which is what causes the
 * page to stutter once a tool returns a large payload. */
const MAX_TOOL_BODY_LENGTH = 4000

function truncateBody(text: string): string {
  if (text.length <= MAX_TOOL_BODY_LENGTH) return text
  return `${text.slice(0, MAX_TOOL_BODY_LENGTH)}\n…（已截断，完整内容共 ${text.length} 字符，可点击“复制回答”获取全文）`
}

/** `true` for payloads that look like a JSON object/array (as opposed to plain prose text such
 * as business-knowledge glossary entries, which should keep rendering as normal markdown). */
function looksLikeJson(text: string): boolean {
  return /^[[{]/.test(text)
}

/**
 * Render a tool result body safely: JSON-shaped payloads (the common case for schema/knowledge
 * lookup tools) are pretty-printed and fenced as a code block instead of being parsed as
 * markdown prose — this avoids both the unreadable/garbled output from markdown mis-interpreting
 * `_`/`*` inside field names, and the performance cost of running the full markdown pipeline
 * (linkify, emphasis, texmath, …) over a long, single-line JSON string. Non-JSON text results
 * still render as regular markdown so intentionally formatted content (e.g. business knowledge)
 * keeps its formatting.
 */
export function formatToolBody(step: ChatStep): string {
  const raw = toolBodyText(step)
  if (!raw) return raw
  const trimmed = raw.trim()
  if (!looksLikeJson(trimmed)) return truncateBody(raw)

  let pretty = trimmed
  try {
    pretty = JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    // Not strictly valid JSON (e.g. a Python dict/list repr with single quotes) — still fence
    // it as a code block below so it renders as monospaced data rather than markdown prose.
  }
  return '```json\n' + truncateBody(pretty) + '\n```'
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
