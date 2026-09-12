import { http } from '@/api/http'

/** Map backend download failures to short, user-facing Chinese copy. */
export async function downloadErrorMessage(res: Response): Promise<string> {
  if (res.status === 401) return '登录已过期，请重新登录后再下载'
  if (res.status === 403) return '当前账号无权限下载报表'
  if (res.status === 404) return '报表不存在或已过期'

  try {
    const body = (await res.clone().json()) as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail.trim()) {
      if (body.detail === 'Forbidden') return '当前账号无权限下载报表'
      return body.detail
    }
  } catch {
    /* non-JSON error body */
  }

  return `下载失败：HTTP ${res.status}`
}

/**
 * Download a backend-protected file (e.g. `/api/download/report/...`) and save it client-side.
 *
 * A plain `<a href>` can't carry the app's Bearer access token, so this fetches the file with
 * the authenticated `http()` helper, then triggers a save via a short-lived object URL.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await http(url)
  if (!res.ok) {
    throw new Error(await downloadErrorMessage(res))
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const EXT_LABELS: Record<string, string> = {
  docx: 'Word 文档',
  xlsx: 'Excel 表格',
  csv: 'CSV 数据',
  md: 'Markdown',
  txt: '文本',
  json: 'JSON',
  html: 'HTML',
  xml: 'XML',
}

export function fileTypeLabel(ext: string): string {
  return EXT_LABELS[ext.toLowerCase()] ?? ext.toUpperCase()
}
