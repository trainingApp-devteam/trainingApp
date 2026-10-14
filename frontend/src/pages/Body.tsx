import React, { useEffect, useState } from "react"
import { BodyMeasurement, createBodyMeasurement, deleteBodyMeasurement, listBodyMeasurements, MeasurementType } from '../api/bodyMeasurements'
import { localDateString } from '../utils/date'

type Measurement = { id: string; ids: string[]; date: string; height?: number; weight?: number; bodyFat?: number }

function groupMeasurements(values: BodyMeasurement[]): Measurement[] {
  const groups = new Map<string, Measurement>()
  values.forEach((item) => {
    const group = groups.get(item.date) || { id: item.date, ids: [], date: item.date }
    group.ids.push(item.id)
    if (item.type === 'height_cm' && group.height === undefined) group.height = item.value
    if (item.type === 'weight_kg' && group.weight === undefined) group.weight = item.value
    if (item.type === 'body_fat_pct' && group.bodyFat === undefined) group.bodyFat = item.value
    groups.set(item.date, group)
  })
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export default function Body(): JSX.Element {
  const [date, setDate] = useState(() => localDateString())
  const [height, setHeight] = useState<number|''>('')
  const [weight, setWeight] = useState<number|''>('')
  const [bodyFat, setBodyFat] = useState<number|''>('')
  const [items, setItems] = useState<Measurement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try { setItems(groupMeasurements(await listBodyMeasurements())); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : '測定データを取得できませんでした') }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  function validate(): string|null {
    if (!date) return '日付を入力してください'
    if (height !== '' && (height < 50 || height > 300)) return '身長は50〜300の範囲で入力してください'
    if (weight !== '' && (weight <= 0 || weight > 500)) return '体重は正しい値で入力してください'
    if (bodyFat !== '' && (bodyFat < 0 || bodyFat > 100)) return '体脂肪は0〜100の範囲で入力してください'
    return null
  }

  async function add() {
    const err = validate()
    if (err) return alert(err)
    const values: Array<[MeasurementType, number]> = []
    if (height !== '') values.push(['height_cm', Number(height)])
    if (weight !== '') values.push(['weight_kg', Number(weight)])
    if (bodyFat !== '') values.push(['body_fat_pct', Number(bodyFat)])
    if (!values.length) return setError('測定値を1つ以上入力してください')
    setError(null)
    try {
      for (const [type, value] of values) await createBodyMeasurement(date, type, value)
      await refresh()
      alert('保存しました')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
      await refresh()
    }
  }

  async function remove(item: Measurement) {
    if (!confirm('この日の測定値をすべて削除しますか？')) return
    try {
      await Promise.all(item.ids.map(deleteBodyMeasurement))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除できませんでした')
      await refresh()
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">身体測定</h2>
      <div className="p-6 bg-white/5 rounded-lg max-w-md">
        <div className="mb-3"><label className="block text-sm">日付</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>

        <div className="mb-3"><label className="block text-sm">身長(cm)</label>
          <input type="number" value={height as any} onChange={e => setHeight(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>

        <div className="mb-3"><label className="block text-sm">体重(kg)</label>
          <input type="number" value={weight as any} onChange={e => setWeight(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>

        <div className="mb-3"><label className="block text-sm">体脂肪(%)</label>
          <input type="number" value={bodyFat as any} onChange={e => setBodyFat(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>

        <div className="flex gap-2">
          <button onClick={add} className="px-3 py-2 rounded bg-green-600">保存</button>
        </div>
        {error && <div role="alert" className="mt-3 text-red-400">{error}</div>}

        <div className="mt-6">
          <h3 className="font-medium mb-2">履歴</h3>
          {loading && <div>読み込み中...</div>}
          {!loading && items.length === 0 && <div>データがありません</div>}
          <ul className="space-y-2">
            {items.map(i => (
              <li key={i.id} className="flex items-center justify-between bg-gray-800/40 p-2 rounded">
                <div>
                  <div className="font-medium">{i.date}</div>
                  <div className="text-sm text-gray-300">{i.height !== undefined ? `${i.height} cm` : '-'} / {i.weight !== undefined ? `${i.weight} kg` : '-'} / {i.bodyFat !== undefined ? `${i.bodyFat}%` : '-'}</div>
                </div>
                <button onClick={() => remove(i)} className="px-2 py-1 rounded bg-red-700">削除</button>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}
