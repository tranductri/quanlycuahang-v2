export function summarize(shifts) {
  const count = shifts.length
  const totalSales    = shifts.reduce((s, r) => s + Number(r.total_sales || 0), 0)
  const totalExpenses = shifts.reduce((s, r) => s + Number(r.expenses    || 0), 0)
  const avgCashDiff   = count
    ? Math.round(shifts.reduce((s, r) => s + Number(r.cash_diff || 0), 0) / count)
    : 0
  return { totalSales, totalExpenses, avgCashDiff, count }
}

export function buildChartData(shifts) {
  const map = {}
  shifts.forEach(s => {
    const date = s.date
    const loc  = s.locations?.name
    if (!map[date]) map[date] = { date, binhTan: null, quan6: null }
    if (loc === 'Bình Tân') map[date].binhTan = (map[date].binhTan || 0) + Number(s.total_sales || 0)
    if (loc === 'Quận 6')  map[date].quan6   = (map[date].quan6   || 0) + Number(s.total_sales || 0)
  })
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

export function aggregateProducts(shiftProducts) {
  const map = {}
  shiftProducts.forEach(sp => {
    const name = sp.products?.name || 'Unknown'
    if (!map[name]) map[name] = { name, revenue: 0, consumed: 0 }
    map[name].revenue  += Number(sp.revenue  || 0)
    map[name].consumed += Number(sp.consumed || 0)
  })
  return Object.values(map).sort((a, b) => b.revenue - a.revenue)
}
