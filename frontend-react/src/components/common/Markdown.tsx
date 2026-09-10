import { useMemo } from 'react'

import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

/** Renders sanitized markdown (headings, lists, tables, code, links, …) as styled HTML. */
export default function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text])
  if (!text) return null
  return (
    <div
      className={cn('prose prose-sm prose-chat max-w-none break-words', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
