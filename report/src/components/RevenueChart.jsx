import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmt } from '@/lib/format'

export default function RevenueChart({ data }) {
  if (!data.length) return null

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Doanh thu theo ngày</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={d => d.slice(5)}
            />
            <YAxis
              tickFormatter={v => v ? (v / 1000000).toFixed(1) + 'M' : '0'}
              tick={{ fontSize: 11 }}
              width={42}
            />
            <Tooltip formatter={(v, name) => [fmt(v) + 'đ', name]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="binhTan"
              name="Bình Tân"
              stroke="#18181b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="quan6"
              name="Quận 6"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
              strokeDasharray="6 3"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
