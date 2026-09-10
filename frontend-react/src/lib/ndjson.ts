/**
 * Accumulates `chunk` onto `buffer`, emits each complete line via `onLine`,
 * and returns the unconsumed remainder (kept for the next call).
 */
export function parseNdjsonChunk(
  buffer: string,
  chunk: string,
  onLine: (line: string) => void,
): string {
  const next = buffer + chunk
  const lines = next.split('\n')
  const rest = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) onLine(trimmed)
  }
  return rest
}
