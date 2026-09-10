import { BarChart3, Sparkles, Table2, TrendingUp } from 'lucide-react'

import ChatComposer from './ChatComposer'

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: '近7天销售趋势', prompt: '帮我分析最近7天的销售趋势' },
  { icon: BarChart3, label: '生成图表', prompt: '把上个季度各品类的销售额生成柱状图' },
  { icon: Table2, label: '数据表查询', prompt: '列出销售额最高的10个商品及其分类' },
  { icon: Sparkles, label: '生成SQL', prompt: '帮我写一段按月统计订单量的SQL' },
] as const

export default function ChatWelcome({
  value,
  onChange,
  streaming,
  onSend,
  onStop,
}: {
  value: string
  onChange: (value: string) => void
  streaming: boolean
  onSend: () => void
  onStop: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-primary)]">
          嗨，需要我帮你分析什么？
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          OpenChatBI 是你的智能数据分析助手 —— 随时为你查询数据、生成 SQL 与可视化图表。
        </p>

        <div className="mt-6">
          <ChatComposer
            value={value}
            onChange={onChange}
            streaming={streaming}
            onSend={onSend}
            onStop={onStop}
            autoFocus
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
