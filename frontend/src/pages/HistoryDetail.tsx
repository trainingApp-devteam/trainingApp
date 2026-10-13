import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRecord, RecordItem, SetItem } from '../api/records'

export default function HistoryDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [item, setItem] = useState<RecordItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getRecord(id).then(r => setItem(r)).catch(e => setError('取得失敗')).finally(() => setLoading(false))
  }, [id])

  function renderSet(s: SetItem) {
    if (s.type === 'reps') return `${s.reps}回${s.weight ? ` × ${s.weight}kg` : ''}`
    return `${s.timeSeconds}秒${s.weight ? ` × ${s.weight}kg` : ''}`
  }

  if (loading) return <div className="container mx-auto px-4 py-10">読み込み中...</div>
  if (error) return <div className="container mx-auto px-4 py-10 text-red-400">{error}</div>
  if (!item) return <div className="container mx-auto px-4 py-10">データが見つかりません。</div>

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">記録詳細</h2>
        <button onClick={() => nav(-1)} className="px-3 py-1 rounded bg-gray-700">戻る</button>
      </div>

      <div className="p-6 bg-white/5 rounded-lg">
        <div className="mb-3">日時: <span className="font-medium">{item.date}</span></div>
        <div className="mb-3">種目 ID: <span className="font-medium">{item.exerciseId}</span></div>
        <div className="mb-3">セット:</div>
        <ul className="space-y-2">
          {item.sets.map((s, i) => (
            <li key={i} className="bg-gray-800/40 p-2 rounded">{renderSet(s)}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
