import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmt } from '@/lib/format'

const THRESHOLD = 50000

export default function CashDiscrepancy({ shifts }) {
  const rows = [...shifts]
    .filter(s => s.cash_diff !== 0 && s.cash_diff !== null)
    .sort((a, b) => Math.abs(Number(b.cash_diff)) - Math.abs(Number(a.cash_diff)))

  return (
    <Card className="mb-4">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">Lệch tiền (theo mức độ)</CardTitle>
        <p className="text-xs text-zinc-400 mt-0.5">
          Đỏ = lệch &gt; {fmt(THRESHOLD)}đ · Chỉ hiển thị ca có lệch khác 0
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {!rows.length ? (
          <p className="px-6 py-4 text-sm text-zinc-400">Không có ca nào lệch tiền trong khoảng thời gian này</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Cơ sở</TableHead>
                <TableHead>Nhân viên</TableHead>
                <TableHead className="text-right">Lệch tiền</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(s => (
                <TableRow
                  key={s.id}
                  className={Math.abs(Number(s.cash_diff)) > THRESHOLD ? 'bg-red-50' : ''}
                >
                  <TableCell>{s.date}</TableCell>
                  <TableCell>{s.locations?.name || '—'}</TableCell>
                  <TableCell>{s.staff_name}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    {fmt(s.cash_diff)}
                  </TableCell>
                  <TableCell>{s.notes || ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
