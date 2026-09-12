import { useEffect, useRef, useState } from 'react'

import { useMarkdownEnhancements } from '@/hooks/useMarkdownEnhancements'
import { cn } from '@/lib/utils'

type RenderMarkdown = (text: string) => string

let markdownModulePromise: Promise<{ renderMarkdown: RenderMarkdown }> | null = null

function loadMarkdownModule() {
  if (!markdownModulePromise) {
    // Heavy: markdown-it + highlight.js (common subset) + katex — keep out of the chat shell chunk.
    markdownModulePromise = import('@/lib/markdown')
  }
  return markdownModulePromise
}

/** Renders sanitized markdown (headings, lists, tables, code, math, mermaid, echarts, links, …) as styled HTML. */
export default function Markdown({ text, className }: { text: string; className?: string }) {
  const [html, setHtml] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  useMarkdownEnhancements(containerRef, html)

  useEffect(() => {
    if (!text) {
      setHtml('')
      return
    }
    let cancelled = false
    void loadMarkdownModule().then(({ renderMarkdown }) => {
      if (!cancelled) setHtml(renderMarkdown(text))
    })
    return () => {
      cancelled = true
    }
  }, [text])

  if (!text) return null
  return (
    <div
      ref={containerRef}
      className={cn('prose prose-sm prose-chat max-w-none break-words', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
