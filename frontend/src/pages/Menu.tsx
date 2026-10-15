import React, { useEffect, useState } from "react";
import { searchExercises, listExerciseGroups } from '../api/exercises'
import { deleteRoutine, listRoutines, Routine, RoutineExercise, saveRoutine } from '../api/routines'

type MenuExercise = RoutineExercise
type MenuItem = Routine

export default function Menu(): JSX.Element {
  const [items, setItems] = useState<MenuItem[]>([])
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<MenuExercise[]>([])
  const [setType, setSetType] = useState<'reps'|'time'>('reps')
  const [reps, setReps] = useState<number>(8)
  const [timeSeconds, setTimeSeconds] = useState<number>(60)
  const [weight, setWeight] = useState<number | ''>('')
  const [isCreating, setIsCreating] = useState(false)
  const [groups, setGroups] = useState<Array<{id:string;name:string}>>([])
  const [group, setGroup] = useState('')
  const [candidates, setCandidates] = useState<Array<{id:string;name:string}>>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRoutines().then(setItems).catch((e) => setError(e instanceof Error ? e.message : 'メニューを取得できませんでした'))
  }, [])

  useEffect(() => {
    listExerciseGroups().then((gs) => {
      setGroups(gs)
      setGroup(gs.length ? gs[0].id : '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!group) return
    searchExercises('', group).then((exs) => {
      setCandidates(exs)
      if (exs.length && !selectedExercise) setSelectedExercise(exs[0].id)
    }).catch(() => setCandidates([]))
  }, [group])

  function startCreate() {
    setEditing(null); setName(''); setExercises([]); setIsCreating(true)
  }

  function startEdit(it: MenuItem) {
    setEditing(it); setName(it.name); setExercises(it.exercises)
  }

  function migrateOldExercises(raw: string[] | any[]): MenuExercise[] {
    // raw may be array of ids or names (string)
    return raw.map((r) => {
      if (typeof r === 'string') return { exerciseId: r, type: 'reps', reps: 8 }
      if (r && r.exerciseId) return r as MenuExercise
      return { exerciseId: String(r), type: 'reps', reps: 8 }
    })
  }

  async function handleSave() {
    if (!name.trim()) return setError('名前を入力してください')
    if (!exercises.length) return setError('種目を1つ以上追加してください')
    try {
      const saved = await saveRoutine({ name: name.trim(), exercises }, editing?.id)
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      setEditing(null); setName(''); setExercises([]); setIsCreating(false); setError(null)
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
      <div className="p-6 bg-white/5 rounded-lg">
        {error && <div role="alert" className="mb-3 text-red-400">{error}</div>}
            <div className="mb-4 flex items-center gap-2">
          <button onClick={startCreate} className="px-3 py-1 rounded bg-blue-600">新規作成</button>
        </div>

        {(isCreating || editing !== null || name !== '') && (
          <div className="mb-4 p-4 bg-gray-800/40 rounded">
            <div className="mb-2">名前</div>
            <input className="w-full px-3 py-2 rounded bg-gray-900/50" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="mt-2 mb-2">種目（選択して回数/時間・負荷を設定して追加）</div>
            <div className="flex gap-2 mb-2">
              <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-40 rounded px-3 py-2 bg-gray-900/50">
                <option value="">-- 部位選択 --</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)} className="flex-1 rounded px-3 py-2 bg-gray-900/50">
                <option value="">-- 種目選択 --</option>
                {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="mb-2 p-3 bg-gray-800/20 rounded">
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2"><input type="radio" checked={setType==='reps'} onChange={()=>setSetType('reps')} /> 回数</label>
                <label className="flex items-center gap-2"><input type="radio" checked={setType==='time'} onChange={()=>setSetType('time')} /> 時間</label>
              </div>
              {setType === 'reps' ? (
                <div className="flex gap-2 items-center mb-2">
                  <input type="number" min={1} value={reps} onChange={(e)=>setReps(Number(e.target.value))} className="w-24 rounded px-2 py-1 bg-gray-900/50" />
                  <div className="text-sm">回</div>
                </div>
              ) : (
                <div className="flex gap-2 items-center mb-2">
                  <input type="number" min={1} value={timeSeconds} onChange={(e)=>setTimeSeconds(Number(e.target.value))} className="w-32 rounded px-2 py-1 bg-gray-900/50" />
                  <div className="text-sm">秒</div>
                </div>
              )}
              <div className="mb-2">
                <div className="text-sm mb-1">負荷（kg・任意）</div>
                <input type="number" min={0} value={weight as any} onChange={(e)=>setWeight(e.target.value === '' ? '' : Number(e.target.value))} className="w-32 rounded px-2 py-1 bg-gray-900/50" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => {
                  if (!selectedExercise) return alert('種目を選択してください')
                  const found = candidates.find(c => c.id === selectedExercise)
                  const ex: MenuExercise = { exerciseId: selectedExercise, exerciseName: found?.name, type: setType }
                  if (setType === 'reps') ex.reps = reps
                  else ex.timeSeconds = timeSeconds
                  if (weight !== '') ex.weight = Number(weight)
                  setExercises((s) => [ex, ...s])
                }} className="px-3 py-1 rounded bg-blue-600">候補を追加</button>
                <button type="button" onClick={() => {
                  // manual add by id/name in a simple way
                  const val = prompt('種目IDを入力してください（既存ID推奨）')
                  if (!val) return
                  setExercises((s) => [{ exerciseId: val, type: setType, reps: setType==='reps'?reps:undefined, timeSeconds: setType==='time'?timeSeconds:undefined, weight: weight===''?undefined:Number(weight) }, ...s])
                }} className="px-3 py-1 rounded bg-gray-700">手動追加</button>
              </div>
            </div>

            <div className="mb-2">現在のセット</div>
            {exercises.length === 0 && <div className="text-sm text-gray-400">まだセットがありません</div>}
            {exercises.length > 0 && (
              <ul className="space-y-2 mb-2">
                {exercises.map((ex, idx) => (
                  <li key={`${ex.exerciseId}_${idx}`} className="flex items-center justify-between bg-gray-800/40 p-2 rounded">
                    <div>
                      <div className="font-medium text-sm">{ex.exerciseName || ex.exerciseId}</div>
                      <div className="text-xs text-gray-300">{ex.type==='reps'? `${ex.reps} 回` : `${ex.timeSeconds} 秒`} {ex.weight? `・${ex.weight} kg` : ''}</div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setExercises((s)=>{ const a=[...s]; if (idx===0) return a; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a })} className="px-2 py-1 bg-gray-700 rounded">↑</button>
                      <button type="button" onClick={() => setExercises((s)=>{ const a=[...s]; if (idx===a.length-1) return a; [a[idx+1], a[idx]] = [a[idx], a[idx+1]]; return a })} className="px-2 py-1 bg-gray-700 rounded">↓</button>
                      <button type="button" onClick={() => setExercises((s)=>s.filter((_,i)=>i!==idx))} className="px-2 py-1 bg-red-700 rounded text-white">削除</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={handleSave} className="px-3 py-1 rounded bg-green-700">保存</button>
              <button onClick={() => { setEditing(null); setName(''); setExercises([]); setIsCreating(false) }} className="px-3 py-1 rounded bg-gray-700">キャンセル</button>
            </div>
          </div>
        )}

        <ul className="space-y-3">
          {items.map(it => (
            <li key={it.id} className="flex items-center justify-between bg-gray-800/40 p-3 rounded">
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="text-sm text-gray-300">{it.exercises.length === 0 ? '種目なし' : it.exercises.map(e => `${e.exerciseName||e.exerciseId}(${e.type==='reps'? `${e.reps}回` : `${e.timeSeconds}秒`}${e.weight? `/${e.weight}kg` : ''})`).join(' , ')}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(it)} className="px-3 py-1 rounded bg-yellow-500 text-gray-900">編集</button>
                <button onClick={() => handleDelete(it.id)} className="px-3 py-1 rounded bg-red-700">削除</button>
              </div>
            </li>
          ))}
        </ul>

        {items.length === 0 && <div className="mt-4 text-gray-300">メニューはまだ作成されていません。</div>}
      </div>
    </div>
  );
}
