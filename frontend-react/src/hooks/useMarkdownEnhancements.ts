import { useEffect } from 'react'

import {
  decodeOption,
  ECHARTS_BLOCK_CLASS,
  ECHARTS_OPTION_ATTR,
  MERMAID_BLOCK_CLASS,
} from '@/lib/markdownConstants'

type EChartsInstance = { resize: () => void; dispose: () => void; setOption: (option: unknown) => void }

let mermaidInitialized = false

/**
 * Upgrade the inert `<pre class="mermaid">`/`<div class="echarts-block">` markup produced by
 * `renderMarkdown()` into live diagrams/charts, once the sanitized HTML is mounted in
 * `containerRef`. Re-runs whenever `html` changes (e.g. streamed tokens updating the answer).
 *
 * Mermaid and ECharts are loaded on demand so the login / shell bundles stay free of them.
 */
export function useMarkdownEnhancements(containerRef: React.RefObject<HTMLElement | null>, html: string) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const instances: EChartsInstance[] = []
    let cancelled = false

    function disposeAll() {
      instances.forEach((chart) => chart.dispose())
      instances.length = 0
    }

    async function enhance() {
      const echartsBlocks = container!.querySelectorAll<HTMLElement>(`.${ECHARTS_BLOCK_CLASS}[${ECHARTS_OPTION_ATTR}]`)
      if (echartsBlocks.length > 0) {
        const { default: echarts } = await import('@/lib/echartsSetup')
        if (cancelled) return
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
        if (cancelled) {
          disposeAll()
          return
        }
      }

      const mermaidBlocks = container!.querySelectorAll<HTMLElement>(`pre.${MERMAID_BLOCK_CLASS}`)
      if (mermaidBlocks.length > 0) {
        const mermaid = (await import('mermaid')).default
        if (cancelled) return
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' })
          mermaidInitialized = true
        }
        try {
          await mermaid.run({ nodes: Array.from(mermaidBlocks) })
        } catch {
          if (cancelled) return
          mermaidBlocks.forEach((el) => {
            if (!el.querySelector('svg')) el.textContent = '⚠️ 流程图渲染失败'
          })
        }
      }
    }

    void enhance()

    const resizeHandler = () => instances.forEach((chart) => chart.resize())
    window.addEventListener('resize', resizeHandler)

    return () => {
      cancelled = true
      window.removeEventListener('resize', resizeHandler)
      disposeAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])
}
