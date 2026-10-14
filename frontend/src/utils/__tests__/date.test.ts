import { localDateString } from '../date'

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