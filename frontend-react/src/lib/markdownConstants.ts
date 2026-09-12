/** Fence languages rendered as interactive widgets (post-processed after `dangerouslySetInnerHTML`). */
export const MERMAID_LANG = 'mermaid'
export const ECHARTS_LANG = 'echarts'
export const ECHARTS_BLOCK_CLASS = 'echarts-block'
export const ECHARTS_OPTION_ATTR = 'data-option'
export const MERMAID_BLOCK_CLASS = 'mermaid'

/** Decode a base64 payload written by `encodeOption` in `markdown.ts` back into the original UTF-8 string. */
export function decodeOption(encoded: string): string {
  try {
    return decodeURIComponent(escape(window.atob(encoded)))
  } catch {
    return ''
  }
}
