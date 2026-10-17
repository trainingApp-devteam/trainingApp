import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchExercises, listExerciseGroups, canEstimate } from '../api/exercises'
import type { Exercise } from '../api/exercises'
import { getLatestBodyWeight } from '../api/bodyMeasurements'
import { ui } from '../styles/ui'
import { createRecord, withCalorieEstimates } from '../api/records'
import type { SetItem } from '../api/records'
import { listRoutines } from '../api/routines'
import { localDateString } from '../utils/date'
import MusicPlayer, { parsePlaylistId } from '../components/MusicPlayer'
import Modal from '../components/Modal'
// Spotify integration removed — restored original Record page
// ExerciseSelect modal removed

// batch: 全種目のセットを組んでからまとめて実行（従来）
// step: 1種目のセットを組んで実行し、終わったら次の種目を設定する
type Flow = 'batch' | 'step'

// 回数では推定できない（時間のみ推定できる）種目。有酸素マシンが該当する
function timeOnly(exercise: Exercise | undefined): boolean {
  const bases = exercise?.calorieBases || []
  return bases.includes('MINUTE') && !bases.includes('REP')
}

// 実行時に流すプレイリストのURL。端末ごとの入力の手間を省くためだけに保存する
const PLAYLIST_STORAGE_KEY = 'trainingApp.playlistUrl'

function loadPlaylistUrl(): string {
  try { return localStorage.getItem(PLAYLIST_STORAGE_KEY) || '' } catch { return '' }
}

function savePlaylistUrl(url: string) {
  try {
    if (url) localStorage.setItem(PLAYLIST_STORAGE_KEY, url)
    else localStorage.removeItem(PLAYLIST_STORAGE_KEY)
  } catch { /* 保存できなくても実行は続ける */ }
}

// 連続する同じ種目のセットを「種目名×セット数」にまとめる
function groupSets(sets: SetItem[]): Array<{ name: string; count: number }> {
  const groups: Array<{ exerciseId?: string; name: string; count: number }> = []
  for (const set of sets) {
    const last = groups[groups.length - 1]
    if (last && last.exerciseId === set.exerciseId) last.count += 1
    else groups.push({ exerciseId: set.exerciseId, name: set.exerciseName || '種目', count: 1 })
  }
  return groups
}

// セットを種目名の並びにまとめる（連続する同じ種目は1つ）
function splitGroups(sets: SetItem[]): string[] {
  const names: string[] = []
  let rest = sets
  while (rest.length > 0) {
    const [first, others] = splitFirstExercise(rest)
    names.push(first[0].exerciseName || '種目')
    rest = others
  }
  return names
}

// 先頭の種目のセット（連続する同じ種目）と、それ以降に分ける
function splitFirstExercise(sets: SetItem[]): [SetItem[], SetItem[]] {
  let n = 0
  while (n < sets.length && sets[n].exerciseId === sets[0].exerciseId) n++
  return [sets.slice(0, n), sets.slice(n)]
}

