import { ChevronDown, Lightbulb } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import Markdown from '../common/Markdown'

export default function ThinkingCollapse({
  thinking,
  streaming,
}: {
  thinking: string
  streaming?: boolean
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!thinking) {
      setOpen(false)
      return
    }
    // Auto-expand while streaming; auto-collapse once the stream settles.
    setOpen(!!streaming)
  }, [thinking, streaming])

  if (!thinking) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-slate-100 bg-slate-50/70">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--color-muted-foreground)]">
        <Lightbulb size={14} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">思考过程{streaming ? '…' : ''}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 text-slate-600">
          <Markdown text={thinking} className="text-xs leading-relaxed" />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
