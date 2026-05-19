import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmt } from '@/lib/format'

export default function ProductRevenue({ rows }) {
  const maxRev = rows[0]?.revenue || 1

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Doanh thu theo sản phẩm</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!rows.length ? (
          <p className="px-6 py-4 text-sm text-zinc-400">Chưa có dữ liệu</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Đã bán</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="w-32">Tỉ lệ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{fmt(r.consumed)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.revenue)}</TableCell>
                  <TableCell>
                    <Progress value={Math.round(r.revenue / maxRev * 100)} className="h-2" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