export default function Record(): JSX.Element {
  const navigate = useNavigate()
  const [autoStartPending, setAutoStartPending] = useState(false)
  // 進め方は記録方法の選択画面で選び、?flow=step で受け取る
  const [searchParams] = useSearchParams()
  const [flow] = useState<Flow>(() => searchParams.get('flow') === 'step' ? 'step' : 'batch')
  // 1種目ずつの進め方で保存済みメニューを使うとき、まだ設定に出していない種目のセット
  const [pendingMenuSets, setPendingMenuSets] = useState<SetItem[]>([])
  // 1種目ずつの進め方で、実行を終えた種目のセット
  const [completedSets, setCompletedSets] = useState<SetItem[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  // タイマー終了音を鳴らすたびに増やし、音楽の音量を一時的に下げる
  const [duckSignal, setDuckSignal] = useState(0)
  const [playlistUrl, setPlaylistUrl] = useState(loadPlaylistUrl)
  // 実行開始時に確定したプレイリスト。nullなら音楽を流さない
  const [musicPlaylistId, setMusicPlaylistId] = useState<string | null>(null)
  const [showPlan, setShowPlan] = useState(false)

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
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null)

  // session state
  const [inSession, setInSession] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [group, setGroup] = useState<string>('')



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

  // カロリー推定には、身体測定で登録した最新の体重を使う
  useEffect(() => {
    getLatestBodyWeight().then(setBodyWeightKg).catch(() => setBodyWeightKg(null))
  }, [])

  // read possible menuId from query to auto-apply
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search)
      const menuId = qs.get('menuId')
      if (!menuId) return
      Promise.all([listRoutines(), searchExercises().catch(() => [] as Exercise[]), getLatestBodyWeight().catch(() => null)]).then(([routines, catalog, latestWeight]) => {
      const menu = routines.find((item) => item.id === menuId)
      if (!menu) return
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
        s.calorieEnabled = canEstimate(chosen, me.type)
        if (latestWeight !== null) s.bodyWeightKg = latestWeight
        return s as SetItem
      })
      if (flow === 'step') {
        const [first, rest] = splitFirstExercise(converted)
        setPlanSets(first)
        setPendingMenuSets(rest)
      } else {
        setPlanSets(converted)
      }
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

  const selectedExercise = exercises.find((e) => e.id === exerciseId)
  const selectedTimeOnly = timeOnly(selectedExercise)
  const canAdd = Boolean(exerciseId) && (setType === 'reps' ? (Number.isInteger(reps) && reps >= 1) : (Number.isInteger(timeSeconds) && timeSeconds >= 1))
  // 完了した種目を、実行した順に種目単位でまとめる
  const completedGroups = completedSets.reduce<Array<{ exerciseId?: string; name: string; count: number }>>((groups, set) => {
    const last = groups[groups.length - 1]
    if (last && last.exerciseId === set.exerciseId) last.count += 1
    else groups.push({ exerciseId: set.exerciseId, name: set.exerciseName || exercises.find((e) => e.id === set.exerciseId)?.name || '種目', count: 1 })
    return groups
  }, [])

  // 有酸素マシンは回数では推定できないため、時間で記録する
  useEffect(() => {
    if (selectedTimeOnly) setSetType('time')
  }, [selectedTimeOnly])

  function addSetToPlan() {
    // validate current inputs before adding
    if (!exerciseId) return setError('種目を選択してください')
    if (flow === 'step' && planSets.some((s) => s.exerciseId !== exerciseId)) {
      return setError('1種目ずつ実行では、同じ種目のセットだけを追加できます。この種目を実行してから次の種目を設定してください')
    }
    if (setType === 'reps') {
      if (!Number.isInteger(reps) || reps < 1) return setError('回数は1以上の整数を入力してください')
    } else {
      if (!Number.isInteger(timeSeconds) || timeSeconds < 1) return setError('時間は1秒以上の整数を入力してください')
    }
    if (weight !== '' && (Number.isNaN(Number(weight)) || Number(weight) < 0)) return setError('負荷は0以上の数値で入力してください')

    const chosen = exercises.find((e) => e.id === exerciseId)
    const calorieEnabled = canEstimate(chosen, setType)
    if (calorieEnabled && bodyWeightKg === null) return setError('消費カロリーを推定するには、身体測定で体重を登録してください')

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
    setNotice(null)
  }

  

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
        setError('消費カロリーを推定するには、身体測定で体重を登録してください')
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
    const url = playlistUrl.trim()
    const playlistId = parsePlaylistId(url)
    if (url && !playlistId) return setError('プレイリストのURLを確認してください（例: https://www.youtube.com/playlist?list=…）')
    savePlaylistUrl(url)
    setMusicPlaylistId(playlistId)
    setError(null)
    setNotice(null)
    setShowPlan(false)
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

  async function finishAndSave(sets: SetItem[]) {
    if (sets.length === 0) return setError('記録するセットがありません')
    setLoading(true)
    try {
      const calculatedSets = await withCalorieEstimates(sets, bodyWeightKg)
      await createRecord({ date, exerciseId: sets[0].exerciseId || exerciseId, sets: calculatedSets })
      navigate('/history')
    } catch (err: any) {
      setError(err.message || '保存に失敗しました')
    } finally { setLoading(false) }
  }

  // 1種目ずつ: 実行し終えた種目のセットを完了済みへ移し、次の種目の設定へ戻る
  function completeCurrentExercise() {
    const finished = planSets
    const name = finished[0]?.exerciseName || '種目'
    const [next, rest] = splitFirstExercise(pendingMenuSets)
    setCompletedSets((done) => [...done, ...finished])
    setPlanSets(next)
    setPendingMenuSets(rest)
    setInSession(false)
    setCurrentIndex(0)
    setIsTimerRunning(false)
    if (next.length > 0) {
      if (next[0].exerciseId) setExerciseId(next[0].exerciseId)
      setNotice(`「${name}」が完了しました。次は「${next[0].exerciseName || '種目'}」です。「この種目を実行」で始めるか、「完了して記録」で保存してください`)
    } else {
      setNotice(`「${name}」が完了しました。次の種目を設定するか、「完了して記録」で保存してください`)
    }
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
      if (flow === 'step') completeCurrentExercise()
      else finishAndSave(planSets)
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
    if (remaining === 0) { playBeep(); setDuckSignal((n) => n + 1) }
  }, [remaining])

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-4 flex max-w-2xl flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{inSession ? 'メニュー実行' : 'メニュー作成'}</h2>
        {!inSession && (
          <label className="flex items-center gap-2 text-sm text-gray-200">
            日付
            <input type="date" aria-label="日付" value={date} onChange={(e) => setDate(e.target.value)} className={`${ui.field} py-1`} />
          </label>
        )}
      </div>

      {!inSession && (
        <form
          aria-label="メニュー作成"
          className={`max-w-2xl space-y-3 ${ui.card}`}
          onSubmit={(e) => { e.preventDefault(); if (canAdd) addSetToPlan() }}
        >
          {flow === 'step' && completedSets.length > 0 && (
            <section aria-label="完了した種目" className={ui.muted}>
              完了: {completedGroups.map((g, i) => `${i + 1}. ${g.name}（${g.count}セット）`).join(' / ')}
            </section>
          )}

          <div className="flex gap-2">
            {groups.length > 0 && (
              <select aria-label="部位" value={group} onChange={(e) => setGroup(e.target.value)} className={`w-32 ${ui.field}`}>
                {groups.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
              </select>
            )}
            <select aria-label="種目" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className={`min-w-0 flex-1 ${ui.field}`}>
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {setType === 'reps' ? (
              <input type="number" min={1} aria-label="回数" value={reps} onChange={(e)=>setReps(Number(e.target.value))} className={`w-20 ${ui.field}`} />
            ) : (
              <input type="number" min={1} aria-label="秒数" value={timeSeconds} onChange={(e)=>setTimeSeconds(Number(e.target.value))} className={`w-20 ${ui.field}`} />
            )}
            {/* 筋トレ種目は回数・時間のどちらでも記録できる。有酸素マシンは時間に固定 */}
            <select aria-label="記録形式" value={setType} disabled={selectedTimeOnly} onChange={(e) => setSetType(e.target.value as 'reps' | 'time')} className={ui.field}>
              <option value="reps">回</option>
              <option value="time">秒</option>
            </select>
            <input type="number" min={0} placeholder="負荷" aria-label="負荷（kg・任意）" value={weight as any} onChange={(e)=>setWeight(e.target.value === '' ? '' : Number(e.target.value))} className={`ml-2 w-20 ${ui.field}`} />
            <span className="text-sm text-gray-200">kg</span>
          </div>
          {selectedTimeOnly && <p className={ui.muted}>この種目は消費カロリーを推定するため、時間で記録します。</p>}

          {/* 説明は行の幅に収め、スマートフォン幅でも横にはみ出さないようにする */}
          <div className="relative flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-200">RPE</span>
              <input type="range" min={1} max={10} step={1} aria-label="きつさ（RPE 1〜10）" value={rpe} onChange={(e) => setRpe(Number(e.target.value))} />
              <span className="w-5 text-sm text-gray-200">{rpe}</span>
            </label>
            <span className="group inline-flex">
              <button
                type="button"
                aria-label="RPEの目安"
                aria-describedby="rpe-help"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs font-semibold text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                ?
              </button>
              <span
                id="rpe-help"
                role="tooltip"
                className="invisible absolute left-0 right-0 top-full z-20 mt-1 rounded border border-white/20 bg-gray-800 p-3 text-left text-xs leading-5 text-gray-100 opacity-0 shadow-lg group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                あと何回、フォームを保ってできそうだったかで決めます。RPE 10は余力なし、9はあと1回、8はあと2回、7はあと3回、6はあと4回以上が目安です。フォームが崩れる回数は数えません。
              </span>
            </span>
            <button type="submit" disabled={!canAdd} className={`ml-auto ${ui.btnSuccess} ${ui.btnSmall}`}>セットを追加</button>
          </div>

          <label className="block border-t border-white/10 pt-3">
            <span className={ui.label}>実行時に流すプレイリスト（YouTubeのURL・任意）</span>
            <input
              // type="url"だとIDだけの入力でフォーム送信（セットを追加）が止まるため、テキストで受けて実行開始時に検証する
              type="text"
              inputMode="url"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://www.youtube.com/playlist?list=…"
              className={ui.input}
            />
          </label>

          {notice && <div role="status" className={ui.success}>{notice}</div>}
          {error && <div role="alert" className={ui.error}>{error}</div>}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowPlan(true)} className={ui.btnSecondary}>作成中のセット（{planSets.length}）</button>
            <button type="button" onClick={startSession} className={ui.btnPrimary}>{flow === 'step' ? 'この種目を実行' : '実行開始'}</button>
            {flow === 'step' && completedSets.length > 0 && (
              <button type="button" onClick={() => finishAndSave(completedSets)} disabled={loading} className={ui.btnPrimary}>{loading ? '保存中...' : '完了して記録'}</button>
            )}
          </div>
          {planSets.length > 0 && (
            <p className={ui.muted}>{groupSets(planSets).map((g) => `${g.name}×${g.count}`).join('、')}</p>
          )}
          {flow === 'step' && completedSets.length > 0 && planSets.length > 0 && (
            <p className={ui.muted}>「完了して記録」では、実行を終えた種目だけを保存します。</p>
          )}
        </form>
      )}

      <Modal open={showPlan} title="作成中のセット" onClose={() => setShowPlan(false)}>
        {planSets.length === 0 && <div className="text-sm text-gray-300">まだセットがありません</div>}
        {planSets.length > 0 && (
          <ol className="divide-y divide-white/10 rounded-lg ring-1 ring-white/10">
            {planSets.map((s, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-gray-300">{i+1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-gray-100">{s.exerciseName || exercises.find(e=>e.id===s.exerciseId)?.name || s.exerciseId}</div>
                  <div className="text-xs text-gray-300">
                    {[
                      s.type === 'reps' ? `${s.reps} 回` : `${s.timeSeconds} 秒`,
                      s.weight !== undefined ? `${s.weight} kg` : null,
                      `RPE ${s.rpe ?? '-'}`,
                      s.estimatedCaloriesKcal === undefined ? (s.calorieEnabled ? '保存時にkcal計算' : 'kcal対象外') : `${s.estimatedCaloriesKcal} kcal`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`セット${i+1}を上へ`} onClick={() => moveSet(i, -1)} className="px-2 py-1 bg-gray-700 text-gray-100 hover:bg-gray-600 rounded">↑</button>
                  <button type="button" aria-label={`セット${i+1}を下へ`} onClick={() => moveSet(i, 1)} className="px-2 py-1 bg-gray-700 text-gray-100 hover:bg-gray-600 rounded">↓</button>
                  <button type="button" aria-label={`セット${i+1}を削除`} onClick={() => removeSet(i)} className="px-2 py-1 bg-red-700 text-white hover:bg-red-800 rounded">×</button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {pendingMenuSets.length > 0 && (
          <p className={`mt-2 ${ui.muted}`}>このあとの種目: {splitGroups(pendingMenuSets).join(' → ')}</p>
        )}
        {planSets.length > 0 && (
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => { setPlanSets([]); setError(null) }} className={`${ui.btnDanger} ${ui.btnSmall}`}>すべて削除</button>
          </div>
        )}
      </Modal>

      {inSession && (
        <div className={`max-w-2xl ${ui.card}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-300">{flow === 'step' ? `${completedGroups.length + 1}種目目・現在のセット` : '現在のセット'}</div>
            <div className="px-3 py-1 bg-black/30 rounded font-semibold text-sm text-gray-100">{currentIndex+1}/{planSets.length}</div>
          </div>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-300 mb-1">種目</div>
              <div className="px-4 py-2 bg-black/30 ring-1 ring-white/10 rounded text-gray-100">{planSets[currentIndex].exerciseName || exercises.find(e=>e.id===planSets[currentIndex].exerciseId)?.name || planSets[currentIndex].exerciseId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-300 mb-1">回数/時間</div>
              <div className="px-4 py-2 bg-black/30 ring-1 ring-white/10 rounded text-gray-100">{planSets[currentIndex].type === 'reps' ? `${planSets[currentIndex].reps} 回` : `${planSets[currentIndex].timeSeconds} 秒`}</div>
            </div>
            <div>
              <div className="text-xs text-gray-300 mb-1">負荷</div>
              <div className="px-4 py-2 bg-black/30 ring-1 ring-white/10 rounded text-gray-100">{planSets[currentIndex].weight ? `${planSets[currentIndex].weight} kg` : '-'}</div>
            </div>
          </div>

          {error && <div role="alert" className={`mb-3 ${ui.error}`}>{error}</div>}

          {planSets[currentIndex].type === 'time' && (
            <div className="text-center mb-4">
                <div className="text-6xl font-mono">{remaining !== null ? `${remaining}s` : ''}</div>
            </div>
          )}

            <div className="flex gap-3 mb-6">
            {planSets[currentIndex].type === 'time' && (
              <button
                onClick={() => setIsTimerRunning((s) => { const next = !s; if (!next && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } return next })}
                className="px-4 py-2 rounded bg-yellow-500 text-gray-900 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                aria-pressed={isTimerRunning}
                aria-label={isTimerRunning ? '一時停止' : '開始'}
              >
                {isTimerRunning ? '一時停止' : '開始'}
              </button>
            )}
            <button onClick={() => handleNext(false)} className="px-4 py-2 rounded bg-indigo-600 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">{currentIndex+1 < planSets.length ? '次のメニューへ' : flow === 'step' ? 'この種目を完了' : (loading ? '保存中...' : '完了して記録')}</button>
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
                className="text-sm text-indigo-300 hover:underline"
              >
                {showAllSets ? '折りたたむ' : `展開する (${planSets.length} 件)`}
              </button>
            </div>

            {showAllSets ? (
              <div className="overflow-auto max-h-64 rounded-lg ring-1 ring-white/10">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/20 text-gray-300">
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
                        className={`border-b border-white/10 ${i === currentIndex ? 'bg-indigo-500/25 font-semibold ring-1 ring-indigo-300/50' : ''}`}
                      >
                        <td className="px-4 py-3 align-top">{i+1}</td>
                        <td className="px-4 py-3 align-top text-gray-100">{s.exerciseName || exercises.find(e=>e.id===s.exerciseId)?.name || s.exerciseId}</td>
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
              <div className="text-sm text-gray-300">全 {planSets.length} 件 — 展開して詳細を表示</div>
            )}
          </div>
        </div>
      )}

      {/* 音楽は実行中だけ表示する。1種目ずつ実行で次の種目を設定する間は隠して一時停止し、次の実行で再開する */}
      {musicPlaylistId && (
        <div className={inSession ? 'mt-4 max-w-2xl' : 'hidden'}>
          <MusicPlayer key={musicPlaylistId} playlistId={musicPlaylistId} autoPlay suspended={!inSession} duckSignal={duckSignal} />
        </div>
      )}
    </div>
  )
}
