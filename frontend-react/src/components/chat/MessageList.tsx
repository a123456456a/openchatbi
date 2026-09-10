import type { ChatMessage } from '@/types/stream'
import StepCollapse from './StepCollapse'
import ThinkingCollapse from './ThinkingCollapse'

export default function MessageList({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-4 text-sm text-[var(--color-muted-foreground)]">
        输入数据分析问题开始
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
      {messages.map((m) => (
        <div key={m.id} className={'max-w-3xl ' + (m.role === 'user' ? 'ml-auto' : 'mr-auto')}>
          <div
            className={
              'rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ' +
              (m.role === 'user'
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--color-border)] bg-white text-slate-800')
            }
          >
            <div className="mb-1 text-xs opacity-70">
              {m.role === 'user' ? '你' : '助手'}
              {m.streaming ? ' …' : ''}
            </div>
            <div className="whitespace-pre-wrap break-words">
              {m.content || (m.streaming ? '思考中…' : '')}
            </div>
            {m.role === 'assistant' && <ThinkingCollapse thinking={m.thinking} streaming={m.streaming} />}
            {m.role === 'assistant' && <StepCollapse steps={m.steps} />}
          </div>
        </div>
      ))}
    </div>
  )
}
