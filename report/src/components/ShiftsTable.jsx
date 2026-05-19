import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmt } from '@/lib/format'

export default function ShiftsTable({ shifts }) {
  if (!shifts.length) return (
    <Card className="mb-4">
      <CardHeader><CardTitle className="text-sm font-semibold">Chi tiết ca làm việc</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-zinc-400">Chưa có dữ liệu</p></CardContent>
    </Card>
  )

  const total = {
    total_sales: shifts.reduce((s, r) => s + Number(r.total_sales || 0), 0),
    expenses:    shifts.reduce((s, r) => s + Number(r.expenses    || 0), 0),
    bank_sales:  shifts.reduce((s, r) => s + Number(r.bank_sales  || 0), 0),
    cash_diff:   shifts.reduce((s, r) => s + Number(r.cash_diff   || 0), 0),
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Chi tiết ca làm việc</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead>Cơ sở</TableHead>
              <TableHead>Nhân viên</TableHead>
              <TableHead className="text-right">Tổng DT</TableHead>
              <TableHead className="text-right">Chi phí</TableHead>
              <TableHead className="text-right">CK/NH</TableHead>
              <TableHead className="text-right">Lệch tiền</TableHead>
              <TableHead>Ghi chú</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.date}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{s.locations?.name || '—'}</Badge>
                </TableCell>
                <TableCell>{s.staff_name}</TableCell>
                <TableCell className="text-right">{fmt(s.total_sales)}</TableCell>
                <TableCell className="text-right">{fmt(s.expenses)}</TableCell>
                <TableCell className="text-right">{fmt(s.bank_sales)}</TableCell>
                <TableCell className={`text-right ${Number(s.cash_diff) !== 0 ? 'text-red-600' : ''}`}>
                  {fmt(s.cash_diff)}
                </TableCell>
                <TableCell>{s.notes || ''}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-zinc-50">
              <TableCell colSpan={3}>Tổng</TableCell>
              <TableCell className="text-right">{fmt(total.total_sales)}</TableCell>
              <TableCell className="text-right">{fmt(total.expenses)}</TableCell>
              <TableCell className="text-right">{fmt(total.bank_sales)}</TableCell>
              <TableCell className="text-right">{fmt(total.cash_diff)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
