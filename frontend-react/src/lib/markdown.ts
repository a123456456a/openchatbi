import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import MarkdownIt, { type RendererRule } from 'markdown-it'
import deflist from 'markdown-it-deflist'
import footnote from 'markdown-it-footnote'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import taskLists from 'markdown-it-task-lists'
import texmath from 'markdown-it-texmath'

import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'

import {
  ECHARTS_BLOCK_CLASS,
  ECHARTS_LANG,
  ECHARTS_OPTION_ATTR,
  MERMAID_BLOCK_CLASS,
  MERMAID_LANG,
} from '@/lib/markdownConstants'

export {
  ECHARTS_BLOCK_CLASS,
  ECHARTS_LANG,
  ECHARTS_OPTION_ATTR,
  MERMAID_BLOCK_CLASS,
  MERMAID_LANG,
  decodeOption,
} from '@/lib/markdownConstants'

const md: InstanceType<typeof MarkdownIt> = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, lang: string): string {
    const language = lang && hljs.getLanguage(lang) ? lang : undefined
    try {
      // Prefer an explicit fence language; fall back to auto among the common subset
      // (not the full 190+ language dump) so unknown fences still get some coloring.
      const result = language ? hljs.highlight(code, { language }) : hljs.highlightAuto(code)
      return `<pre class="hljs"><code>${result.value}</code></pre>`
    } catch {
      return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
    }
  },
})

md.use(taskLists, { enabled: true, label: true })
md.use(footnote)
md.use(mark)
md.use(sub)
md.use(sup)
md.use(deflist)
md.use(texmath.use(katex), { delimiters: 'dollars' })

/** Base64-encode a UTF-8 string so JSON option payloads survive HTML attribute serialization. */
function encodeOption(raw: string): string {
  try {
    return window.btoa(unescape(encodeURIComponent(raw)))
  } catch {
    return ''
  }
}

// Fenced ```mermaid``` blocks render as diagrams and ```echarts``` blocks (a JSON ECharts
// `option`) render as interactive charts; both are inert markup here and get upgraded to
// live widgets by `useMarkdownEnhancements()` once the sanitized HTML is mounted in the DOM.
const defaultFence: RendererRule =
  md.renderer.rules.fence ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const lang = (token.info || '').trim().split(/\s+/)[0]?.toLowerCase()

  if (lang === MERMAID_LANG) {
    return `<pre class="${MERMAID_BLOCK_CLASS}">${md.utils.escapeHtml(token.content)}</pre>`
  }
  if (lang === ECHARTS_LANG) {
    const encoded = encodeOption(token.content)
    return `<div class="${ECHARTS_BLOCK_CLASS}" ${ECHARTS_OPTION_ATTR}="${encoded}"><div class="echarts-block-fallback">图表加载中…</div></div>`
  }
  return defaultFence(tokens, idx, options, env, self)
}

// Open links in a new tab without letting markdown content take over the
// current window via `rel`-less `target="_blank"`.
const defaultLinkOpen: RendererRule =
  md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

const SANITIZE_CONFIG = {
  ADD_ATTR: ['target', ECHARTS_OPTION_ATTR, 'checked', 'disabled'],
  USE_PROFILES: { html: true, mathMl: true, svg: true, svgFilters: true },
}

/** Render untrusted markdown text (GFM tables, task lists, footnotes, math, code, mermaid,
 * echarts, …) to sanitized HTML safe for `dangerouslySetInnerHTML`. */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  const html = md.render(text)
  return DOMPurify.sanitize(html, SANITIZE_CONFIG)
}
