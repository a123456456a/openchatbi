import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { ChatStep } from '@/types/stream'
import ChartView from './ChartView'
import Markdown from '../common/Markdown'

function StepItem({ step }: { step: ChatStep }) {
  const [open, setOpen] = useState(false)
  const visualizationDsl =
    step.kind === 'visualization' && step.data?.visualization_dsl
      ? (step.data.visualization_dsl as Record<string, unknown>)
      : null
  const csvData = step.kind === 'visualization' ? (step.data?.data as string | undefined) : undefined

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        {step.label || step.kind || '步骤'}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <Markdown text={step.text} className="text-xs leading-relaxed" />
        </div>
        {visualizationDsl && <ChartView visualizationDsl={visualizationDsl} csvData={csvData} />}
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function StepCollapse({ steps }: { steps: ChatStep[] }) {
  if (!steps.length) return null
  return (
    <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-2">
      {steps.map((s) => (
        <StepItem key={s.id} step={s} />
      ))}
    </div>
  )
}
