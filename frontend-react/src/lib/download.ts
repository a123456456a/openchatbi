import { http } from '@/api/http'

/**
 * Download a backend-protected file (e.g. `/api/download/report/...`) and save it client-side.
 *
 * A plain `<a href>` can't carry the app's Bearer access token, so this fetches the file with
 * the authenticated `http()` helper, then triggers a save via a short-lived object URL.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await http(url)
  if (!res.ok) {
    throw new Error(`下载失败：HTTP ${res.status}`)
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
