export function fmt(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('vi-VN')
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
