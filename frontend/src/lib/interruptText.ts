/**
 * Interrupt payloads should be a natural-language question for the user, but
 * the agent occasionally leaks a raw JSON tool-output blob (e.g. schema
 * candidate matches from `search_schema`) into the `text` field instead of a
 * proper clarifying question. Such payloads are unreadable and not meant for
 * end users, so we detect and hide them.
 */
export function isStructuredDump(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return typeof parsed === 'object' && parsed !== null
  } catch {
    return false
  }
}

/** Returns human-displayable text, or `null` when it should be hidden. */
export function sanitizeInterruptText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || isStructuredDump(trimmed)) return null
  return trimmed
}
