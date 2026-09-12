import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/download', async () => {
  const actual = await vi.importActual<typeof import('@/lib/download')>('@/lib/download')
  return {
    ...actual,
    downloadFile: vi.fn(),
  }
})

import { downloadFile } from '@/lib/download'
import { useAuthStore } from '@/stores/auth'
import FileDownloadCard from './FileDownloadCard'

describe('FileDownloadCard', () => {
  beforeEach(() => {
    vi.mocked(downloadFile).mockReset()
    useAuthStore.setState({
      role: 'analyst',
      isAuthenticated: true,
      accessToken: 't',
      userId: 'u',
      username: 'a',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('hides the download button for viewer and shows 无权限', () => {
    useAuthStore.setState({ role: 'viewer' })
    render(<FileDownloadCard url="/api/download/report/a.docx" filename="a.docx" ext="docx" />)
    expect(screen.queryByRole('button', { name: '下载' })).toBeNull()
    expect(screen.getByText('无权限')).toBeVisible()
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('shows the readable error when downloadFile fails', async () => {
    vi.mocked(downloadFile).mockRejectedValue(new Error('当前账号无权限下载报表'))
    render(<FileDownloadCard url="/api/download/report/a.docx" filename="a.docx" ext="docx" />)
    fireEvent.click(screen.getByRole('button', { name: '下载' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('当前账号无权限下载报表')
  })

  it('lets analyst download successfully', async () => {
    vi.mocked(downloadFile).mockResolvedValue(undefined)
    render(<FileDownloadCard url="/api/download/report/a.docx" filename="a.docx" ext="docx" />)
    fireEvent.click(screen.getByRole('button', { name: '下载' }))
    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith('/api/download/report/a.docx', 'a.docx'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
