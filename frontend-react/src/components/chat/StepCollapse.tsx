import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { ChatStep } from '@/types/stream'
import ChartView from './ChartView'
import Markdown from '../common/Markdown'

/**
 * `tool` / `tool_call` / `sub_agent` steps only announce that the model is
 * about to invoke something — they carry no result and just add noise, so
 * the UI never renders them. Everything else (`tool_result`, `sql`,
 * `execute_sql`, `visualization`, `tables`, `confidence`, `tool_error`, ...)
 * is an actual outcome the user should be able to see.
 */
const HIDDEN_STEP_KINDS = new Set(['tool', 'tool_call', 'sub_agent'])

function StepItem({ step }: { step: ChatStep }) {
  // Results are shown expanded by default so they're visible without an extra click.
  const [open, setOpen] = useState(true)
  const visualizationDsl =
    step.kind === 'visualization' && step.data?.visualization_dsl
      ? (step.data.visualization_dsl as Record<string, unknown>)
      : null
  const csvData = step.kind === 'visualization' ? (step.data?.data as string | undefined) : undefined

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-slate-100 bg-slate-50/70">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--color-muted-foreground)]">
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        <span className="truncate">{step.label || step.kind || '结果'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 text-slate-600">
          <Markdown text={step.text} className="text-xs leading-relaxed" />
        </div>
        {visualizationDsl && (
          <div className="px-3 pb-3">
            <ChartView visualizationDsl={visualizationDsl} csvData={csvData} />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function StepCollapse({ steps }: { steps: ChatStep[] }) {
  const visibleSteps = steps.filter((s) => !HIDDEN_STEP_KINDS.has(s.kind))
  if (!visibleSteps.length) return null
  return (
    <div className="space-y-1.5">
      {visibleSteps.map((s) => (
        <StepItem key={s.id} step={s} />
      ))}
    </div>
  )
}
