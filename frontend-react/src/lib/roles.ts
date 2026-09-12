/** Role helpers shared by chat / settings UI. */

export const VIEWER_READONLY_DETAIL =
  '当前账号为只读（viewer），无法提问或修改模型设置'

/** admin / analyst can ask questions (stream chat). viewer is history-only. */
export function canAskData(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'analyst'
}

/** Same gate as asking: viewers must not change LLM API keys / providers. */
export function canManageLlm(role: string | null | undefined): boolean {
  return canAskData(role)
}
