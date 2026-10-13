import React, { useEffect, useState } from "react";
import { Link } from 'react-router-dom'
import { listRecords, deleteRecord, RecordItem, SetItem } from '../api/records'
import { searchExercises, listExerciseGroups } from '../api/exercises'

export default function History(): JSX.Element {
  const [items, setItems] = useState<RecordItem[]>([])
  const [exMap, setExMap] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterQ, setFilterQ] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [groups, setGroups] = useState<Array<{id:string;name:string}>>([])
  const [page, setPage] = useState(1)
  const pageSize = 6

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [records, exercises, groups] = await Promise.all([listRecords(), searchExercises(), listExerciseGroups()])
      setItems(records)
      const map: Record<string,string> = {}
      exercises.forEach((e: any) => (map[e.id] = e.name))
      setExMap(map)
      setGroups(groups)
    } catch (err: any) {
      setError(err.message || '失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('削除してもよいですか？')) return
    try {
      await deleteRecord(id)
      setItems((s) => s.filter((r) => r.id !== id))
    } catch (err) {
      alert('削除に失敗しました')
    }
  }

  function renderSet(s: SetItem) {
    if (s.type === 'reps') return `${s.reps}回${s.weight ? ` × ${s.weight}kg` : ''}`
    return `${s.timeSeconds}秒${s.weight ? ` × ${s.weight}kg` : ''}`
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">履歴</h2>
      <div className="p-6 bg-white/5 rounded-lg">
        <div className="mb-4">
          {/* フィルタは不要のため非表示 */}
        </div>
        {loading && <div>読み込み中...</div>}
        {error && <div className="text-red-400">{error}</div>}
        {!loading && items.length === 0 && <div>記録がありません。</div>}

        {/* Apply filters */}
        {!loading && items.length > 0 && (
          (() => {
            const filtered = items
            const total = filtered.length
            const pages = Math.max(1, Math.ceil(total / pageSize))
            const start = (page - 1) * pageSize
            const pageItems = filtered.slice(start, start + pageSize)

            return (
              <>
                <ul className="space-y-3">
                  {pageItems.map((it) => (
                    <li key={it.id} className="flex items-center justify-between bg-gray-800/40 p-3 rounded">
                      <div>
                        <div className="font-medium"><Link className="underline" to={`/history/${it.id}`}>{it.date} — {exMap[it.exerciseId] || it.exerciseId}</Link></div>
                        <div className="text-sm text-gray-300">{it.sets.map((s) => renderSet(s)).join(' | ')}</div>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/history/${it.id}`} className="px-3 py-1 rounded bg-blue-600">詳細</Link>
                        <button onClick={() => handleDelete(it.id)} className="px-3 py-1 rounded bg-red-600">削除</button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-300">合計 {total} 件</div>
                  <div className="flex gap-2">
                    <button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))} className="px-3 py-1 rounded bg-gray-700 disabled:opacity-40">前へ</button>
                    <div className="px-3 py-1 rounded bg-gray-800/50">{page}/{pages}</div>
                    <button disabled={page>=pages} onClick={() => setPage(p => Math.min(pages, p+1))} className="px-3 py-1 rounded bg-gray-700 disabled:opacity-40">次へ</button>
                  </div>
                </div>
              </>
            )
          })()
        )}
      </div>
    </div>
  );
}
