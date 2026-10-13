import React, { useEffect, useState } from "react"

type Measurement = { id: string; date: string; height?: number; weight?: number; bodyFat?: number }

function loadMeasurements(): Measurement[] {
  try {
    const raw = localStorage.getItem('trainingapp:bodyMeasurements')
    if (!raw) return []
    return JSON.parse(raw)
  } catch { return [] }
}

function saveMeasurements(ms: Measurement[]) { localStorage.setItem('trainingapp:bodyMeasurements', JSON.stringify(ms)) }

export default function Body(): JSX.Element {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [height, setHeight] = useState<number|''>('')
  const [weight, setWeight] = useState<number|''>('')
  const [bodyFat, setBodyFat] = useState<number|''>('')
  const [items, setItems] = useState<Measurement[]>([])

  useEffect(() => { setItems(loadMeasurements()) }, [])

  function validate(): string|null {
    if (!date) return '日付を入力してください'
    if (height !== '' && (height < 50 || height > 300)) return '身長は50〜300の範囲で入力してください'
    if (weight !== '' && (weight <= 0 || weight > 500)) return '体重は正しい値で入力してください'
    if (bodyFat !== '' && (bodyFat < 0 || bodyFat > 100)) return '体脂肪は0〜100の範囲で入力してください'
    return null
  }

  function add() {
    const err = validate()
    if (err) return alert(err)
    const m: Measurement = { id: String(Date.now()), date, height: height === '' ? undefined : Number(height), weight: weight === '' ? undefined : Number(weight), bodyFat: bodyFat === '' ? undefined : Number(bodyFat) }
    const next = [m, ...items]
    setItems(next)
    saveMeasurements(next)
    alert('保存しました')
  }

  function remove(id: string) {
    if (!confirm('削除しますか？')) return
    const next = items.filter(i => i.id !== id)
    setItems(next)
    saveMeasurements(next)
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

        <div className="mt-6">
          <h3 className="font-medium mb-2">履歴</h3>
          {items.length === 0 && <div>データがありません</div>}
          <ul className="space-y-2">
            {items.map(i => (
              <li key={i.id} className="flex items-center justify-between bg-gray-800/40 p-2 rounded">
                <div>
                  <div className="font-medium">{i.date}</div>
                  <div className="text-sm text-gray-300">{i.height ? `${i.height} cm` : '-'} / {i.weight ? `${i.weight} kg` : '-'} / {i.bodyFat ? `${i.bodyFat}%` : '-'}</div>
                </div>
                <button onClick={() => remove(i.id)} className="px-2 py-1 rounded bg-red-600">削除</button>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}
