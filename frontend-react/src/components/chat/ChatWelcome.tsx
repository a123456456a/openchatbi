import { BarChart3, Sparkles, Table2, TrendingUp } from 'lucide-react'

import ChatComposer from './ChatComposer'

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: '销售趋势分析',
    description: '近7天销售走势与关键指标',
    prompt: '帮我分析最近7天的销售趋势',
  },
  {
    icon: BarChart3,
    label: '一键生成图表',
    description: '按品类汇总并可视化',
    prompt: '把上个季度各品类的销售额生成柱状图',
  },
  {
    icon: Table2,
    label: '数据表查询',
    description: '快速定位排行与明细',
    prompt: '列出销售额最高的10个商品及其分类',
  },
  {
    icon: Sparkles,
    label: '生成 SQL',
    description: '把需求翻译成可执行查询',
    prompt: '帮我写一段按月统计订单量的SQL',
  },
] as const

export default function ChatWelcome({
  value,
  onChange,
  streaming,
  onSend,
  onStop,
  sendDisabled = false,
  readOnly = false,
}: {
  value: string
  onChange: (value: string) => void
  streaming: boolean
  onSend: () => void
  onStop: () => void
  sendDisabled?: boolean
  readOnly?: boolean
}) {
  return (
    <div className="chat-canvas-bg flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="relative z-10 w-full max-w-2xl text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[var(--shadow-glow)]"
          style={{ background: 'var(--gradient-brand)' }}
          aria-hidden="true"
        >
          <Sparkles size={26} />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-foreground)] sm:text-4xl">
          嗨，需要我帮你分析什么？
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          OpenChatBI 是你的智能数据分析助手 —— 随时为你查询数据、生成 SQL 与可视化图表。
        </p>

        <div className="mt-7">
          <ChatComposer
            value={value}
            onChange={onChange}
            streaming={streaming}
            onSend={onSend}
            onStop={onStop}
            sendDisabled={sendDisabled}
            readOnly={readOnly}
            autoFocus={!readOnly}
          />
        </div>

        {!readOnly && (
        <div className="mt-6 grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
          {QUICK_PROMPTS.map(({ icon: Icon, label, description, prompt }) => (
            <button
              key={label}
              type="button"
              disabled={sendDisabled || readOnly}
              onClick={() => onChange(prompt)}
              className="group flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/80 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-float)] disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-primary)] transition-colors duration-200 group-hover:bg-[var(--color-primary)] group-hover:text-white">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{label}</span>
                <span className="block truncate text-xs text-[var(--color-muted-foreground)]">{description}</span>
              </span>
            </button>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}
