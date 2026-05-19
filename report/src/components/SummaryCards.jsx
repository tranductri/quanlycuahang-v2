import { Card, CardContent } from '@/components/ui/card'
import { fmt } from '@/lib/format'

function SummaryCard({ label, value, sub, valueClass }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-zinc-500 font-medium mb-1">{label}</p>
        <p className={`text-xl font-bold ${valueClass ?? ''}`}>{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function SummaryCards({ summary }) {
  const perShift = summary.count
    ? fmt(Math.round(summary.totalExpenses / summary.count))
    : '—'
  return (
    <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
      <SummaryCard label="Tổng doanh thu" value={fmt(summary.totalSales)} sub={`${summary.count} ca`} />
      <SummaryCard label="Tổng chi phí" value={fmt(summary.totalExpenses)} sub={`TB: ${perShift}đ/ca`} />
      <SummaryCard
        label="Lệch tiền TB"
        value={fmt(summary.avgCashDiff)}
        valueClass={summary.avgCashDiff < 0 ? 'text-red-600' : ''}
      />
      <SummaryCard label="Số ca" value={summary.count} />
    </div>
  )
}
