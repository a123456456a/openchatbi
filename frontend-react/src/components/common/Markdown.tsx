import { useMemo, useRef } from 'react'

import { useMarkdownEnhancements } from '@/hooks/useMarkdownEnhancements'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

/** Renders sanitized markdown (headings, lists, tables, code, math, mermaid, echarts, links, …) as styled HTML. */
export default function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text])
  const containerRef = useRef<HTMLDivElement | null>(null)
  useMarkdownEnhancements(containerRef, html)

  if (!text) return null
  return (
    <div
      ref={containerRef}
      className={cn('prose prose-sm prose-chat max-w-none break-words', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
