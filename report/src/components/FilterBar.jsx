import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

export default function FilterBar({ startDate, endDate, locationId, locations, loading, onStartDate, onEndDate, onLocation, onApply }) {
  return (
    <Card className="mb-4">
      <CardContent className="pt-4 pb-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">Lọc</span>
          <input
            type="date"
            value={startDate}
            onChange={e => onStartDate(e.target.value)}
            className="border border-zinc-200 rounded-md px-3 py-1.5 text-sm bg-zinc-50 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <span className="text-zinc-400 text-sm">→</span>
          <input
            type="date"
            value={endDate}
            onChange={e => onEndDate(e.target.value)}
            className="border border-zinc-200 rounded-md px-3 py-1.5 text-sm bg-zinc-50 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <Select value={locationId} onValueChange={onLocation}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Tất cả cơ sở" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả cơ sở</SelectItem>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={onApply} disabled={loading}>
            {loading ? 'Đang tải...' : 'Áp dụng'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
