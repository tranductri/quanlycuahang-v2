import { describe, it, expect } from 'vitest'
import { fmt, today, daysAgo } from './format'

describe('fmt', () => {
  it('formats number in vi-VN locale', () => {
    expect(fmt(1000000)).toBe('1.000.000')
  })
  it('returns — for null', () => {
    expect(fmt(null)).toBe('—')
  })
  it('returns — for undefined', () => {
    expect(fmt(undefined)).toBe('—')
  })
  it('handles zero', () => {
    expect(fmt(0)).toBe('0')
  })
})

describe('today', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('daysAgo', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(daysAgo(7)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('returns earlier date than today', () => {
    expect(daysAgo(1) < today()).toBe(true)
  })
})
