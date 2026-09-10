import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

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
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3 border-t border-slate-100 pt-2">
      <CollapsibleTrigger className="flex w-full items-center gap-1 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        思考过程
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="m-0 mt-1 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {thinking}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
