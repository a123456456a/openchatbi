import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { isToolStep, stepTitle, toolBodyText } from '@/lib/chatSteps'
import type { ChatStep } from '@/types/stream'
import Markdown from '../common/Markdown'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

function StepItem({ step, defaultOpen }: { step: ChatStep; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const body = isToolStep(step) ? toolBodyText(step) : step.text

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-slate-100 bg-slate-50/70">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--color-muted-foreground)]">
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        <span className="truncate">{stepTitle(step)}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 text-slate-600">
          <Markdown text={body} className="text-xs leading-relaxed" />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function StepCollapse({
  steps,
  defaultOpen = true,
}: {
  steps: ChatStep[]
  defaultOpen?: boolean
}) {
  if (!steps.length) return null
  return (
    <div className="space-y-1.5">
      {steps.map((s) => (
        <StepItem key={s.id} step={s} defaultOpen={defaultOpen} />
      ))}
    </div>
  )
}
