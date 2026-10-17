import React, { useEffect, useState } from "react"
import { BodyMeasurement, createBodyMeasurement, deleteBodyMeasurement, listBodyMeasurements, listMeasurementHistory, MeasurementType } from '../api/bodyMeasurements'
import LineChart from '../components/LineChart'
import PeriodSelect, { Period, periodStart } from '../components/PeriodSelect'
import { updateAccount } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { formatDateTime, localDateTimeInputValue } from '../utils/date'
import { ui } from '../styles/ui'

type Measurement = { id: string; ids: string[]; measuredAt: string; weight?: number; bodyFat?: number }

// 身長は基本的に変わらないため、測定履歴ではなくアカウントに一度だけ登録する（入力誤りは修正できる）
function HeightCard(): JSX.Element {
  const { account } = useAuth()
  const registered = account?.heightCm ?? null
  const [editing, setEditing] = useState(false)
  const [height, setHeight] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const showForm = registered === null || editing

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (height === '' || height < 50 || height > 300) return setError('身長は50〜300の範囲で入力してください')
    if (Math.abs(Math.round(height * 10) - height * 10) > 1e-9) return setError('身長は小数第1位までで入力してください')
    setSaving(true)
    try {
      await updateAccount({ heightCm: Number(height) })
      setError(null)
      setEditing(false)
      setHeight('')
      setMessage(registered === null ? '身長を登録しました' : '身長を修正しました')
    } catch (e) {
      setError(e instanceof Error ? e.message : '身長を保存できませんでした')
    } finally { setSaving(false) }
  }

  return (
    <section className={ui.card} aria-labelledby="body-height-heading">
      <h3 id="body-height-heading" className={ui.cardTitle}>身長</h3>
      {!showForm && (
        <div className="flex items-center justify-between">
          <div className="text-gray-100"><span className="text-2xl font-semibold">{registered}</span> cm</div>
          <button type="button" onClick={() => { setEditing(true); setHeight(registered ?? ''); setMessage(null) }} className={`${ui.btnSecondary} ${ui.btnSmall}`}>修正</button>
        </div>
      )}
      {showForm && (
        <form onSubmit={save}>
          <p className={`mb-3 ${ui.muted}`}>身長は基本的に変わらないため、一度だけ登録します（入力を誤った場合は修正できます）。</p>
          <label htmlFor="body-height" className={ui.label}>身長(cm)</label>
          <input id="body-height" type="number" step="0.1" value={height as any} onChange={e => setHeight(e.target.value ? Number(e.target.value) : '')} className={`mb-3 ${ui.input}`} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={ui.btnSuccess}>{registered === null ? '登録' : '保存'}</button>
            {editing && <button type="button" onClick={() => { setEditing(false); setError(null) }} className={ui.btnSecondary}>キャンセル</button>}
          </div>
        </form>
      )}
      {error && <div role="alert" className={`mt-3 ${ui.error}`}>{error}</div>}
      {message && <div role="status" className={`mt-3 ${ui.success}`}>{message}</div>}
    </section>
  )
}

// 同じ測定日時で保存した体重・体脂肪を1行にまとめる
function groupMeasurements(values: BodyMeasurement[]): Measurement[] {
  const groups = new Map<string, Measurement>()
  values.forEach((item) => {
    const group = groups.get(item.measuredAt) || { id: item.measuredAt, ids: [], measuredAt: item.measuredAt }
    group.ids.push(item.id)
    if (item.type === 'weight_kg' && group.weight === undefined) group.weight = item.value
    if (item.type === 'body_fat_pct' && group.bodyFat === undefined) group.bodyFat = item.value
    groups.set(item.measuredAt, group)
  })
  return [...groups.values()].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))
}

// 体重・体脂肪率の推移。単位が違うため1つのグラフに重ねず、同じ期間で2つのグラフに分ける
function BodyTrends({ refreshKey }: { refreshKey: string }): JSX.Element {
  const [period, setPeriod] = useState<Period>('3m')
  const [weights, setWeights] = useState<BodyMeasurement[]>([])
  const [bodyFats, setBodyFats] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const from = periodStart(period)
    setLoading(true)
    Promise.all([listMeasurementHistory('weight_kg', from), listMeasurementHistory('body_fat_pct', from)])
      .then(([weight, bodyFat]) => {
        if (cancelled) return
        setWeights(weight)
        setBodyFats(bodyFat)
        setError(null)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '推移を取得できませんでした') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [period, refreshKey])

  const toPoints = (values: BodyMeasurement[]) => values.map((item) => ({ x: item.measuredAt, y: Number(item.value) }))

  return (
    <section className={ui.card} aria-labelledby="body-trend-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="body-trend-heading" className="text-lg font-semibold text-gray-100">推移</h3>
        <PeriodSelect value={period} onChange={setPeriod} label="推移の期間" />
      </div>
      {error && <div role="alert" className={`mb-3 ${ui.error}`}>{error}</div>}
      {loading ? <div className="text-gray-300">読み込み中...</div> : (
        <div className="space-y-6">
          <LineChart title="体重" unit="kg" points={toPoints(weights)} formatX={formatDateTime} />
          <LineChart title="体脂肪率" unit="%" points={toPoints(bodyFats)} formatX={formatDateTime} />
        </div>
      )}
    </section>
  )
}

