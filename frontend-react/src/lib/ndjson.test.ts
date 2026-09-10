import { describe, expect, it, vi } from 'vitest'

import { parseNdjsonChunk } from './ndjson'

describe('parseNdjsonChunk', () => {
  it('emits complete lines and keeps remainder', () => {
    const onLine = vi.fn()
    let buf = ''
    buf = parseNdjsonChunk(buf, '{"a":1}\n{"b":', onLine)
    expect(onLine).toHaveBeenCalledTimes(1)
    expect(onLine).toHaveBeenCalledWith('{"a":1}')
    buf = parseNdjsonChunk(buf, '2}\n', onLine)
    expect(onLine).toHaveBeenCalledTimes(2)
    expect(onLine).toHaveBeenCalledWith('{"b":2}')
    expect(buf).toBe('')
  })

  it('ignores blank lines', () => {
    const onLine = vi.fn()
    const rest = parseNdjsonChunk('', '\n\n{"a":1}\n\n', onLine)
    expect(onLine).toHaveBeenCalledTimes(1)
    expect(rest).toBe('')
  })

  it('keeps a partial trailing line across multiple calls', () => {
    const onLine = vi.fn()
    let buf = parseNdjsonChunk('', '{"a"', onLine)
    expect(onLine).not.toHaveBeenCalled()
    buf = parseNdjsonChunk(buf, ':1}', onLine)
    expect(onLine).not.toHaveBeenCalled()
    buf = parseNdjsonChunk(buf, '\n', onLine)
    expect(onLine).toHaveBeenCalledWith('{"a":1}')
    expect(buf).toBe('')
  })
})
