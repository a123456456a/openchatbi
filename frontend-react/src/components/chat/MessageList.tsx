import { Bot, Check, Copy } from 'lucide-react'
import { useState } from 'react'

import {
  assistantCopyText,
  extractFileDownload,
  fileResultSteps,
  nonFileToolSteps,
  toolSteps,
  visualizationSteps,
} from '@/lib/chatSteps'
import type { ChatMessage, ChatStep } from '@/types/stream'
import ChartView from './ChartView'
import FileDownloadCard from './FileDownloadCard'
import StepCollapse from './StepCollapse'
import Markdown from '../common/Markdown'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="复制回答"
      title="复制"
      className="inline-flex items-center gap-1 rounded-md p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-slate-100 hover:text-[var(--color-foreground)]"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

function visualizationDsl(step: ChatStep): Record<string, unknown> {
  const dsl = step.data?.visualization_dsl
  return dsl && typeof dsl === 'object' ? (dsl as Record<string, unknown>) : {}
}

function csvData(step: ChatStep): string | undefined {
  const data = step.data?.data
  return typeof data === 'string' ? data : undefined
}

function hasInlineArtifacts(m: ChatMessage): boolean {
  return Boolean(m.content) || toolSteps(m.steps).length > 0 || visualizationSteps(m.steps).length > 0
}

export default function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="ml-auto max-w-[75%]">
            <div className="rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-900">
              <Markdown text={m.content} />
            </div>
          </div>
        ) : (
          <div key={m.id} className="mr-auto max-w-[85%]">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)]">
              <Bot size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
              OpenChatBI
            </div>

            <div className="space-y-2.5">
              {/* Raw tool results, collapsed by default so a large payload (e.g. schema/knowledge
                  lookups) never gets forced onto the page or blocks rendering while streaming.
                  Shown above the answer body so the process trace reads top-to-bottom before the
                  final answer. */}
              <StepCollapse steps={nonFileToolSteps(m.steps)} defaultOpen={false} />

              {/* Main answer body: LLM text, then any tool-generated artifacts (charts, files)
                  rendered inline and in reading order. Raw tool results (often large JSON) are
                  never dumped here — they stay in the collapsed panel above. */}
              {hasInlineArtifacts(m) ? (
                <div className="space-y-3 text-sm text-slate-800">
                  {m.content ? <Markdown text={m.content} /> : null}

                  {visualizationSteps(m.steps).map((s) => (
                    <ChartView key={s.id} visualizationDsl={visualizationDsl(s)} csvData={csvData(s)} />
                  ))}

                  {fileResultSteps(m.steps).map((s) => {
                    const file = extractFileDownload(s)
                    return file ? <FileDownloadCard key={s.id} {...file} /> : null
                  })}
                </div>
              ) : (
                m.streaming && !m.thinking && m.steps.length === 0 && (
                  <div className="text-sm text-[var(--color-muted-foreground)]">思考中…</div>
                )
              )}
            </div>

            {!m.streaming && hasInlineArtifacts(m) && (
              <div className="mt-1.5 flex items-center gap-1">
                <CopyButton text={assistantCopyText(m.content, m.steps)} />
              </div>
            )}
          </div>
        ),
      )}
    </div>
  )
}
