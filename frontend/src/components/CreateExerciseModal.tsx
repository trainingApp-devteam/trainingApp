import React, { useState } from 'react'
import { createExercise } from '../api/exercises'
import { ui } from '../styles/ui'

type Props = {
  isOpen: boolean
  onClose: () => void
  onCreated: (ex: { id: string; name: string; group?: string }) => void
}

export default function CreateExerciseModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleCreate() {
    if (!name.trim()) return setError('名前を入力してください')
    setError(null)
    setLoading(true)
    try {
      const ex = await createExercise(name.trim(), group.trim() || undefined)
      onCreated(ex)
      setName('')
      setGroup('')
      onClose()
    } catch (e: any) {
      setError(e?.message || '作成に失敗しました')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="独自種目を作成">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-gray-800 text-gray-100 shadow-xl ring-1 ring-white/10">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-lg font-medium">独自種目を作成</div>
          <button onClick={onClose} className="text-sm text-gray-200 underline hover:text-white">閉じる</button>
        </div>
        <div className="p-4">
          <label className="block mb-3">
            <div className={ui.label}>種目名</div>
            <input value={name} onChange={(e)=>setName(e.target.value)} className={ui.input} />
          </label>
          <label className="block mb-3">
            <div className={ui.label}>部位（任意）</div>
            <input value={group} onChange={(e)=>setGroup(e.target.value)} className={ui.input} />
          </label>
          {error && <div className={`text-sm mb-2 ${ui.error}`}>{error}</div>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={`${ui.btnSecondary} ${ui.btnSmall}`}>キャンセル</button>
            <button onClick={handleCreate} disabled={loading} className={`${ui.btnPrimary} ${ui.btnSmall}`}>{loading ? '作成中...' : '作成'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}