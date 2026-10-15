import React, { useEffect, useState, Suspense } from "react";
import { useNavigate } from 'react-router-dom'
import { searchExercises, listExerciseGroups, createExercise } from '../api/exercises'
import { getAccountBodyWeight, syncAccountProfile } from '../api/accountProfile'
import { getCurrentAccount } from '../api/auth'
import CreateExerciseModal from '../components/CreateExerciseModal'
import { createCalorieEstimate, createRecord } from '../api/records'
import type { SetItem } from '../api/records'
import { listRoutines } from '../api/routines'
import { localDateString } from '../utils/date'
// Spotify integration removed — restored original Record page
// ExerciseSelect modal removed

type Exercise = { id: string; name: string; group?: string; isBuiltin?: boolean; calorieEnabled?: boolean }

export default function Record(): JSX.Element {
  const navigate = useNavigate()
  const [autoStartPending, setAutoStartPending] = useState(false)
  
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [date, setDate] = useState(() => localDateString())
  const [exerciseId, setExerciseId] = useState('')

  // for building plan
  const [planSets, setPlanSets] = useState<SetItem[]>([])
  const [setType, setSetType] = useState<'reps'|'time'>('reps')
  const [reps, setReps] = useState<number>(8)
  const [timeSeconds, setTimeSeconds] = useState<number>(60)
  const [weight, setWeight] = useState<number | ''>('')
  const [rpe, setRpe] = useState<number>(6)
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(() => getAccountBodyWeight())

  // session state
  const [inSession, setInSession] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [group, setGroup] = useState<string>('')
  
  const [showCreateModal, setShowCreateModal] = useState(false)


  useEffect(() => {
    let cancelled = false
    listExerciseGroups().then((gs) => {
      if (cancelled) return
      setGroups(gs)
      const initial = gs.length ? gs[0].id : ''
      setGroup(initial)
      if (initial) {
        searchExercises('', initial).then((exs) => { if (!cancelled) { setExercises(exs); // fill names for any existing plan sets
          setPlanSets((prev) => prev.map((s) => {
            if (s.exerciseName) return s
            const found = exs.find((e) => e.id === s.exerciseId)
            if (found) { return { ...s, exerciseName: found.name, exerciseGroup: found.group } }
            return s
          })) } }).catch(() => { if (!cancelled) setExercises([]) })
      } else {
        searchExercises().then((exs) => { if (!cancelled) { setExercises(exs); setPlanSets((prev) => prev.map((s) => {
          if (s.exerciseName) return s
          const found = exs.find((e) => e.id === s.exerciseId)
          if (found) { return { ...s, exerciseName: found.name, exerciseGroup: found.group } }
          return s
        })) } }).catch(() => { if (!cancelled) setExercises([]) })
      }
    }).catch(() => {
      if (cancelled) return
      // fallback
      searchExercises().then((exs) => { if (!cancelled) { setExercises(exs); setPlanSets((prev) => prev.map((s) => {
        if (s.exerciseName) return s
        const found = exs.find((e) => e.id === s.exerciseId)
        if (found) { return { ...s, exerciseName: found.name, exerciseGroup: found.group } }
        return s
      })) } }).catch(() => { if (!cancelled) setExercises([]) })
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    getCurrentAccount().then((account) => {
      syncAccountProfile(account)
      setBodyWeightKg(getAccountBodyWeight(account.username))
    }).catch(() => {})
  }, [])

  // read possible menuId from query to auto-apply
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search)
      const menuId = qs.get('menuId')
      if (!menuId) return
      Promise.all([listRoutines(), searchExercises().catch(() => [] as Exercise[])]).then(([routines, catalog]) => {
      const menu = routines.find((item) => item.id === menuId)
      if (!menu) return
      const accountWeight = getAccountBodyWeight()
      const converted: SetItem[] = menu.exercises.map((me) => {
        const chosen = catalog.find((exercise) => exercise.id === me.exerciseId)
        const s: any = { type: me.type }
        s.exerciseId = me.exerciseId
        s.exerciseName = me.exerciseName
        s.exerciseGroup = chosen?.group
        if (me.type === 'reps') s.reps = me.reps
        else s.timeSeconds = me.timeSeconds
        if (me.weight !== undefined) s.weight = me.weight
        s.rpe = 6
        s.calorieEnabled = chosen?.isBuiltin === true && chosen.calorieEnabled === true
        if (accountWeight !== null) s.bodyWeightKg = accountWeight
        return s as SetItem
      })
      setPlanSets(converted)
      // if autoStart flag present, set exerciseId to first and mark pending start
      const auto = qs.get('autoStart')
      if (auto) {
        if (converted.length) setExerciseId(converted[0].exerciseId || '')
        setAutoStartPending(true)
      }
      // remove menuId from URL to prevent re-applying on refresh
      qs.delete('menuId')
      const newUrl = window.location.pathname + (qs.toString() ? `?${qs.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
      }).catch(() => setError('保存メニューを取得できませんでした'))
    } catch {
      // ignore
    }
  }, [])

  // when planSets are applied, if autoStart was requested, start session
  useEffect(() => {
    if (autoStartPending && planSets.length > 0) {
      setAutoStartPending(false)
      try { startSession() } catch { /* ignore */ }
    }
  }, [autoStartPending, planSets])

  useEffect(() => {
    let cancelled = false
    if (!group) return
    searchExercises('', group).then((exs) => { if (!cancelled) { setExercises(exs); setPlanSets((prev) => prev.map((s) => {
      if (s.exerciseName) return s
      const found = exs.find((e) => e.id === s.exerciseId)
      if (found) { return { ...s, exerciseName: found.name, exerciseGroup: found.group } }
      return s
    })) } }).catch(() => { if (!cancelled) setExercises([]) })
    return () => { cancelled = true }
  }, [group])

  useEffect(() => {
    if (exercises.length && !exerciseId) setExerciseId(exercises[0].id)
  }, [exercises, exerciseId])

  function addSetToPlan() {
    // validate current inputs before adding
    if (!exerciseId) return setError('種目を選択してください')
    if (setType === 'reps') {
      if (!Number.isInteger(reps) || reps < 1) return setError('回数は1以上の整数を入力してください')
    } else {
      if (!Number.isInteger(timeSeconds) || timeSeconds < 1) return setError('時間は1秒以上の整数を入力してください')
    }
    if (weight !== '' && (Number.isNaN(Number(weight)) || Number(weight) < 0)) return setError('負荷は0以上の数値で入力してください')

    const chosen = exercises.find((e) => e.id === exerciseId)
    const calorieEnabled = chosen?.isBuiltin === true && chosen.calorieEnabled === true
    if (calorieEnabled && bodyWeightKg === null) return setError('消費カロリーを推定するには、アカウントで体重を登録してください')

    const newSet: SetItem = { type: setType }
    newSet.exerciseId = exerciseId
    // capture the display name and group at creation time so it doesn't change later
    if (chosen) {
      newSet.exerciseName = chosen.name
      newSet.exerciseGroup = chosen.group
    }
    if (setType === 'reps') newSet.reps = reps
    else newSet.timeSeconds = timeSeconds
    if (weight !== '') newSet.weight = Number(weight)
    newSet.rpe = rpe
    if (bodyWeightKg !== null) newSet.bodyWeightKg = bodyWeightKg
    newSet.calorieEnabled = calorieEnabled
    setPlanSets((s) => [...s, newSet])
    setError(null)
  }

  

  // create modal will return created exercise; handle refresh when received

  function validatePlanSets(): boolean {
    for (let i = 0; i < planSets.length; i++) {
      const s = planSets[i]
      if (!s.exerciseId) { setError(`セット ${i+1} の種目が未選択です`); return false }
      if (s.type === 'reps') {
        if (!s.reps || !Number.isInteger(s.reps) || s.reps < 1) { setError(`セット ${i+1} の回数が不正です`); return false }
      } else {
        if (!s.timeSeconds || !Number.isInteger(s.timeSeconds) || s.timeSeconds < 1) { setError(`セット ${i+1} の時間が不正です`); return false }
      }
      if (s.weight !== undefined && (Number.isNaN(Number(s.weight)) || Number(s.weight) < 0)) { setError(`セット ${i+1} の負荷が不正です`); return false }
      if (!s.rpe || !Number.isInteger(s.rpe) || s.rpe < 1 || s.rpe > 10) { setError(`セット ${i+1} のRPEが不正です`); return false }
      if (s.calorieEnabled && (!s.bodyWeightKg || s.bodyWeightKg < 20 || s.bodyWeightKg > 300)) {
        setError('消費カロリーを推定するには、アカウントで体重を登録してください')
        return false
      }
    }
    setError(null)
    return true
  }

  function moveSet(idx: number, dir: -1|1) {
    setPlanSets((s) => {
      const arr = [...s]
      const ni = idx + dir
      if (ni < 0 || ni >= arr.length) return s
      const tmp = arr[ni]; arr[ni] = arr[idx]; arr[idx] = tmp
      return arr
    })
  }

  function removeSet(idx: number) { setPlanSets((s) => s.filter((_,i)=>i!==idx)) }

  function startSession() {
    // allow starting when planSets provided (e.g. from saved menu) even if exerciseId not set
    if (planSets.length === 0) return setError('少なくとも1つのセットを追加してください')
    if (!exerciseId && planSets.length > 0) {
      // set exerciseId to first set's exercise if missing
      const first = planSets[0]
      if (first && first.exerciseId) setExerciseId(first.exerciseId)
    }
    if (!validatePlanSets()) return
    setError(null)
    setInSession(true)
    setCurrentIndex(0)
    // initialize remaining for first set if it's time-based, but don't auto-start
    const first = planSets[0]
    if (first && first.type === 'time') {
      setRemaining(first.timeSeconds || 0)
      // do not auto-start timer; user must press 開始
      setIsTimerRunning(false)
    } else {
      setRemaining(null)
      setIsTimerRunning(false)
    }
  }

  async function finishAndSave() {
    setLoading(true)
    try {
      const calculatedSets = await Promise.all(planSets.map(async (set) => {
        if (!set.calorieEnabled || !set.exerciseId) return set
        if (!set.bodyWeightKg) throw new Error('消費カロリーを推定するには、アカウントで体重を登録してください')
        const estimate = await createCalorieEstimate({
          exerciseId: Number(set.exerciseId),
          basis: set.type === 'reps' ? 'REP' : 'MINUTE',
          rpe: set.rpe || 6,
          bodyWeightKg: set.bodyWeightKg,
          externalLoadKg: set.weight,
          reps: set.reps,
          durationSeconds: set.timeSeconds,
        })
        return {
          ...set,
          estimatedCaloriesKcal: estimate.estimatedCaloriesKcal,
          calorieEstimateId: estimate.estimateId,
          calorieNote: estimate.note,
        }
      }))
      await createRecord({ date, exerciseId, sets: calculatedSets })
      navigate('/history')
    } catch (err: any) {
      setError(err.message || '保存に失敗しました')
    } finally { setLoading(false) }
  }

  function handleNext(autoAdvance = false) {
    // stop interval
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (currentIndex + 1 < planSets.length) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      const next = planSets[nextIndex]
      if (next && next.type === 'time') {
        setRemaining(next.timeSeconds || 0)
        setIsTimerRunning(!!autoAdvance)
      } else {
        setRemaining(null)
        setIsTimerRunning(false)
      }
    } else {
      // finish
      setIsTimerRunning(false)
      finishAndSave()
    }
  }

  // countdown timer for time-type sets
  const [remaining, setRemaining] = useState<number | null>(null)
  const timerRef = React.useRef<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [showAllSets, setShowAllSets] = useState(false)
  const rowRefs = React.useRef<Array<HTMLTableRowElement | null>>([])
  const audioCtxRef = React.useRef<AudioContext | null>(null)

  function playBeep() {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx()
      const ctx = audioCtxRef.current
      if (!ctx) return
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 880
      o.connect(g)
      g.connect(ctx.destination)
      const now = ctx.currentTime
      // gentle attack, sustain ~5s, then fade out
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(0.2, now + 0.02)
      o.start(now)
      g.gain.setValueAtTime(0.2, now + 0.02)
      g.gain.linearRampToValueAtTime(0.0001, now + 5)
      o.stop(now + 5.05)
    } catch (e) {
      // ignore audio errors
    }
  }

  useEffect(() => {
    // clear previous timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const current = planSets[currentIndex]
    if (inSession && current && current.type === 'time') {
      const start = current.timeSeconds || 0
      if (remaining === null) setRemaining(start)
      // only run when timer started by user (or auto-started on auto-advance)
      if (isTimerRunning) {
        timerRef.current = window.setInterval(() => {
          setRemaining((r) => {
            if (r === null) return r
            if (r <= 1) {
              if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
              // stop at 0 and require user to manually advance
              setIsTimerRunning(false)
              return 0
            }
            return r - 1
          })
        }, 1000)
      }
    } else {
      setRemaining(null)
      setIsTimerRunning(false)
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
    // include isTimerRunning so toggling start/pause takes effect immediately
  }, [inSession, currentIndex, planSets, isTimerRunning])

  useEffect(() => {
    if (showAllSets && inSession && planSets.length > 0) {
      const el = rowRefs.current[currentIndex]
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, showAllSets, inSession])

  // modal selection removed; direct selects used

  // play a short beep when timer reaches 0
  useEffect(() => {
    if (remaining === 0) playBeep()
  }, [remaining])

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">{inSession ? 'メニュー実行' : 'メニュー作成'}</h2>

      {!inSession && (
        <div className="max-w-2xl space-y-4 text-gray-900">
          <section aria-labelledby="plan-date-heading" className="p-6 bg-white rounded-lg shadow-sm">
            <h3 id="plan-date-heading" className="text-lg font-semibold mb-3">日付</h3>
            <input type="date" aria-label="日付" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded px-3 py-2 bg-white text-gray-900 border" />
          </section>

          <form
            aria-labelledby="plan-add-heading"
            className="p-6 bg-white rounded-lg shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              const canAdd = exerciseId && (setType === 'reps' ? (Number.isInteger(reps) && reps >= 1) : (Number.isInteger(timeSeconds) && timeSeconds >= 1))
              if (canAdd) addSetToPlan()
            }}
          >
            <h3 id="plan-add-heading" className="text-lg font-semibold mb-3">種目を選んでセットを追加</h3>
          <label className="block mb-4">
            <div className="text-sm font-medium mb-1">種目</div>
              <div className="flex gap-2 mb-2">
                {groups.length > 0 && (
                  <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-40 rounded px-3 py-2 bg-white text-gray-900 border">
                    {groups.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
                  </select>
                )}
                <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="flex-1 rounded px-3 py-2 bg-white text-gray-900 border">
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
                </div>
                {/* 独自種目作成ボタンは一時的に非表示 */}
                {/* <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setShowCreateModal(true)} className="px-3 py-1 rounded bg-blue-600 text-white">独自種目作成</button>
                </div> */}
          </label>

          

          <div className="mb-4 p-4 bg-gray-100 rounded">
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={setType==='reps'} onChange={()=>setSetType('reps')} /> 回数
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={setType==='time'} onChange={()=>setSetType('time')} /> 時間
              </label>
            </div>

            {setType === 'reps' ? (
              <div className="flex gap-2 mb-2">
                <input type="number" min={1} value={reps} onChange={(e)=>setReps(Number(e.target.value))} className="w-24 rounded px-2 py-1 bg-white text-gray-900 border" />
                <div className="text-sm text-gray-700">回</div>
              </div>
            ) : (
              <div className="flex gap-2 mb-2">
                <input type="number" min={1} value={timeSeconds} onChange={(e)=>setTimeSeconds(Number(e.target.value))} className="w-32 rounded px-2 py-1 bg-white text-gray-900 border" />
                <div className="text-sm text-gray-700">秒</div>
              </div>
            )}

            <div className="mb-2">
              <div className="text-sm text-gray-700 mb-1">負荷（任意、kg）</div>
              <input type="number" min={0} value={weight as any} onChange={(e)=>setWeight(e.target.value === '' ? '' : Number(e.target.value))} className="w-32 rounded px-2 py-1 bg-white text-gray-900 border" />
            </div>

            <label className="mb-2 flex items-center gap-2">
              <span className="text-sm text-gray-700">きつさ（RPE 1〜10）</span>
              <input type="range" min={1} max={10} step={1} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} />
              <span className="ml-2 text-sm text-gray-700">{rpe}</span>
              <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-label="RPEの目安"
                  aria-describedby="rpe-help"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-500 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  ?
                </button>
                <span
                  id="rpe-help"
                  role="tooltip"
                  className="invisible absolute right-0 top-7 z-20 w-72 rounded border border-gray-300 bg-white p-3 text-left text-xs leading-5 text-gray-800 opacity-0 shadow-lg group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                >
                  あと何回、フォームを保ってできそうだったかで決めます。RPE 10は余力なし、9はあと1回、8はあと2回、7はあと3回、6はあと4回以上が目安です。フォームが崩れる回数は数えません。
                </span>
              </span>
            </label>

            <div className="flex gap-2">
              {(() => {
                const canAdd = exerciseId && (setType === 'reps' ? (Number.isInteger(reps) && reps >= 1) : (Number.isInteger(timeSeconds) && timeSeconds >= 1))
                return (
                  <button
                    type="button"
                    onClick={addSetToPlan}
                    disabled={!canAdd}
                    aria-disabled={!canAdd}
                    className={`px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${!canAdd ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 text-white'}`}
                  >
                    セットを追加
                  </button>
                )
              })()}
            </div>
          </div>
          

          </form>

          <section aria-labelledby="plan-sets-heading" className="p-6 bg-white rounded-lg shadow-sm">
            <h3 id="plan-sets-heading" className="text-lg font-semibold mb-3">作成中のセット</h3>
            {planSets.length === 0 && <div className="text-sm text-gray-500">まだセットがありません</div>}
            {planSets.length > 0 && (
              <div className="overflow-x-auto bg-white rounded shadow-sm">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">種目</th>
                      <th className="px-4 py-2">種類</th>
                      <th className="px-4 py-2">値</th>
                      <th className="px-4 py-2">負荷</th>
                      <th className="px-4 py-2">RPE</th>
                      <th className="px-4 py-2">推定kcal</th>
                      <th className="px-4 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planSets.map((s, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="px-4 py-3 align-top">{i+1}</td>
                                <td className="px-4 py-3 align-top text-gray-900">{s.exerciseName || exercises.find(e=>e.id===s.exerciseId)?.name || s.exerciseId}</td>
                        <td className="px-4 py-3 align-top">{s.type === 'reps' ? '回数' : '時間'}</td>
                        <td className="px-4 py-3 align-top">{s.type === 'reps' ? `${s.reps} 回` : `${s.timeSeconds} 秒`}</td>
                              <td className="px-4 py-3 align-top">{s.weight !== undefined ? `${s.weight} kg` : '-'}</td>
                              <td className="px-4 py-3 align-top">{s.rpe ?? '-'}</td>
                              <td className="px-4 py-3 align-top">{s.estimatedCaloriesKcal === undefined ? (s.calorieEnabled ? '保存時に計算' : '対象外') : `${s.estimatedCaloriesKcal} kcal`}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => moveSet(i, -1)} className="px-2 py-1 bg-gray-100 rounded">↑</button>
                            <button type="button" onClick={() => moveSet(i, 1)} className="px-2 py-1 bg-gray-100 rounded">↓</button>
                            <button type="button" onClick={() => removeSet(i)} className="px-2 py-1 bg-red-500 text-white rounded">削除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="plan-run-heading" className="p-6 bg-white rounded-lg shadow-sm">
            <h3 id="plan-run-heading" className="text-lg font-semibold mb-3">実行</h3>
            {error && (
              <div role="alert" className="text-red-600 mb-3">{error}</div>
            )}
            <div className="flex gap-3">
            <button type="button" onClick={startSession} className="px-4 py-2 rounded bg-green-600 text-white">実行開始</button>
            <button type="button" onClick={() => { setPlanSets([]); setError(null) }} className="px-4 py-2 rounded bg-gray-700 text-white">リセット</button>
            </div>
          </section>
        </div>
      )}
      {/* Create exercise modal */}
      {showCreateModal && (
        <Suspense fallback={null}>
          <CreateExerciseModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreated={(ex) => {
              setShowCreateModal(false)
              // ensure group list contains the created exercise's group
              if (ex.group) {
                const g = ex.group
                setGroups((prev) => {
                  if (prev.find((pg) => pg.id === g)) return prev
                  return [{ id: g, name: g }, ...prev]
                })
                // switch current group to the created exercise's group so it's visible
                setGroup(g)
              }
              // prepend created exercise so UI shows it immediately
              setExercises((prev) => {
                if (!ex.id || !ex.name) return prev
                if (prev.find((p) => p.id === ex.id)) return prev
                const item: Exercise = { id: ex.id, name: ex.name, group: ex.group }
                return [item, ...prev]
              })
              // backfill any existing planSets that referenced this id but lacked a name
              setPlanSets((prev) => prev.map((s) => {
                if (!s.exerciseName && s.exerciseId === ex.id) {
                  return { ...s, exerciseName: ex.name, exerciseGroup: ex.group }
                }
                return s
              }))
              // refresh from server in background for full sync
              const cat = ex.group || group
              searchExercises('', cat).then((list) => {
                setExercises((prev) => {
                  const ids = new Set(prev.map((p) => p.id))
                  // ensure incoming items have required id and name
                  const merged = list.filter((l) => l && l.id && l.name && !ids.has(l.id)) as Exercise[]
                  return [ ...prev, ...merged ]
                })
              }).catch(() => {})
              setExerciseId(ex.id)
            }}
          />
        </Suspense>
      )}

      {inSession && (
        <div className="p-6 bg-white rounded-lg max-w-2xl shadow-sm text-gray-900">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">現在のセット</div>
            <div className="px-3 py-1 bg-gray-100 rounded font-semibold text-sm">{currentIndex+1}/{planSets.length}</div>
          </div>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">種目</div>
              <div className="px-4 py-2 bg-gray-100 border rounded text-gray-900">{planSets[currentIndex].exerciseName || exercises.find(e=>e.id===planSets[currentIndex].exerciseId)?.name || planSets[currentIndex].exerciseId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">回数/時間</div>
              <div className="px-4 py-2 bg-gray-100 border rounded text-gray-900">{planSets[currentIndex].type === 'reps' ? `${planSets[currentIndex].reps} 回` : `${planSets[currentIndex].timeSeconds} 秒`}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">負荷</div>
              <div className="px-4 py-2 bg-gray-100 border rounded text-gray-900">{planSets[currentIndex].weight ? `${planSets[currentIndex].weight} kg` : '-'}</div>
            </div>
          </div>

          {planSets[currentIndex].type === 'time' && (
            <div className="text-center mb-4">
                <div className="text-6xl font-mono">{remaining !== null ? `${remaining}s` : ''}</div>
            </div>
          )}

            <div className="flex gap-3 mb-6">
            {planSets[currentIndex].type === 'time' && (
              <button
                onClick={() => setIsTimerRunning((s) => { const next = !s; if (!next && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } return next })}
                className="px-4 py-2 rounded bg-yellow-500 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                aria-pressed={isTimerRunning}
                aria-label={isTimerRunning ? '一時停止' : '開始'}
              >
                {isTimerRunning ? '一時停止' : '開始'}
              </button>
            )}
            <button onClick={() => handleNext(false)} className="px-4 py-2 rounded bg-indigo-600 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">{currentIndex+1 < planSets.length ? '次のメニューへ' : (loading ? '保存中...' : '完了して記録')}</button>
            <button onClick={()=>{ setInSession(false); setCurrentIndex(0); setIsTimerRunning(false) }} className="px-4 py-2 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">中止</button>
          </div>

          {/* Spotify player removed */}

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">全メニュー一覧</div>
              <button
                type="button"
                onClick={() => setShowAllSets((s) => !s)}
                aria-expanded={showAllSets}
                className="text-sm text-blue-600 hover:underline"
              >
                {showAllSets ? '折りたたむ' : `展開する (${planSets.length} 件)`}
              </button>
            </div>

            {showAllSets ? (
              <div className="overflow-auto max-h-64 bg-white rounded shadow-sm">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">種目</th>
                      <th className="px-4 py-2">種類</th>
                      <th className="px-4 py-2">値</th>
                      <th className="px-4 py-2">負荷</th>
                      <th className="px-4 py-2">RPE</th>
                      <th className="px-4 py-2">推定kcal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planSets.map((s, i) => (
                      <tr
                        key={i}
                        ref={(el) => { rowRefs.current[i] = el }}
                        className={`border-b ${i === currentIndex ? 'bg-indigo-100 font-semibold ring-1 ring-indigo-200' : ''}`}
                      >
                        <td className="px-4 py-3 align-top">{i+1}</td>
                        <td className="px-4 py-3 align-top text-gray-900">{s.exerciseName || exercises.find(e=>e.id===s.exerciseId)?.name || s.exerciseId}</td>
                        <td className="px-4 py-3 align-top">{s.type === 'reps' ? '回数' : '時間'}</td>
                        <td className="px-4 py-3 align-top">{s.type === 'reps' ? `${s.reps} 回` : `${s.timeSeconds} 秒`}</td>
                        <td className="px-4 py-3 align-top">{s.weight !== undefined ? `${s.weight} kg` : '-'}</td>
                        <td className="px-4 py-3 align-top">{s.rpe ?? '-'}</td>
                        <td className="px-4 py-3 align-top">{s.estimatedCaloriesKcal === undefined ? (s.calorieEnabled ? '未計算' : '対象外') : `${s.estimatedCaloriesKcal} kcal`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-gray-500">全 {planSets.length} 件 — 展開して詳細を表示</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
