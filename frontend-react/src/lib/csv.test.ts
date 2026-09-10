import { describe, expect, it } from 'vitest'

import { parseCsv, toNumber } from './csv'

describe('parseCsv', () => {
  it('parses a simple header + rows CSV', () => {
    const csv = 'a,b\n1,2\n3,4'
    expect(parseCsv(csv)).toEqual({
      columns: ['a', 'b'],
      rows: [
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ],
    })
  })

  it('handles quoted fields containing commas', () => {
    const csv = 'name,note\n"Acme, Inc.",ok\nFoo,"has ""quotes"""'
    expect(parseCsv(csv)).toEqual({
      columns: ['name', 'note'],
      rows: [
        { name: 'Acme, Inc.', note: 'ok' },
        { name: 'Foo', note: 'has "quotes"' },
      ],
    })
  })

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n'
    expect(parseCsv(csv)).toEqual({ columns: ['a', 'b'], rows: [{ a: '1', b: '2' }] })
  })

  it('returns empty result for empty input', () => {
    expect(parseCsv('')).toEqual({ columns: [], rows: [] })
    expect(parseCsv('   ')).toEqual({ columns: [], rows: [] })
  })

  it('returns only columns when there are no data rows', () => {
    expect(parseCsv('a,b')).toEqual({ columns: ['a', 'b'], rows: [] })
  })
})

describe('toNumber', () => {
  it('parses numeric strings', () => {
    expect(toNumber('42')).toBe(42)
    expect(toNumber('3.14')).toBeCloseTo(3.14)
    expect(toNumber('-1.5')).toBe(-1.5)
  })

  it('returns NaN for empty or non-numeric values', () => {
    expect(Number.isNaN(toNumber(''))).toBe(true)
    expect(Number.isNaN(toNumber(undefined))).toBe(true)
    expect(Number.isNaN(toNumber('abc'))).toBe(true)
  })
})
