import { apiRequest } from './client'

export type MeasurementType = 'height_cm' | 'weight_kg' | 'body_fat_pct'
export type BodyMeasurement = { id: string; date: string; type: MeasurementType; value: number }
type MeasurementPage = { content: Array<{ id: number; measurementTypeCode: MeasurementType; measuredAt: string; value: number }> }

export async function listBodyMeasurements(): Promise<BodyMeasurement[]> {
  const page = await apiRequest<MeasurementPage>('/body-measurements?page=0&size=100')
  return page.content.map((item) => ({
    id: String(item.id),
    date: item.measuredAt.slice(0, 10),
    type: item.measurementTypeCode,
    value: item.value,
  }))
}

export function createBodyMeasurement(date: string, type: MeasurementType, value: number): Promise<unknown> {
  return apiRequest('/body-measurements', {
    method: 'POST',
    body: JSON.stringify({ measurementTypeCode: type, measuredAt: `${date}T12:00:00Z`, value }),
  })
}

export function deleteBodyMeasurement(id: string): Promise<void> {
  return apiRequest<void>(`/body-measurements/${encodeURIComponent(id)}`, { method: 'DELETE' })
}