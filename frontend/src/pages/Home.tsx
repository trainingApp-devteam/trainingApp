import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRecords, RecordItem } from '../api/records'
import { BodyMeasurement, listBodyMeasurements } from '../api/bodyMeasurements'
import { useAuth } from '../auth/AuthContext'

export default function Home(): JSX.Element {
  const { status } = useAuth()
  const [records, setRecords] = useState<RecordItem[]>([])
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])

  useEffect(() => {
    if (status !== 'authenticated') {
      setRecords([])
      setMeasurements([])
      return
    }
    listRecords().then(setRecords).catch(() => setRecords([]))
    listBodyMeasurements().then(setMeasurements).catch(() => setMeasurements([]))
  }, [status])

  if (status === 'loading') return <div className="container mx-auto px-4 py-10 text-gray-300">読み込み中...</div>

  if (status === 'anonymous') {
    return (
      <div className="container mx-auto px-4 py-8">
        <section className="mx-auto max-w-xl rounded-2xl bg-white/5 p-8 text-center shadow-lg">
          <h2 className="mb-3 text-xl font-semibold">ログインしてください</h2>
          <p className="mb-6 text-gray-300">トレーニングの記録やメニューの作成には、ログインが必要です。</p>
          <Link to="/account" className="inline-block rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-3 font-medium text-white hover:from-purple-500 hover:to-indigo-500">
            ログイン画面へ
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 bg-white/5 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">トレーニングを記録</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/record/select"
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 rounded-lg font-medium text-center"
            >
              今すぐ記録
            </Link>
            <Link
              to="/menu"
              className="flex-1 border border-gray-600 text-gray-100 py-3 rounded-lg text-center"
            >
              メニューを作成
            </Link>
          </div>

          <div className="mt-6 text-gray-300">
            <h3 className="font-semibold mb-2">直近の記録</h3>
            {records.length === 0 ? <div className="p-4 bg-white/3 rounded-lg">まだ記録がありません。最初の記録を追加しましょう。</div> : (
              <ul className="space-y-2">
                {records.slice(0, 3).map((record) => <li key={record.id} className="rounded bg-white/3 p-3">
                  <Link to={`/history/${record.id}`} className="underline">{record.date}</Link>
                  <div className="mt-1 text-sm">{record.sets.map((set) => set.exerciseName || set.exerciseId).filter((name, index, names) => name && names.indexOf(name) === index).join('、')}</div>
                </li>)}
              </ul>
            )}
          </div>
        </section>

        <aside className="bg-white/5 p-6 rounded-2xl shadow-inner">
          <div className="text-sm text-gray-400">
            <div className="font-medium text-gray-200 mb-1">身体測定</div>
            <div>体重: {measurements.find((item) => item.type === 'weight_kg')?.value ?? '—'} kg</div>
            <div>身長: {measurements.find((item) => item.type === 'height_cm')?.value ?? '—'} cm</div>
          </div>
        </aside>
      </main>
    </div>
  );
}