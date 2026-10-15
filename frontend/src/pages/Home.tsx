import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRecords, RecordItem } from '../api/records'
import { BodyMeasurement, latestMeasurements, listBodyMeasurements, MeasurementType } from '../api/bodyMeasurements'
import { useAuth } from '../auth/AuthContext'
import { formatDateTime } from '../utils/date'
import { ui } from '../styles/ui'

const bodyItems: Array<{ type: MeasurementType; label: string; unit: string }> = [
  { type: 'height_cm', label: '身長', unit: 'cm' },
  { type: 'weight_kg', label: '体重', unit: 'kg' },
  { type: 'body_fat_pct', label: '体脂肪', unit: '%' },
]

function BodyStats({ measurements }: { measurements: BodyMeasurement[] }): JSX.Element {
  const latest = latestMeasurements(measurements)
  const noneRegistered = bodyItems.every((item) => !latest[item.type])

  return (
    <section aria-labelledby="body-stats-heading" className="mb-6">
      <h2 id="body-stats-heading" className="mb-3 text-lg font-semibold text-gray-100">現在の身体データ</h2>
      {noneRegistered && (
        <div role="status" className="mb-3 flex flex-col gap-3 rounded-2xl bg-indigo-500/15 p-4 ring-1 ring-indigo-300/40 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-gray-100">身長・体重・体脂肪がまだ登録されていません。身体測定で登録しましょう（体重はカロリー推定にも使います）。</p>
          <Link to="/body" className={`${ui.btnPrimary} shrink-0 text-center`}>身体測定を登録する</Link>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {bodyItems.map((item) => {
          const value = latest[item.type]
          return (
            <div key={item.type} className={ui.card} data-testid={`body-${item.type}`}>
              <div className="text-sm font-medium text-gray-300">{item.label}</div>
              {value ? (
                <>
                  <div className="mt-1 text-4xl font-bold text-white sm:text-5xl">
                    {value.value}<span className="ml-1 text-xl font-medium text-gray-300">{item.unit}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-300">測定日時: <time dateTime={value.measuredAt}>{formatDateTime(value.measuredAt)}</time></div>
                </>
              ) : (
                <>
                  <div className="mt-1 text-2xl font-semibold text-gray-200">未登録</div>
                  <Link to="/body" className={`mt-2 inline-block text-sm ${ui.link}`}>身体測定で登録する</Link>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function Home(): JSX.Element {
  const { status } = useAuth()
  const [records, setRecords] = useState<RecordItem[]>([])
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [measurementsLoaded, setMeasurementsLoaded] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') {
      setRecords([])
      setMeasurements([])
      setMeasurementsLoaded(false)
      return
    }
    listRecords().then(setRecords).catch(() => setRecords([]))
    listBodyMeasurements()
      .then(setMeasurements)
      .catch(() => setMeasurements([]))
      .finally(() => setMeasurementsLoaded(true))
  }, [status])

  if (status === 'loading') return <div className="container mx-auto px-4 py-10 text-gray-300">読み込み中...</div>

  if (status === 'anonymous') {
    return (
      <div className="container mx-auto px-4 py-8">
        <section className={`mx-auto max-w-xl p-8 text-center ${ui.card}`}>
          <h2 className="mb-3 text-xl font-semibold text-gray-100">ログインしてください</h2>
          <p className="mb-6 text-gray-300">トレーニングの記録やメニューの作成には、ログインが必要です。</p>
          <Link to="/account" className={`inline-block px-8 py-3 ${ui.btnPrimary}`}>
            ログイン画面へ
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {measurementsLoaded && <BodyStats measurements={measurements} />}

      <main>
        <section className={ui.card}>
          <h2 className="mb-4 text-xl font-semibold text-gray-100">トレーニングを記録</h2>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              to="/record/select"
              className="flex-1 rounded-lg bg-gradient-to-r from-purple-700 to-indigo-700 py-3 text-center font-medium text-white hover:from-purple-600 hover:to-indigo-600"
            >
              今すぐ記録
            </Link>
            <Link
              to="/menu"
              className="flex-1 rounded-lg border border-white/30 py-3 text-center text-gray-100 hover:bg-white/10"
            >
              メニューを作成
            </Link>
          </div>

          <div className="mt-6 text-gray-300">
            <h3 className="mb-2 font-semibold text-gray-100">直近の記録</h3>
            {records.length === 0 ? <div className="rounded-lg bg-black/20 p-4">まだ記録がありません。最初の記録を追加しましょう。</div> : (
              <ul className="space-y-2">
                {records.slice(0, 3).map((record) => <li key={record.id} className="rounded-lg bg-black/20 p-3">
                  <Link to={`/history/${record.id}`} className={ui.link}>{record.date}</Link>
                  <div className="mt-1 text-sm">{record.sets.map((set) => set.exerciseName || set.exerciseId).filter((name, index, names) => name && names.indexOf(name) === index).join('、')}</div>
                </li>)}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}