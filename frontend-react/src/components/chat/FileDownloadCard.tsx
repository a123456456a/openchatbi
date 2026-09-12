import { FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { downloadFile, fileTypeLabel } from '@/lib/download'
import { canAskData } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth'

const VIEWER_NO_DOWNLOAD = '当前账号为只读，无法下载报表'

export default function FileDownloadCard({ url, filename, ext }: { url: string; filename: string; ext: string }) {
  const role = useAuthStore((s) => s.role)
  const canDownload = canAskData(role)
  const [state, setState] = useState<'idle' | 'downloading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function onDownload() {
    if (!canDownload) {
      setErrorMsg(VIEWER_NO_DOWNLOAD)
      setState('error')
      return
    }
    setState('downloading')
    setErrorMsg(null)
    try {
      await downloadFile(url, filename)
      setState('idle')
    } catch (e) {
      setState('error')
      setErrorMsg(e instanceof Error ? e.message : '下载失败，请重试。')
    }
  }

  return (
    <div>
      <div className="mt-2 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 shadow-[var(--shadow-card)]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-muted)] text-[var(--color-primary)]">
          <FileText size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800">{filename}</div>
          <div className="text-xs text-[var(--color-muted-foreground)]">{fileTypeLabel(ext)} · 报告已生成</div>
        </div>
        {canDownload ? (
          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={state === 'downloading'}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === 'downloading' ? <Loader2 size={14} className="animate-spin" /> : null}
            {state === 'downloading' ? '下载中…' : '下载'}
          </button>
        ) : (
          <span
            className="inline-flex shrink-0 items-center rounded-md bg-[var(--color-muted)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)]"
            title={VIEWER_NO_DOWNLOAD}
          >
            无权限
          </span>
        )}
      </div>
      {state === 'error' && (
        <div className="mt-1 text-xs text-red-600" role="alert">
          {errorMsg ?? '下载失败，请重试。'}
        </div>
      )}
    </div>
  )
}
