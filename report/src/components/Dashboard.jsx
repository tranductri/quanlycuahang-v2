import { useState, useEffect, useCallback, useMemo } from 'react'
import { db } from '@/lib/supabase'
import { today, daysAgo } from '@/lib/format'
import { summarize, buildChartData, aggregateProducts } from '@/lib/dataTransform'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import FilterBar from '@/components/FilterBar'
import SummaryCards from '@/components/SummaryCards'
import RevenueChart from '@/components/RevenueChart'
import ProductRevenue from '@/components/ProductRevenue'
import ShiftsTable from '@/components/ShiftsTable'
import CashDiscrepancy from '@/components/CashDiscrepancy'

export default function Dashboard({ user, onLogout }) {
  const [startDate,  setStartDate]  = useState(daysAgo(30))
  const [endDate,    setEndDate]    = useState(today())
  const [locationId, setLocationId] = useState('')
  const [locations,  setLocations]  = useState([])
  const [shifts,     setShifts]     = useState(null)
  const [shiftProds, setShiftProds] = useState(null)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    db.from('locations').select('id,name').then(({ data }) => setLocations(data || []))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = db.from('shifts')
        .select('*, locations(name)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
      if (locationId) q = q.eq('location_id', locationId)

      const { data: shiftData, error: e1 } = await q
      if (e1) throw e1

      const ids = (shiftData || []).map(s => s.id)
      let prods = []
      if (ids.length) {
        const { data: pd, error: e2 } = await db
          .from('shift_products')
          .select('*, products(name)')
          .in('shift_id', ids)
        if (e2) throw e2
        prods = pd || []
      }
      setShifts(shiftData || [])
      setShiftProds(prods)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, locationId])

  useEffect(() => { load() }, [load])

  const summary     = useMemo(() => shifts      ? summarize(shifts)            : null, [shifts])
  const chartData   = useMemo(() => shifts      ? buildChartData(shifts)        : [],   [shifts])
  const productRows = useMemo(() => shiftProds  ? aggregateProducts(shiftProds) : [],   [shiftProds])

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-zinc-900 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold">Báo cáo — Quản lý cửa hàng</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>{user.name}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-6 text-xs border-zinc-600 text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            Đăng xuất
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <FilterBar
          startDate={startDate} endDate={endDate} locationId={locationId}
          locations={locations} loading={loading}
          onStartDate={setStartDate} onEndDate={setEndDate}
          onLocation={setLocationId} onApply={load}
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-56 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : (
          <>
            {summary && <SummaryCards summary={summary} />}
            <RevenueChart data={chartData} />
            <ProductRevenue rows={productRows} />
            <ShiftsTable shifts={shifts || []} />
            <CashDiscrepancy shifts={shifts || []} />
          </>
        )}
      </main>
    </div>
  )
}
