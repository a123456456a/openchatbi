import type { ConnectionRuntimeApplyStatus } from '@/api/databaseConnections'

export type RuntimeApplyNotice = {
  tone: 'success' | 'warning'
  text: string
}

/** User-facing Chinese copy for warehouse activation / catalog sync outcomes. */
export function runtimeApplyNotice(status: ConnectionRuntimeApplyStatus): RuntimeApplyNotice {
  if (status.catalog_sync_status === 'failed') {
    return {
      tone: 'warning',
      text: '同步失败，激活已回滚，请检查连接后重试',
    }
  }
  if (status.index_reload_status === 'failed') {
    return {
      tone: 'warning',
      text: '索引重建失败：catalog 已更新，但检索索引重建失败——问数可能不准',
    }
  }
  if (status.catalog_sync_status === 'success' && status.index_reload_status === 'success') {
    return {
      tone: 'success',
      text: status.message || '已切换数仓，进行中的对话上下文已重置',
    }
  }
  return { tone: 'success', text: status.message || '数仓已激活' }
}
