import { formatDateTime, localDateString, localDateTimeInputValue } from '../date'

describe('localDateString', () => {
  test('uses the local calendar date, not the UTC date', () => {
    // 2026-10-15 00:30 local time; in UTC+9 this is still 2026-10-14 in UTC
    expect(localDateString(new Date(2026, 9, 15, 0, 30))).toBe('2026-10-15')
    expect(localDateString(new Date(2026, 9, 15, 23, 59))).toBe('2026-10-15')
  })

  test('pads month and day', () => {
    expect(localDateString(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('local date-time helpers', () => {
  test('builds a datetime-local input value from local time', () => {
    expect(localDateTimeInputValue(new Date(2026, 9, 15, 9, 5))).toBe('2026-10-15T09:05')
  })

  test('formats an ISO instant in local time', () => {
    const instant = new Date(2026, 9, 15, 21, 30).toISOString()
    expect(formatDateTime(instant)).toBe('2026/10/15 21:30')
  })

  test('returns the input unchanged when it is not a date', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})