import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchExercises, listExerciseGroups, canEstimate, recordTypeOf } from '../api/exercises'
import type { Exercise } from '../api/exercises'
import { getLatestBodyWeight } from '../api/bodyMeasurements'
import { ui } from '../styles/ui'
import { createRecord, previewCalories, withCalorieEstimates } from '../api/records'
import type { SetItem } from '../api/records'
import { listRoutines } from '../api/routines'
import { localDateString } from '../utils/date'
import MusicPlayer, { parsePlaylistId } from '../components/MusicPlayer'
import PlanForm from '../components/record/PlanForm'
import PlanSetsModal from '../components/record/PlanSetsModal'
import SessionView from '../components/record/SessionView'
import {
  Flow, fillSetNames, groupSets, loadPlaylistUrl, playBeep, plannedKcalText, savePlaylistUrl, splitFirstExercise,
} from '../components/record/recordUtils'

// 記録画面。状態と処理をここに持ち、表示は components/record/ の部品に分ける
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

  // 作成中のセットと、追加するセットの入力値
  const [planSets, setPlanSets] = useState<SetItem[]>([])
  const [reps, setReps] = useState<number>(8)
  const [timeSeconds, setTimeSeconds] = useState<number>(60)
  const [weight, setWeight] = useState<number | ''>('')
  const [rpe, setRpe] = useState<number>(6)
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null)

  // 実行中の状態
  const [inSession, setInSession] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  // 時間セットのカウントダウン
  const [remaining, setRemaining] = useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const timerRef = useRef<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [group, setGroup] = useState<string>('')

  function applyExercises(exs: Exercise[]) {
    setExercises(exs)
    setPlanSets((prev) => fillSetNames(prev, exs))
  }

  // 部位の一覧を取得し、最初の部位を選ぶ（種目は下の部位の effect で取得する）。部位を取得できなければ全種目を出す
  useEffect(() => {
    let cancelled = false
    listExerciseGroups().then((gs) => {
      if (cancelled) return
      setGroups(gs)
      const initial = gs.length ? gs[0].id : ''
      setGroup(initial)
      if (!initial) searchExercises().then((exs) => { if (!cancelled) applyExercises(exs) }).catch(() => { if (!cancelled) setExercises([]) })
    }).catch(() => {
      if (cancelled) return
      searchExercises().then((exs) => { if (!cancelled) applyExercises(exs) }).catch(() => { if (!cancelled) setExercises([]) })
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!group) return
    searchExercises('', group).then((exs) => { if (!cancelled) applyExercises(exs) }).catch(() => { if (!cancelled) setExercises([]) })
    return () => { cancelled = true }
  }, [group])

  // カロリー推定には、身体測定で登録した最新の体重を使う
  useEffect(() => {
    getLatestBodyWeight().then(setBodyWeightKg).catch(() => setBodyWeightKg(null))
  }, [])

  // 保存済メニュー選択画面から ?menuId=…（&autoStart=1）で来たら、メニューのセットを取り込む
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    const menuId = qs.get('menuId')
    if (!menuId) return
    Promise.all([listRoutines(), searchExercises().catch(() => [] as Exercise[]), getLatestBodyWeight().catch(() => null)]).then(([routines, catalog, latestWeight]) => {
      const menu = routines.find((item) => item.id === menuId)
      if (!menu) return
      const converted: SetItem[] = menu.exercises.map((me) => {
        const chosen = catalog.find((exercise) => exercise.id === me.exerciseId)
        const s: SetItem = { type: me.type, exerciseId: me.exerciseId, exerciseName: me.exerciseName, exerciseGroup: chosen?.group, rpe: 6 }
        if (me.type === 'reps') s.reps = me.reps
        else s.timeSeconds = me.timeSeconds
        if (me.weight !== undefined) s.weight = me.weight
        s.calorieEnabled = canEstimate(chosen, me.type)
        if (latestWeight !== null) s.bodyWeightKg = latestWeight
        return s
      })
      if (flow === 'step') {
        const [first, rest] = splitFirstExercise(converted)
        setPlanSets(first)
        setPendingMenuSets(rest)
      } else {
        setPlanSets(converted)
      }
      if (qs.get('autoStart')) {
        if (converted.length) setExerciseId(converted[0].exerciseId || '')
        setAutoStartPending(true)
      }
      // 再読み込みで二重に取り込まないよう、URLからmenuIdを消す
      qs.delete('menuId')
      window.history.replaceState({}, '', window.location.pathname + (qs.toString() ? `?${qs.toString()}` : ''))
    }).catch(() => setError('保存メニューを取得できませんでした'))
  }, [])

  // メニューのセットを取り込んだら、自動開始の指定があれば実行を始める
  useEffect(() => {
    if (autoStartPending && planSets.length > 0) {
      setAutoStartPending(false)
      startSession()
    }
  }, [autoStartPending, planSets])

  useEffect(() => {
    if (exercises.length && !exerciseId) setExerciseId(exercises[0].id)
  }, [exercises, exerciseId])

  // 作成中のセットごとに、予定のRPEで消費カロリーを見積もる（保存時と同じ式。サーバーには保存しない）
  const previewRequested = useRef(new WeakSet<SetItem>())
  useEffect(() => {
    for (const s of planSets) {
      if (s.plannedCaloriesKcal !== undefined || previewRequested.current.has(s)) continue
      previewRequested.current.add(s)
      previewCalories(s, bodyWeightKg).then((kcal) => {
        setPlanSets((prev) => prev.map((p) => p === s ? { ...p, plannedCaloriesKcal: kcal } : p))
      })
    }
  }, [planSets, bodyWeightKg])
  const plannedKcal = plannedKcalText(planSets)

  // 記録形式は種目ごとに決まっており、メニュー作成では変更できない
  const setType = recordTypeOf(exercises.find((e) => e.id === exerciseId))
  const canAdd = Boolean(exerciseId) && (setType === 'reps' ? (Number.isInteger(reps) && reps >= 1) : (Number.isInteger(timeSeconds) && timeSeconds >= 1))
  // 完了した種目を、実行した順に種目単位でまとめる
  const completedGroups = groupSets(completedSets, exercises)


  function addSetToPlan() {
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

    // 種目名と部位は追加した時点の値を控え、あとで変わらないようにする
    const newSet: SetItem = { type: setType, exerciseId, exerciseName: chosen?.name, exerciseGroup: chosen?.group, rpe, calorieEnabled }
    if (setType === 'reps') newSet.reps = reps
    else newSet.timeSeconds = timeSeconds
    if (weight !== '') newSet.weight = Number(weight)
    if (bodyWeightKg !== null) newSet.bodyWeightKg = bodyWeightKg
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
      const ni = idx + dir
      if (ni < 0 || ni >= s.length) return s
      const arr = [...s]
      ;[arr[ni], arr[idx]] = [arr[idx], arr[ni]]
      return arr
    })
  }

  function removeSet(idx: number) { setPlanSets((s) => s.filter((_,i)=>i!==idx)) }

  // 時間セットは、表示だけ準備して利用者が「開始」を押すまで動かさない（autoRun時を除く）
  function prepareTimer(set: SetItem | undefined, autoRun = false) {
    setRemaining(set && set.type === 'time' ? set.timeSeconds || 0 : null)
    setIsTimerRunning(Boolean(set && set.type === 'time' && autoRun))
  }

  function startSession() {
    if (planSets.length === 0) return setError('少なくとも1つのセットを追加してください')
    // 保存済みメニューから始めたときなど、種目が未選択なら先頭のセットの種目にする
    if (!exerciseId && planSets[0].exerciseId) setExerciseId(planSets[0].exerciseId)
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
    prepareTimer(planSets[0])
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

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function handleNext() {
    stopTimer()
    if (currentIndex + 1 < planSets.length) {
      setCurrentIndex(currentIndex + 1)
      prepareTimer(planSets[currentIndex + 1])
    } else {
      setIsTimerRunning(false)
      if (flow === 'step') completeCurrentExercise()
      else finishAndSave(planSets)
    }
  }

  // 時間セットのカウントダウン。0で止まり、次へは利用者が進める
  useEffect(() => {
    stopTimer()
    const current = planSets[currentIndex]
    if (inSession && current && current.type === 'time') {
      if (remaining === null) setRemaining(current.timeSeconds || 0)
      if (isTimerRunning) {
        timerRef.current = window.setInterval(() => {
          setRemaining((r) => {
            if (r === null) return r
            if (r <= 1) {
              stopTimer()
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
    return stopTimer
  }, [inSession, currentIndex, planSets, isTimerRunning])

  // タイマーが0になったら合図音を鳴らし、その間は音楽の音量を下げる
  useEffect(() => {
    if (remaining === 0) { playBeep(); setDuckSignal((n) => n + 1) }
  }, [remaining])

  const hasCompleted = flow === 'step' && completedSets.length > 0

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
        <PlanForm
          groups={groups}
          group={group}
          onGroupChange={setGroup}
          exercises={exercises}
          exerciseId={exerciseId}
          onExerciseChange={setExerciseId}
          setType={setType}
          reps={reps}
          onRepsChange={setReps}
          timeSeconds={timeSeconds}
          onTimeSecondsChange={setTimeSeconds}
          weight={weight}
          onWeightChange={setWeight}
          rpe={rpe}
          onRpeChange={setRpe}
          canAdd={canAdd}
          onAdd={addSetToPlan}
          playlistUrl={playlistUrl}
          onPlaylistUrlChange={setPlaylistUrl}
          completedSummary={hasCompleted ? completedGroups.map((g, i) => `${i + 1}. ${g.name}（${g.count}セット）`) : []}
          planCount={planSets.length}
          planSummary={groupSets(planSets).map((g) => `${g.name}×${g.count}`).join('、')}
          plannedKcal={plannedKcal}
          onShowPlan={() => setShowPlan(true)}
          startLabel={flow === 'step' ? 'この種目を実行' : '実行開始'}
          onStart={startSession}
          onFinish={hasCompleted ? () => finishAndSave(completedSets) : undefined}
          finishOnlyCompletedNote={hasCompleted && planSets.length > 0}
          loading={loading}
          notice={notice}
          error={error}
        />
      )}

      <PlanSetsModal
        open={showPlan}
        onClose={() => setShowPlan(false)}
        sets={planSets}
        exercises={exercises}
        upcoming={groupSets(pendingMenuSets).map((g) => g.name)}
        onMove={moveSet}
        onRemove={removeSet}
        onClear={() => { setPlanSets([]); setError(null) }}
      />

      {inSession && (
        <SessionView
          sets={planSets}
          exercises={exercises}
          currentIndex={currentIndex}
          heading={flow === 'step' ? `${completedGroups.length + 1}種目目・現在のセット` : '現在のセット'}
          finishLabel={flow === 'step' ? 'この種目を完了' : (loading ? '保存中...' : '完了して記録')}
          rpe={planSets[currentIndex]?.rpe ?? 6}
          onRpeChange={(value) => setPlanSets((prev) => prev.map((s, i) => i === currentIndex ? { ...s, rpe: value } : s))}
          remaining={remaining}
          isTimerRunning={isTimerRunning}
          onToggleTimer={() => setIsTimerRunning((s) => { if (s) stopTimer(); return !s })}
          onNext={handleNext}
          onStop={() => { setInSession(false); setCurrentIndex(0); setIsTimerRunning(false) }}
          error={error}
        />
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
