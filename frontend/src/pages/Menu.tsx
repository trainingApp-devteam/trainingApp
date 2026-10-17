import React, { useEffect, useState } from "react";
import { searchExercises } from '../api/exercises'
import type { Exercise } from '../api/exercises'
import { deleteRoutine, listRoutines, Routine, RoutineExercise, saveRoutine } from '../api/routines'
import { ui } from '../styles/ui'

type MenuExercise = RoutineExercise
type MenuItem = Routine

const DEFAULT_REPS = 8
const DEFAULT_SECONDS = 60

// 回数では推定できない（時間のみ推定できる）種目。有酸素マシンが該当する
function timeOnly(exercise: Exercise | undefined): boolean {
  const bases = exercise?.calorieBases || []
  return bases.includes('MINUTE') && !bases.includes('REP')
}

function describe(ex: MenuExercise): string {
  return `${ex.exerciseName || ex.exerciseId}(${ex.type === 'reps' ? `${ex.reps}回` : `${ex.timeSeconds}秒`}${ex.weight ? `/${ex.weight}kg` : ''})`
}

export default function Menu(): JSX.Element {
  const [items, setItems] = useState<MenuItem[]>([])
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<MenuExercise[]>([])
  const [catalog, setCatalog] = useState<Exercise[]>([])
  const [group, setGroup] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRoutines().then(setItems).catch((e) => setError(e instanceof Error ? e.message : 'メニューを取得できませんでした'))
  }, [])

  useEffect(() => {
    searchExercises().then((exs) => {
      setCatalog(exs)
      const first = exs.map((e) => e.group).filter((g): g is string => Boolean(g)).sort()[0]
      setGroup(first || '')
    }).catch(() => setCatalog([]))
  }, [])

  const groups = [...new Set(catalog.map((e) => e.group).filter((g): g is string => Boolean(g)))].sort()
  const candidates = catalog.filter((e) => !group || e.group === group)

  function openForm(it: MenuItem | null) {
    setEditing(it)
    setName(it?.name || '')
    setExercises(it?.exercises || [])
    setError(null)
    setIsFormOpen(true)
  }

  function closeForm() {
    setEditing(null); setName(''); setExercises([]); setIsFormOpen(false)
  }

  // 種目を選んだら既定値のまま追加し、回数・時間・負荷は一覧の行で直す
  function addExercise(ex: Exercise) {
    const added: MenuExercise = timeOnly(ex)
      ? { exerciseId: ex.id, exerciseName: ex.name, type: 'time', timeSeconds: DEFAULT_SECONDS }
      : { exerciseId: ex.id, exerciseName: ex.name, type: 'reps', reps: DEFAULT_REPS }
    setExercises((s) => [...s, added])
  }

  function updateExercise(idx: number, patch: Partial<MenuExercise>) {
    setExercises((s) => s.map((ex, i) => i === idx ? { ...ex, ...patch } : ex))
  }

  function changeType(idx: number, type: 'reps' | 'time') {
    updateExercise(idx, type === 'reps'
      ? { type, reps: DEFAULT_REPS, timeSeconds: undefined }
      : { type, timeSeconds: DEFAULT_SECONDS, reps: undefined })
  }

  function moveExercise(idx: number, dir: -1 | 1) {
    setExercises((s) => {
      const ni = idx + dir
      if (ni < 0 || ni >= s.length) return s
      const a = [...s]
      ;[a[ni], a[idx]] = [a[idx], a[ni]]
      return a
    })
  }

  function validate(): string | null {
    if (!name.trim()) return '名前を入力してください'
    if (!exercises.length) return '種目を1つ以上追加してください'
    for (const ex of exercises) {
      const label = ex.exerciseName || ex.exerciseId
      const value = ex.type === 'reps' ? ex.reps : ex.timeSeconds
      if (!value || !Number.isInteger(value) || value < 1) return `「${label}」の${ex.type === 'reps' ? '回数' : '時間'}は1以上の整数を入力してください`
      if (ex.weight !== undefined && (Number.isNaN(ex.weight) || ex.weight < 0)) return `「${label}」の負荷は0以上の数値で入力してください`
    }
    return null
  }

  async function handleSave() {
    const invalid = validate()
    if (invalid) return setError(invalid)
    try {
      const saved = await saveRoutine({ name: name.trim(), exercises }, editing?.id)
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      closeForm(); setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('メニューを削除しますか？')) return
    try {
      await deleteRoutine(id)
      setItems((current) => current.filter((item) => item.id !== id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除できませんでした')
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">メニュー管理</h2>
      <div className={ui.card}>
        {error && <div role="alert" className={`mb-3 ${ui.error}`}>{error}</div>}
        {!isFormOpen && (
          <div className="mb-4 flex items-center gap-2">
            <button onClick={() => openForm(null)} className={ui.btnPrimary}>新規作成</button>
          </div>
        )}

        {isFormOpen && (
          <section aria-label={editing ? 'メニューを編集' : 'メニューを作成'} className={`mb-4 ${ui.panel}`}>
            <label className="block mb-4">
              <span className={ui.label}>名前</span>
              <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <div className={ui.label}>種目を追加（タップで追加）</div>
            <div role="group" aria-label="部位" className="mb-2 flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className={`rounded-full px-3 py-1 text-sm ${group === g ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-100 hover:bg-gray-600'}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div role="group" aria-label="種目" className="mb-4 flex flex-wrap gap-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addExercise(c)}
                  className="rounded-full border border-white/30 px-3 py-1 text-sm text-gray-100 hover:bg-white/10"
                >
                  ＋ {c.name}
                </button>
              ))}
              {candidates.length === 0 && <div className={ui.muted}>種目を取得できませんでした</div>}
            </div>

            <div className={ui.label}>メニューの種目</div>
            {exercises.length === 0 && <div className={`mb-2 ${ui.muted}`}>まだ種目がありません</div>}
            {exercises.length > 0 && (
              <ul className="space-y-2 mb-2">
                {exercises.map((ex, idx) => {
                  const label = ex.exerciseName || ex.exerciseId
                  const fixedTime = timeOnly(catalog.find((c) => c.id === ex.exerciseId))
                  return (
                    <li key={`${ex.exerciseId}_${idx}`} className="flex flex-wrap items-center gap-2 rounded bg-gray-800/40 p-2">
                      <div className="min-w-[8rem] flex-1 font-medium text-sm text-gray-100">{label}</div>
                      <input
                        type="number"
                        min={1}
                        aria-label={`${label}の${ex.type === 'reps' ? '回数' : '秒数'}`}
                        value={(ex.type === 'reps' ? ex.reps : ex.timeSeconds) ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : Number(e.target.value)
                          updateExercise(idx, ex.type === 'reps' ? { reps: v } : { timeSeconds: v })
                        }}
                        className={`w-20 ${ui.field}`}
                      />
                      <select
                        aria-label={`${label}の記録形式`}
                        value={ex.type}
                        disabled={fixedTime}
                        onChange={(e) => changeType(idx, e.target.value as 'reps' | 'time')}
                        className={ui.field}
                      >
                        <option value="reps">回</option>
                        <option value="time">秒</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        placeholder="負荷"
                        aria-label={`${label}の負荷（kg・任意）`}
                        value={ex.weight ?? ''}
                        onChange={(e) => updateExercise(idx, { weight: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className={`w-20 ${ui.field}`}
                      />
                      <span className="text-sm text-gray-200">kg</span>
                      <div className="flex gap-1">
                        <button type="button" aria-label={`${label}を上へ`} onClick={() => moveExercise(idx, -1)} className="px-2 py-1 bg-gray-700 text-gray-100 hover:bg-gray-600 rounded">↑</button>
                        <button type="button" aria-label={`${label}を下へ`} onClick={() => moveExercise(idx, 1)} className="px-2 py-1 bg-gray-700 text-gray-100 hover:bg-gray-600 rounded">↓</button>
                        <button type="button" aria-label={`${label}を削除`} onClick={() => setExercises((s) => s.filter((_, i) => i !== idx))} className="px-2 py-1 bg-red-700 text-white hover:bg-red-800 rounded">×</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={handleSave} className={ui.btnSuccess}>保存</button>
              <button onClick={closeForm} className={ui.btnSecondary}>キャンセル</button>
            </div>
          </section>
        )}

        <ul className="space-y-3">
          {items.map(it => (
            <li key={it.id} className="flex items-center justify-between gap-3 bg-gray-800/40 p-3 rounded">
              <div>
                <div className="font-medium text-gray-100">{it.name}</div>
                <div className={ui.muted}>{it.exercises.length === 0 ? '種目なし' : it.exercises.map(describe).join(' , ')}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openForm(it)} className="px-3 py-1 rounded bg-yellow-500 text-gray-900">編集</button>
                <button onClick={() => handleDelete(it.id)} className="px-3 py-1 rounded bg-red-700 text-white">削除</button>
              </div>
            </li>
          ))}
        </ul>

        {items.length === 0 && <div className="mt-4 text-gray-300">メニューはまだ作成されていません。</div>}
      </div>
    </div>
  );
}
