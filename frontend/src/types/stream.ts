export type StreamEvent =
  | { type: 'step'; kind: string; level: number; label: string; text: string; data?: unknown }
  | { type: 'token'; level: number; label: string; is_final: boolean; text: string }
  | { type: 'interrupt'; text: string; buttons: unknown[] }
  | { type: 'usage'; turn_tokens?: number; turn_cost_usd?: number; by_model?: unknown }
  | { type: 'final_answer'; text: string }
  | { type: string; [key: string]: unknown }

export interface ChatStep {
  id: string
  kind: string
  level: number
  label: string
  text: string
  data?: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking: string
  steps: ChatStep[]
  streaming?: boolean
}
