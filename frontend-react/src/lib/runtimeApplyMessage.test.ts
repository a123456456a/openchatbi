import { describe, expect, it } from 'vitest'

import { runtimeApplyNotice } from './runtimeApplyMessage'

describe('runtimeApplyNotice', () => {
  it('warns that activation rolled back when catalog sync failed', () => {
    const notice = runtimeApplyNotice({
      catalog_sync_status: 'failed',
      index_reload_status: 'skipped',
      message: 'catalog schema sync failed; activation rolled back',
    })
    expect(notice.tone).toBe('warning')
    expect(notice.text).toContain('激活已回滚')
  })
})
