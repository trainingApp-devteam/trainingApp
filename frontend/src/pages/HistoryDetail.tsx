import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRecord, updateRecord, withCalorieEstimates, RecordItem, SetItem } from '../api/records'
import { canEstimate, searchExercises } from '../api/exercises'
import { getLatestBodyWeight } from '../api/bodyMeasurements'

type Draft = { date: string; note: string; sets: SetItem[] }

function setValue(set: SetItem): number | undefined {
  return set.type === 'reps' ? set.reps : set.timeSeconds
}

export default function HistoryDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [item, setItem] = useState<RecordItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getRecord(id).then(r => setItem(r)).catch(e => setError('取得失敗')).finally(() => setLoading(false))
  }, [id])

  function renderSet(s: SetItem) {
    if (s.type === 'reps') return `${s.reps}回${s.weight ? ` × ${s.weight}kg` : ''}`
    return `${s.timeSeconds}秒${s.weight ? ` × ${s.weight}kg` : ''}`
  }

  function startEdit() {
    if (!item) return
    setDraft({ date: item.date, note: item.note || '', sets: item.sets.map((set) => ({ ...set })) })
    setFormError(null)
  }

  function changeSet(index: number, patch: Partial<SetItem>) {
    setDraft((current) => current && ({ ...current, sets: current.sets.map((set, i) => i === index ? { ...set, ...patch } : set) }))
  }

  function changeAmount(index: number, raw: string) {
    const value = raw === '' ? undefined : Number(raw)
    setDraft((current) => current && ({
      ...current,
      sets: current.sets.map((set, i) => {
        if (i !== index) return set
        const changed = value !== setValue(set)
        const next = set.type === 'reps' ? { ...set, reps: value } : { ...set, timeSeconds: value }
        return changed ? { ...next, calorieEstimateId: undefined, estimatedCaloriesKcal: undefined } : next
      }),
    }))
  }

  function changeWeight(index: number, raw: string) {
    changeSet(index, { weight: raw === '' ? undefined : Number(raw) })
  }

  function removeSet(index: number) {
    setDraft((current) => current && ({ ...current, sets: current.sets.filter((_, i) => i !== index) }))
  }

  function copySet(index: number) {
    setDraft((current) => {
      if (!current) return current
      const sets = [...current.sets]
      sets.splice(index + 1, 0, { ...current.sets[index], calorieEstimateId: undefined, estimatedCaloriesKcal: undefined })
      return { ...current, sets }
    })
  }

  function validate(value: Draft): string | null {
    if (!value.date) return '日付を入力してください'
    if (value.sets.length === 0) return 'セットが1件以上必要です。すべて削除する場合は記録ごと削除してください'
    for (const set of value.sets) {
      const amount = setValue(set)
      if (amount === undefined || !Number.isInteger(amount) || amount < 1) return `${set.type === 'reps' ? '回数' : '時間(秒)'}は1以上の整数で入力してください`
      if (set.weight !== undefined && (!Number.isFinite(set.weight) || set.weight < 0)) return '重量は0以上で入力してください'
    }
    return null
  }

  async function save() {
    if (!draft || !item || !id) return
    const message = validate(draft)
    if (message) { setFormError(message); return }
    setSaving(true); setFormError(null)
    try {
      // 回数・時間を変えたセット（推定が外れたセット）は、元のRPE（不明なら6）と最新の体重で推定し直す
      const [catalog, bodyWeightKg] = await Promise.all([
        searchExercises().catch(() => []),
        getLatestBodyWeight().catch(() => null),
      ])
      const prepared = draft.sets.map((set) => set.calorieEstimateId !== undefined ? set : {
        ...set,
        rpe: set.rpe ?? 6,
        calorieEnabled: canEstimate(catalog.find((exercise) => exercise.id === set.exerciseId), set.type),
      })
      const sets = await withCalorieEstimates(prepared, bodyWeightKg)
      const updated = await updateRecord(id, { date: draft.date, note: draft.note || undefined, exerciseId: item.exerciseId, sets })
      setItem(updated)
      setDraft(null)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally { setSaving(false) }
  }

  const totalKcal = item?.sets.reduce((sum, set) => sum + (set.estimatedCaloriesKcal ?? 0), 0) ?? 0
  const hasKcal = item?.sets.some((set) => set.estimatedCaloriesKcal !== undefined) ?? false

  if (loading) return <div className="container mx-auto px-4 py-10">読み込み中...</div>
  if (error) return <div className="container mx-auto px-4 py-10 text-red-400">{error}</div>
  if (!item) return <div className="container mx-auto px-4 py-10">データが見つかりません。</div>

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">記録詳細</h2>
        <div className="flex gap-2">
          {!draft && <button onClick={startEdit} className="px-3 py-1 rounded bg-blue-600">編集</button>}
          <button onClick={() => nav(-1)} className="px-3 py-1 rounded bg-gray-700">戻る</button>
        </div>
      </div>

      {draft ? (
        <div className="p-6 bg-white/5 rounded-lg">
          {formError && <div role="alert" className="mb-3 text-red-400">{formError}</div>}
          <label className="mb-3 block">日付
            <input type="date" aria-label="日付" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="ml-2 px-2 py-1 rounded bg-gray-800/60" />
          </label>
          <label className="mb-3 block">メモ
            <input aria-label="メモ" maxLength={1000} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="ml-2 w-2/3 px-2 py-1 rounded bg-gray-800/60" />
          </label>
          <ul className="space-y-2">
            {draft.sets.map((s, i) => (
              <li key={i} className="bg-gray-800/40 p-2 rounded flex flex-wrap items-center gap-2">
                <span>{s.exerciseName || '種目'}</span>
                <input type="number" min={1} step={1} aria-label={`セット${i + 1}の${s.type === 'reps' ? '回数' : '時間(秒)'}`} value={setValue(s) ?? ''} onChange={(e) => changeAmount(i, e.target.value)} className="w-24 px-2 py-1 rounded bg-gray-800/60" />
                <span>{s.type === 'reps' ? '回' : '秒'}</span>
                <input type="number" min={0} step={0.5} aria-label={`セット${i + 1}の重量(kg)`} value={s.weight ?? ''} onChange={(e) => changeWeight(i, e.target.value)} className="w-24 px-2 py-1 rounded bg-gray-800/60" />
                <span>kg</span>
                <button type="button" onClick={() => copySet(i)} className="px-2 py-1 rounded bg-gray-600">コピー</button>
                <button type="button" onClick={() => removeSet(i)} className="px-2 py-1 rounded bg-red-700">削除</button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-gray-300">回数・時間を変更したセットの消費カロリーは、保存時に元のRPE（不明な場合は6）と最新の体重で再計算します。</p>
          <div className="mt-4 flex gap-2">
            <button disabled={saving} onClick={save} className="px-3 py-2 rounded bg-green-700 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            <button disabled={saving} onClick={() => setDraft(null)} className="px-3 py-2 rounded bg-gray-700">キャンセル</button>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-white/5 rounded-lg">
          <div className="mb-3">日時: <span className="font-medium">{item.date}</span></div>
          {item.note && <div className="mb-3">メモ: <span className="font-medium">{item.note}</span></div>}
          <div className="mb-3">種目: <span className="font-medium">{[...new Set(item.sets.map((set) => set.exerciseName).filter(Boolean))].join('、') || item.exerciseId}</span></div>
          <div className="mb-3">セット:</div>
          <ul className="space-y-2">
            {item.sets.map((s, i) => (
              <li key={i} className="bg-gray-800/40 p-2 rounded">{s.exerciseName ? `${s.exerciseName}: ` : ''}{renderSet(s)}{s.estimatedCaloriesKcal !== undefined ? `（推定 ${s.estimatedCaloriesKcal} kcal）` : ''}</li>
            ))}
          </ul>
          {hasKcal && <div className="mt-3">推定消費カロリー合計: <span className="font-medium">{Math.round(totalKcal * 100) / 100} kcal</span>（推定値）</div>}
        </div>
      )}
    </div>
  )
}