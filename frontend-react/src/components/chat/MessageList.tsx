import { Bot, Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { assistantCopyText, processSteps, toolBodyText, toolSteps } from '@/lib/chatSteps'
import type { ChatMessage } from '@/types/stream'
import Markdown from '../common/Markdown'
import StepCollapse from './StepCollapse'
import ThinkingCollapse from './ThinkingCollapse'

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
              <ThinkingCollapse thinking={m.thinking} streaming={m.streaming} />
              <StepCollapse steps={processSteps(m.steps)} />

              {m.content || toolSteps(m.steps).length > 0 ? (
                <div className="space-y-3 text-sm text-slate-800">
                  {m.content ? <Markdown text={m.content} /> : null}
                  {toolSteps(m.steps).map((s) => (
                    <Markdown key={s.id} text={toolBodyText(s)} />
                  ))}
                </div>
              ) : (
                m.streaming && !m.thinking && m.steps.length === 0 && (
                  <div className="text-sm text-[var(--color-muted-foreground)]">思考中…</div>
                )
              )}

              <StepCollapse steps={toolSteps(m.steps)} defaultOpen={false} />
            </div>

            {!m.streaming && (m.content || toolSteps(m.steps).length > 0) && (
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
