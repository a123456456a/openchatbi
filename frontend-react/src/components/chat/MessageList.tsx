import { Bot, Check, Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useStickToBottom } from '@/hooks/useStickToBottom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
      className="inline-flex items-center gap-1 rounded-md p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-primary)]"
    >
      {copied ? <Check size={14} className="text-[var(--color-primary)]" /> : <Copy size={14} />}
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
  // Prefer content signature over length so streaming token updates also trigger stick scroll.
  const watchKey = useMemo(
    () =>
      messages
        .map((m) => `${m.id}:${m.content.length}:${m.thinking?.length ?? 0}:${m.steps.length}:${m.streaming ? 1 : 0}`)
        .join('|'),
    [messages],
  )
  const { containerRef, contentRef, onScroll, pinToBottom } = useStickToBottom(watchKey)

  // New user turn should always pin to bottom (user just sent).
  const lastUserId = [...messages].reverse().find((m) => m.role === 'user')?.id
  useEffect(() => {
    if (lastUserId) pinToBottom()
  }, [lastUserId, pinToBottom])

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="scroll-thin chat-canvas-bg flex-1 space-y-6 overflow-y-auto px-6 py-6"
    >
      <div ref={contentRef} className="space-y-6">
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="msg-in relative z-10 ml-auto max-w-[75%]">
            <div className="rounded-2xl rounded-tr-sm bg-[var(--color-primary)]/8 px-4 py-2.5 text-sm text-slate-900 shadow-sm">
              <Markdown text={m.content} />
            </div>
          </div>
        ) : (
          <div key={m.id} className="msg-in relative z-10 mr-auto max-w-[85%]">
            <div className="mb-2 flex items-center gap-2">
              <Avatar className="h-6 w-6 shrink-0 shadow-sm" size="sm">
                <AvatarFallback className="text-white" style={{ background: 'var(--gradient-brand)' }}>
                  <Bot size={13} />
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-[var(--color-muted-foreground)]">OpenChatBI</span>
            </div>

            <div className="space-y-2.5 pl-8">
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
                  <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
                    <span className="flex items-center gap-1" aria-hidden="true">
                      <span
                        className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
                        style={{ animationDelay: '160ms' }}
                      />
                      <span
                        className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
                        style={{ animationDelay: '320ms' }}
                      />
                    </span>
                    思考中…
                  </div>
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
    </div>
  )
}
