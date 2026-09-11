import mermaid from 'mermaid'

import echarts, { type ECharts } from '../lib/echartsSetup'
import { decodeOption, ECHARTS_BLOCK_CLASS, ECHARTS_OPTION_ATTR, MERMAID_BLOCK_CLASS } from '../lib/markdown'

let mermaidInitialized = false

function ensureMermaidInitialized() {
  if (mermaidInitialized) return
  mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' })
  mermaidInitialized = true
}

/**
 * Upgrade the inert `<pre class="mermaid">`/`<div class="echarts-block">` markup produced by
 * `renderMarkdown()` into live diagrams/charts. Call after the sanitized HTML is mounted
 * (e.g. in a `watch(html, …, { flush: 'post' })`).
 *
 * Returns a cleanup function that disposes any ECharts instances created for `container`,
 * which callers should invoke before the next render pass or on unmount to avoid leaking them.
 */
export async function enhanceMarkdown(container: HTMLElement | null | undefined): Promise<() => void> {
  if (!container) return () => {}

  const instances: ECharts[] = []

  const echartsBlocks = container.querySelectorAll<HTMLElement>(`.${ECHARTS_BLOCK_CLASS}[${ECHARTS_OPTION_ATTR}]`)
  echartsBlocks.forEach((el) => {
    const encoded = el.getAttribute(ECHARTS_OPTION_ATTR)
    if (!encoded) return
    const raw = decodeOption(encoded)
    try {
      const option = JSON.parse(raw)
      el.innerHTML = ''
      el.style.height = el.style.height || '360px'
      el.style.width = '100%'
      const chart = echarts.init(el)
      chart.setOption(option)
      instances.push(chart)
    } catch {
      el.innerHTML = `<div class="echarts-block-error">⚠️ 图表配置解析失败</div>`
    }
  })

  const mermaidBlocks = container.querySelectorAll<HTMLElement>(`pre.${MERMAID_BLOCK_CLASS}`)
  if (mermaidBlocks.length > 0) {
    ensureMermaidInitialized()
    try {
      await mermaid.run({ nodes: Array.from(mermaidBlocks) })
    } catch {
      mermaidBlocks.forEach((el) => {
        if (!el.querySelector('svg')) el.textContent = '⚠️ 流程图渲染失败'
      })
    }
  }

  if (instances.length === 0) return () => {}

  const resizeHandler = () => instances.forEach((chart) => chart.resize())
  window.addEventListener('resize', resizeHandler)

  return () => {
    window.removeEventListener('resize', resizeHandler)
    instances.forEach((chart) => chart.dispose())
  }
}
