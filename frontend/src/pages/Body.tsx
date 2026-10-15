import React, { useEffect, useState } from "react"
import { BodyMeasurement, createBodyMeasurement, deleteBodyMeasurement, listBodyMeasurements, MeasurementType } from '../api/bodyMeasurements'
import { formatDateTime, localDateTimeInputValue } from '../utils/date'
import { ui } from '../styles/ui'

type Measurement = { id: string; ids: string[]; measuredAt: string; height?: number; weight?: number; bodyFat?: number }

// 同じ測定日時で保存した身長・体重・体脂肪を1行にまとめる
function groupMeasurements(values: BodyMeasurement[]): Measurement[] {
  const groups = new Map<string, Measurement>()
  values.forEach((item) => {
    const group = groups.get(item.measuredAt) || { id: item.measuredAt, ids: [], measuredAt: item.measuredAt }
    group.ids.push(item.id)
    if (item.type === 'height_cm' && group.height === undefined) group.height = item.value
    if (item.type === 'weight_kg' && group.weight === undefined) group.weight = item.value
    if (item.type === 'body_fat_pct' && group.bodyFat === undefined) group.bodyFat = item.value
    groups.set(item.measuredAt, group)
  })
  return [...groups.values()].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))
}

export default function Body(): JSX.Element {
  const [measuredAt, setMeasuredAt] = useState(() => localDateTimeInputValue())
  const [height, setHeight] = useState<number|''>('')
  const [weight, setWeight] = useState<number|''>('')
  const [bodyFat, setBodyFat] = useState<number|''>('')
  const [items, setItems] = useState<Measurement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try { setItems(groupMeasurements(await listBodyMeasurements())); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : '測定データを取得できませんでした') }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  function validate(): string|null {
    if (!measuredAt || Number.isNaN(new Date(measuredAt).getTime())) return '測定日時を入力してください'
    if (height !== '' && (height < 50 || height > 300)) return '身長は50〜300の範囲で入力してください'
    if (weight !== '' && (weight < 20 || weight > 300)) return '体重は20〜300の範囲で入力してください'
    if (bodyFat !== '' && (bodyFat < 0 || bodyFat > 100)) return '体脂肪は0〜100の範囲で入力してください'
    return null
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    const err = validate()
    if (err) return setError(err)
    const values: Array<[MeasurementType, number]> = []
    if (height !== '') values.push(['height_cm', Number(height)])
    if (weight !== '') values.push(['weight_kg', Number(weight)])
    if (bodyFat !== '') values.push(['body_fat_pct', Number(bodyFat)])
    if (!values.length) return setError('測定値を1つ以上入力してください')
    setError(null)
    try {
      const instant = new Date(measuredAt).toISOString()
      for (const [type, value] of values) await createBodyMeasurement(instant, type, value)
      setHeight(''); setWeight(''); setBodyFat('')
      await refresh()
      setMessage('保存しました')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
      await refresh()
    }
  }

  async function remove(item: Measurement) {
    if (!confirm('この測定日時の測定値をすべて削除しますか？')) return
    try {
      await Promise.all(item.ids.map((id) => deleteBodyMeasurement(id)))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除できませんでした')
      await refresh()
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">身体測定</h2>
      <div className="max-w-md space-y-4">
        <form onSubmit={add} className={ui.card} aria-labelledby="body-form-heading">
          <h3 id="body-form-heading" className={ui.cardTitle}>測定値を登録</h3>
          <div className="mb-3">
            <label htmlFor="body-measured-at" className={ui.label}>測定日時</label>
            <input id="body-measured-at" type="datetime-local" value={measuredAt} onChange={e => setMeasuredAt(e.target.value)} className={ui.input} />
          </div>
          <div className="mb-3">
            <label htmlFor="body-height" className={ui.label}>身長(cm)</label>
            <input id="body-height" type="number" step="0.1" value={height as any} onChange={e => setHeight(e.target.value ? Number(e.target.value) : '')} className={ui.input} />
          </div>
          <div className="mb-3">
            <label htmlFor="body-weight" className={ui.label}>体重(kg)</label>
            <input id="body-weight" type="number" step="0.1" value={weight as any} onChange={e => setWeight(e.target.value ? Number(e.target.value) : '')} className={ui.input} />
          </div>
          <div className="mb-4">
            <label htmlFor="body-fat" className={ui.label}>体脂肪(%)</label>
            <input id="body-fat" type="number" step="0.1" value={bodyFat as any} onChange={e => setBodyFat(e.target.value ? Number(e.target.value) : '')} className={ui.input} />
          </div>
          <p className={`mb-4 ${ui.muted}`}>カロリー推定には、最新の体重を使用します。</p>
          <button type="submit" className={ui.btnSuccess}>保存</button>
          {error && <div role="alert" className={`mt-3 ${ui.error}`}>{error}</div>}
          {message && <div role="status" className={`mt-3 ${ui.success}`}>{message}</div>}
        </form>

        <section className={ui.card} aria-labelledby="body-history-heading">
          <h3 id="body-history-heading" className={ui.cardTitle}>履歴</h3>
          {loading && <div className="text-gray-300">読み込み中...</div>}
          {!loading && items.length === 0 && <div className="text-gray-300">データがありません</div>}
          <ul className="space-y-2">
            {items.map(i => (
              <li key={i.id} className="flex items-center justify-between rounded-md bg-black/20 p-3 ring-1 ring-white/10">
                <div>
                  <div className="font-medium text-gray-100">{formatDateTime(i.measuredAt)}</div>
                  <div className="text-sm text-gray-300">{i.height !== undefined ? `${i.height} cm` : '-'} / {i.weight !== undefined ? `${i.weight} kg` : '-'} / {i.bodyFat !== undefined ? `${i.bodyFat}%` : '-'}</div>
                </div>
                <button type="button" onClick={() => remove(i)} className={`${ui.btnDanger} ${ui.btnSmall}`}>削除</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}