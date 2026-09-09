import type { StreamEvent } from '../types/stream'

export type NdjsonHandlers = {
  onEvent: (event: StreamEvent) => void
  onError?: (err: Error) => void
  onDone?: () => void
}

/**
 * POST and parse application/x-ndjson line by line.
 */
export async function useNdjsonStream(
  url: string,
  body: unknown,
  headers: HeadersInit,
  handlers: NdjsonHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      ...Object.fromEntries(new Headers(headers).entries()),
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = (await res.json()) as { detail?: string }
      if (typeof j.detail === 'string') detail = j.detail
    } catch {
      /* ignore */
    }
    const err = new Error(detail)
    handlers.onError?.(err)
    throw err
  }

  if (!res.body) {
    const err = new Error('No response body')
    handlers.onError?.(err)
    throw err
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          handlers.onEvent(JSON.parse(trimmed) as StreamEvent)
        } catch (e) {
          handlers.onError?.(e instanceof Error ? e : new Error(String(e)))
        }
      }
    }
    const last = buffer.trim()
    if (last) {
      try {
        handlers.onEvent(JSON.parse(last) as StreamEvent)
      } catch (e) {
        handlers.onError?.(e instanceof Error ? e : new Error(String(e)))
      }
    }
    handlers.onDone?.()
  } finally {
    reader.releaseLock()
  }
}
