import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExerciseProgress, getExerciseProgress, listRecordedExercises, RecordedExercise } from '../api/statistics'
import LineChart, { ChartPoint } from '../components/LineChart'
import PeriodSelect, { Period, periodStart } from '../components/PeriodSelect'
import { localDateString } from '../utils/date'
import { ui } from '../styles/ui'

// 種目別の推移。記録（セッション）ごとに1点。指標ごとに単位が違うため、1指標1グラフにする
export default function Progress(): JSX.Element {
  const [exercises, setExercises] = useState<RecordedExercise[] | null>(null)
  const [exerciseId, setExerciseId] = useState<number | null>(null)
  const [period, setPeriod] = useState<Period>('3m')
  const [progress, setProgress] = useState<ExerciseProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRecordedExercises()
      .then((list) => {
        setExercises(list)
        if (list.length) setExerciseId(list[0].exerciseId)
      })
      .catch((e) => { setExercises([]); setError(e instanceof Error ? e.message : '種目を取得できませんでした') })
  }, [])

  useEffect(() => {
    if (exerciseId === null) return
    let cancelled = false
    const start = periodStart(period)
    setLoading(true)
    getExerciseProgress(exerciseId, start ? localDateString(start) : null)
      .then((result) => { if (!cancelled) { setProgress(result); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '推移を取得できませんでした') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [exerciseId, period])

  const points = progress?.points || []
  const series = (pick: (p: (typeof points)[number]) => number | null): ChartPoint[] =>
    points.flatMap((p) => { const y = pick(p); return y === null ? [] : [{ x: p.trainingDate, y }] })
  const maxWeight = series((p) => p.maxWeightKg)
  const volume = series((p) => p.volumeKg)
  const reps = series((p) => (p.totalReps > 0 ? p.totalReps : null))
  const minutes = series((p) => (p.totalDurationSeconds > 0 ? p.totalDurationSeconds / 60 : null))
  const kcal = series((p) => p.estimatedCaloriesKcal)
  const hasWeight = maxWeight.length > 0

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="mb-4 text-2xl font-semibold">種目別の推移</h2>

      {exercises === null && <div className="text-gray-300">読み込み中...</div>}
      {exercises !== null && exercises.length === 0 && !error && (
        <div className={`max-w-3xl ${ui.card}`}>
          <p className="text-gray-200">まだ記録がありません。トレーニングを記録すると、種目ごとの推移を確認できます。</p>
          <Link to="/record/select" className={`mt-4 inline-block ${ui.btnPrimary}`}>トレーニングを記録</Link>
        </div>
      )}
      {error && <div role="alert" className={`mb-3 ${ui.error}`}>{error}</div>}

      {exercises !== null && exercises.length > 0 && (
        <div className="max-w-3xl space-y-4">
          <section className={`${ui.card} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`} aria-label="表示条件">
            <div className="flex-1">
              <label htmlFor="progress-exercise" className={ui.label}>種目</label>
              <select
                id="progress-exercise"
                value={exerciseId ?? ''}
                onChange={(e) => setExerciseId(Number(e.target.value))}
                className={`w-full ${ui.field}`}
              >
                {exercises.map((exercise) => (
                  <option key={exercise.exerciseId} value={exercise.exerciseId}>
                    {exercise.exerciseName}（{exercise.sessionCount}回）
                  </option>
                ))}
              </select>
            </div>
            <PeriodSelect value={period} onChange={setPeriod} label="推移の期間" />
          </section>

          <section className={ui.card} aria-label={`${progress?.exerciseName ?? ''}の推移`}>
            {loading && <div className="text-gray-300">読み込み中...</div>}
            {!loading && progress && points.length === 0 && (
              <div className="rounded-lg bg-black/20 p-4 text-sm text-gray-300">この期間に「{progress.exerciseName}」の記録はありません。期間を広げてください。</div>
            )}
            {!loading && progress && points.length > 0 && (
              <div className="space-y-6">
                <p className={ui.muted}>記録ごとに1点を表示します（{points.length}件）。</p>
                {hasWeight && (
                  <LineChart title="最大重量" unit="kg" points={maxWeight} note="重量を入力したセットの最大値。重量のない記録は点を表示しません。" />
                )}
                {volume.length > 0 && (
                  <LineChart title="トレーニング量" unit="kg" digits={0} points={volume} note="重量×回数の合計。時間で記録したセットと重量のないセットは含みません。" />
                )}
                {reps.length > 0 && !hasWeight && <LineChart title="合計回数" unit="回" digits={0} points={reps} />}
                {minutes.length > 0 && <LineChart title="合計時間" unit="分" points={minutes} note="時間で記録したセットの合計（休憩は含みません）。" />}
                {kcal.length > 0 && <LineChart title="推定消費カロリー" unit="kcal" points={kcal} note="推定値。推定できたセットの合計です。" />}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
