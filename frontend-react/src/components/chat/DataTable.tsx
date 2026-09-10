import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function DataTable({
  title,
  columns,
  rows,
}: {
  title?: string
  columns: string[]
  rows: Record<string, string>[]
}) {
  if (columns.length === 0) {
    return <div className="mt-2 text-xs text-[var(--color-muted-foreground)]">暂无数据</div>
  }

  return (
    <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white">
      {title && (
        <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs font-medium text-slate-700">
          {title}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="text-xs">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col} className="text-xs">
                  {row[col] ?? ''}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
