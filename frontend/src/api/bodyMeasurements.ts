import { apiRequest } from './client'
import { localDateString } from '../utils/date'

export type MeasurementType = 'height_cm' | 'weight_kg' | 'body_fat_pct'
export type BodyMeasurement = { id: string; measuredAt: string; date: string; type: MeasurementType; value: number }
type MeasurementPage = { content: Array<{ id: number; measurementTypeCode: MeasurementType; measuredAt: string; value: number }> }

export async function listBodyMeasurements(): Promise<BodyMeasurement[]> {
  const page = await apiRequest<MeasurementPage>('/body-measurements?page=0&size=100')
  return page.content.map((item) => ({
    id: String(item.id),
    measuredAt: item.measuredAt,
    date: localDateString(new Date(item.measuredAt)),
    type: item.measurementTypeCode,
    value: item.value,
  }))
}

// measuredAt はISO日時（UTC）。画面ではローカル時刻で入力・表示する
export function createBodyMeasurement(measuredAt: string, type: MeasurementType, value: number): Promise<unknown> {
  return apiRequest('/body-measurements', {
    method: 'POST',
    body: JSON.stringify({ measurementTypeCode: type, measuredAt, value }),
  })
}

export function deleteBodyMeasurement(id: string): Promise<void> {
  return apiRequest<void>(`/body-measurements/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// 種目ごとに測定日時が最も新しい測定値を返す（同時刻ならIDが新しいもの）
export function latestMeasurements(values: BodyMeasurement[]): Partial<Record<MeasurementType, BodyMeasurement>> {
  const latest: Partial<Record<MeasurementType, BodyMeasurement>> = {}
  for (const item of values) {
    const current = latest[item.type]
    if (!current) { latest[item.type] = item; continue }
    const diff = Date.parse(item.measuredAt) - Date.parse(current.measuredAt)
    if (diff > 0 || (diff === 0 && Number(item.id) > Number(current.id))) latest[item.type] = item
  }
  return latest
}

// カロリー推定に使う体重。身体測定の最新の体重を使い、未登録ならnull
export async function getLatestBodyWeight(): Promise<number | null> {
  const weight = latestMeasurements(await listBodyMeasurements()).weight_kg
  return weight ? weight.value : null
}
type HistoryPage = MeasurementPage & { totalPages: number }

// 推移グラフ用。指定した項目の測定値を、期間の開始日時以降すべて取得する（古い順）
export async function listMeasurementHistory(type: MeasurementType, from?: Date | null): Promise<BodyMeasurement[]> {
  const values: BodyMeasurement[] = []
  for (let page = 0; ; page++) {
    const params = new URLSearchParams({ measurementTypeCode: type, page: String(page), size: '100' })
    if (from) params.set('from', from.toISOString())
    const result = await apiRequest<HistoryPage>(`/body-measurements?${params}`)
    result.content.forEach((item) => values.push({
      id: String(item.id),
      measuredAt: item.measuredAt,
      date: localDateString(new Date(item.measuredAt)),
      type: item.measurementTypeCode,
      value: item.value,
    }))
    if (page + 1 >= result.totalPages || result.content.length === 0) break
  }
  return values.reverse()
}
