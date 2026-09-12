import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/api/http', () => ({
  http: vi.fn(),
}))

import { http } from '@/api/http'
import { downloadErrorMessage, downloadFile } from './download'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('downloadErrorMessage', () => {
  it('maps 403 / Forbidden to a clear permission message', async () => {
    expect(await downloadErrorMessage(jsonResponse(403, { detail: 'Forbidden' }))).toBe(
      '当前账号无权限下载报表',
    )
    expect(await downloadErrorMessage(new Response('', { status: 403 }))).toBe('当前账号无权限下载报表')
  })

  it('maps 401 and 404', async () => {
    expect(await downloadErrorMessage(new Response('', { status: 401 }))).toMatch(/登录已过期/)
    expect(await downloadErrorMessage(new Response('', { status: 404 }))).toMatch(/不存在或已过期/)
  })

  it('prefers backend detail when present', async () => {
    expect(await downloadErrorMessage(jsonResponse(500, { detail: '报表生成失败' }))).toBe('报表生成失败')
  })
})

describe('downloadFile', () => {
  beforeEach(() => {
    vi.mocked(http).mockReset()
  })

  it('throws the mapped message and does not save on failure', async () => {
    vi.mocked(http).mockResolvedValue(jsonResponse(403, { detail: 'Forbidden' }))
    await expect(downloadFile('/api/download/report/x.docx', 'x.docx')).rejects.toThrow(
      '当前账号无权限下载报表',
    )
  })
})
