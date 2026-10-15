import { getLatestBodyWeight, latestMeasurements, listBodyMeasurements } from '../bodyMeasurements'
import { apiRequest } from '../client'

vi.mock('../client', () => ({ apiRequest: vi.fn() }))

const row = (id: number, type: string, measuredAt: string, value: number) => ({ id, measurementTypeCode: type, measuredAt, value })

describe('body measurements API', () => {
  beforeEach(() => { vi.mocked(apiRequest).mockReset() })

  test('keeps the measurement instant and derives the local date from it', async () => {
    const instant = new Date(2026, 9, 15, 0, 30).toISOString()
    vi.mocked(apiRequest).mockResolvedValue({ content: [row(1, 'weight_kg', instant, 63.5)] })

    const [item] = await listBodyMeasurements()

    expect(item).toEqual({ id: '1', measuredAt: instant, date: '2026-10-15', type: 'weight_kg', value: 63.5 })
  })

  test('picks the newest measurement of each type, using the id to break ties', () => {
    const latest = latestMeasurements([
      { id: '1', measuredAt: '2026-10-01T03:00:00Z', date: '2026-10-01', type: 'weight_kg', value: 70 },
      { id: '2', measuredAt: '2026-10-10T03:00:00Z', date: '2026-10-10', type: 'weight_kg', value: 68 },
      { id: '3', measuredAt: '2026-10-10T03:00:00Z', date: '2026-10-10', type: 'weight_kg', value: 67.5 },
      { id: '4', measuredAt: '2026-09-01T03:00:00Z', date: '2026-09-01', type: 'height_cm', value: 170 },
    ])

    expect(latest.weight_kg?.value).toBe(67.5)
    expect(latest.height_cm?.value).toBe(170)
    expect(latest.body_fat_pct).toBeUndefined()
  })

  test('uses the latest registered weight for calorie estimates, or null when none', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ content: [row(1, 'weight_kg', '2026-10-01T03:00:00Z', 70), row(2, 'weight_kg', '2026-10-12T03:00:00Z', 66.2)] })
    await expect(getLatestBodyWeight()).resolves.toBe(66.2)

    vi.mocked(apiRequest).mockResolvedValueOnce({ content: [row(3, 'height_cm', '2026-10-12T03:00:00Z', 171)] })
    await expect(getLatestBodyWeight()).resolves.toBeNull()
  })
})