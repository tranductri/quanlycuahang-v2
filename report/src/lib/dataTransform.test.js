import { describe, it, expect } from 'vitest'
import { summarize, buildChartData, aggregateProducts } from './dataTransform'

const makeShift = (overrides) => ({
  id: 'a',
  date: '2026-05-01',
  total_sales: 0,
  expenses: 0,
  cash_diff: 0,
  locations: { name: 'Bình Tân' },
  ...overrides,
})

describe('summarize', () => {
  it('returns zeros for empty array', () => {
    expect(summarize([])).toEqual({ totalSales: 0, totalExpenses: 0, avgCashDiff: 0, count: 0 })
  })

  it('aggregates totals correctly', () => {
    const shifts = [
      makeShift({ total_sales: 1000000, expenses: 50000, cash_diff: -10000 }),
      makeShift({ total_sales: 1500000, expenses: 0, cash_diff: 20000 }),
    ]
    expect(summarize(shifts)).toEqual({
      totalSales: 2500000,
      totalExpenses: 50000,
      avgCashDiff: 5000,
      count: 2,
    })
  })

  it('rounds avgCashDiff', () => {
    const shifts = [
      makeShift({ cash_diff: 10000 }),
      makeShift({ cash_diff: 20000 }),
      makeShift({ cash_diff: 30000 }),
    ]
    expect(summarize(shifts).avgCashDiff).toBe(20000)
  })
})

describe('buildChartData', () => {
  it('groups by date and location', () => {
    const shifts = [
      makeShift({ date: '2026-05-01', total_sales: 1000000, locations: { name: 'Bình Tân' } }),
      makeShift({ date: '2026-05-01', total_sales: 800000,  locations: { name: 'Quận 6' } }),
      makeShift({ date: '2026-05-02', total_sales: 1200000, locations: { name: 'Bình Tân' } }),
    ]
    expect(buildChartData(shifts)).toEqual([
      { date: '2026-05-01', binhTan: 1000000, quan6: 800000 },
      { date: '2026-05-02', binhTan: 1200000, quan6: null },
    ])
  })

  it('sorts by date ascending', () => {
    const shifts = [
      makeShift({ date: '2026-05-03', total_sales: 500000 }),
      makeShift({ date: '2026-05-01', total_sales: 800000 }),
    ]
    const result = buildChartData(shifts)
    expect(result[0].date).toBe('2026-05-01')
    expect(result[1].date).toBe('2026-05-03')
  })

  it('returns empty array for no shifts', () => {
    expect(buildChartData([])).toEqual([])
  })
})

describe('aggregateProducts', () => {
  it('groups by product name and sorts by revenue desc', () => {
    const prods = [
      { products: { name: 'Bánh mì' }, revenue: 500000, consumed: 25 },
      { products: { name: 'Bánh bao' }, revenue: 200000, consumed: 10 },
      { products: { name: 'Bánh mì' }, revenue: 300000, consumed: 15 },
    ]
    const result = aggregateProducts(prods)
    expect(result[0]).toEqual({ name: 'Bánh mì', revenue: 800000, consumed: 40 })
    expect(result[1]).toEqual({ name: 'Bánh bao', revenue: 200000, consumed: 10 })
  })

  it('returns empty array for no products', () => {
    expect(aggregateProducts([])).toEqual([])
  })
})
