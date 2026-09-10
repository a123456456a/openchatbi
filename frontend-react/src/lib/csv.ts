export interface ParsedCsv {
  columns: string[]
  rows: Record<string, string>[]
}

/**
 * Minimal RFC4180-ish CSV parser (handles quoted fields, escaped quotes `""`,
 * and commas/newlines inside quotes). Good enough for the `df.to_csv()`
 * output the backend sends alongside `visualization_dsl` steps.
 */
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const len = csv.length

  while (i < len) {
    const char = csv[i]
    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (char === '\r') {
      i += 1
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += char
    i += 1
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

/** Parse a CSV string (as produced by `pandas.DataFrame.to_csv(index=False)`) into columns + row records. */
export function parseCsv(csv: string): ParsedCsv {
  if (!csv || !csv.trim()) return { columns: [], rows: [] }
  const rawRows = parseCsvRows(csv.trim())
  if (rawRows.length === 0) return { columns: [], rows: [] }
  const columns = rawRows[0]
  const rows = rawRows.slice(1).map((values) => {
    const record: Record<string, string> = {}
    columns.forEach((col, idx) => {
      record[col] = values[idx] ?? ''
    })
    return record
  })
  return { columns, rows }
}

/** Coerce a CSV cell to a number, or `NaN` when it isn't numeric. */
export function toNumber(value: string | undefined): number {
  if (value === undefined || value === '') return NaN
  const n = Number(value)
  return n
}