export default function Body(): JSX.Element {
  const [measuredAt, setMeasuredAt] = useState(() => localDateTimeInputValue())
  const [weight, setWeight] = useState<number|''>('')
  const [bodyFat, setBodyFat] = useState<number|''>('')
  const [items, setItems] = useState<Measurement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try { setItems(groupMeasurements(await listBodyMeasurements())); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : '測定データを取得できませんでした') }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  function validate(): string|null {
    if (!measuredAt || Number.isNaN(new Date(measuredAt).getTime())) return '測定日時を入力してください'
    if (weight !== '' && (weight < 20 || weight > 300)) return '体重は20〜300の範囲で入力してください'
    if (bodyFat !== '' && (bodyFat < 0 || bodyFat > 100)) return '体脂肪率は0〜100の範囲で入力してください'
    return null
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    const err = validate()
    if (err) return setError(err)
    const values: Array<[MeasurementType, number]> = []
    if (weight !== '') values.push(['weight_kg', Number(weight)])
    if (bodyFat !== '') values.push(['body_fat_pct', Number(bodyFat)])
    if (!values.length) return setError('測定値を1つ以上入力してください')
    setError(null)
    try {
      const instant = new Date(measuredAt).toISOString()
      for (const [type, value] of values) await createBodyMeasurement(instant, type, value)
      setWeight(''); setBodyFat('')
      await refresh()
      setMessage('保存しました')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
      await refresh()
    }
  }

  async function remove(item: Measurement) {
    if (!confirm('この測定日時の測定値をすべて削除しますか？')) return
    try {
      await Promise.all(item.ids.map((id) => deleteBodyMeasurement(id)))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除できませんでした')
      await refresh()
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">身体測定</h2>
      <div className="max-w-md space-y-4">
        <HeightCard />

        <form onSubmit={add} className={ui.card} aria-labelledby="body-form-heading">
          <h3 id="body-form-heading" className={ui.cardTitle}>体重・体脂肪率を登録</h3>
          <div className="mb-3">
            <label htmlFor="body-measured-at" className={ui.label}>測定日時</label>
            <input id="body-measured-at" type="datetime-local" value={measuredAt} onChange={e => setMeasuredAt(e.target.value)} className={ui.input} />
          </div>
          <div className="mb-3">
            <label htmlFor="body-weight" className={ui.label}>体重(kg)</label>
            <input id="body-weight" type="number" step="0.1" value={weight as any} onChange={e => setWeight(e.target.value ? Number(e.target.value) : '')} className={ui.input} />
          </div>
          <div className="mb-4">
            <label htmlFor="body-fat" className={ui.label}>体脂肪率(%)</label>
            <input id="body-fat" type="number" step="0.1" value={bodyFat as any} onChange={e => setBodyFat(e.target.value ? Number(e.target.value) : '')} className={ui.input} />
          </div>
          <p className={`mb-4 ${ui.muted}`}>カロリー推定には、最新の体重を使用します。</p>
          <button type="submit" className={ui.btnSuccess}>保存</button>
          {error && <div role="alert" className={`mt-3 ${ui.error}`}>{error}</div>}
          {message && <div role="status" className={`mt-3 ${ui.success}`}>{message}</div>}
        </form>

      </div>
      <div className="mt-4 max-w-3xl">
        <BodyTrends refreshKey={items.map((item) => item.ids.join('.')).join(',')} />
      </div>
      <div className="mt-4 max-w-md">
        <section className={ui.card} aria-labelledby="body-history-heading">
          <h3 id="body-history-heading" className={ui.cardTitle}>履歴</h3>
          {loading && <div className="text-gray-300">読み込み中...</div>}
          {!loading && items.length === 0 && <div className="text-gray-300">データがありません</div>}
          <ul className="space-y-2">
            {items.map(i => (
              <li key={i.id} className="flex items-center justify-between rounded-md bg-black/20 p-3 ring-1 ring-white/10">
                <div>
                  <div className="font-medium text-gray-100">{formatDateTime(i.measuredAt)}</div>
                  <div className="text-sm text-gray-300">体重 {i.weight !== undefined ? `${i.weight} kg` : '-'} / 体脂肪率 {i.bodyFat !== undefined ? `${i.bodyFat}%` : '-'}</div>
                </div>
                <button type="button" onClick={() => remove(i)} className={`${ui.btnDanger} ${ui.btnSmall}`}>削除</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
