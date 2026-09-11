import { describe, expect, it } from 'vitest'

import { isStructuredDump, sanitizeInterruptText } from './interruptText'

describe('isStructuredDump', () => {
  it('detects raw JSON object dumps', () => {
    const dump = JSON.stringify({
      candidates: [{ table: 'Orders', matched_columns: ['order_id'] }],
    })
    expect(isStructuredDump(dump)).toBe(true)
  })

  it('detects raw JSON array dumps', () => {
    expect(isStructuredDump('[{"a": 1}]')).toBe(true)
  })

  it('treats normal questions as non-dumps', () => {
    expect(isStructuredDump('请问你想查询哪个时间范围的数据？')).toBe(false)
  })

  it('treats empty text as non-dump', () => {
    expect(isStructuredDump('   ')).toBe(false)
  })

  it('treats invalid JSON-looking text as non-dump', () => {
    expect(isStructuredDump('{not valid json')).toBe(false)
  })
})

describe('sanitizeInterruptText', () => {
  it('returns null for structured dumps', () => {
    expect(sanitizeInterruptText('{"candidates": []}')).toBeNull()
  })

  it('returns trimmed text for normal questions', () => {
    expect(sanitizeInterruptText('  确认吗？  ')).toBe('确认吗？')
  })

  it('returns null for empty text', () => {
    expect(sanitizeInterruptText('   ')).toBeNull()
  })
})
