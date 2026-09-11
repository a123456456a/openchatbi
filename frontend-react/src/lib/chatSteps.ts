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

/** Tool names whose successful result is already surfaced through a dedicated UI
 * element, so re-rendering the raw tool payload inline would just be noisy
 * duplication (e.g. `text2sql` returns a `"SQL Query:\n...\nQuery Results
 * (CSV format):\n..."` blob that duplicates the chart/table already rendered
 * from its `visualization` step). Errors from these tools are still shown —
 * only the successful/raw payload is suppressed. */
const REDUNDANT_RESULT_TOOL_NAMES = new Set(['text2sql'])

export function isRedundantToolResult(step: ChatStep): boolean {
  if (step.kind !== 'tool_result') return false
  const tool = typeof step.data?.tool === 'string' ? step.data.tool : ''
  return REDUNDANT_RESULT_TOOL_NAMES.has(tool)
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

/** Non-file tool results — rendered inline as markdown text, and again in the collapsed panel below.
 * Excludes redundant raw payloads (see `isRedundantToolResult`) whose content is already
 * shown through a dedicated UI element. */
export function nonFileToolSteps(steps: ChatStep[]): ChatStep[] {
  return steps.filter((s) => isToolStep(s) && !isFileResultStep(s) && !isRedundantToolResult(s))
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
