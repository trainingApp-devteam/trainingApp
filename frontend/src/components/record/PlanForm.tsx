import React from 'react'
import type { Exercise } from '../../api/exercises'
import { ui } from '../../styles/ui'

type Props = {
  groups: Array<{ id: string; name: string }>
  group: string
  onGroupChange: (group: string) => void
  exercises: Exercise[]
  exerciseId: string
  onExerciseChange: (id: string) => void
  setType: 'reps' | 'time'
  reps: number
  onRepsChange: (reps: number) => void
  timeSeconds: number
  onTimeSecondsChange: (seconds: number) => void
  weight: number | ''
  onWeightChange: (weight: number | '') => void
  rpe: number
  onRpeChange: (rpe: number) => void
  canAdd: boolean
  onAdd: () => void
  playlistUrl: string
  onPlaylistUrlChange: (url: string) => void
  // 1種目ずつ実行で完了した種目の表示（「1. 種目名（Nセット）」）。なければ表示しない
  completedSummary: string[]
  planCount: number
  planSummary: string
  // 予定の消費カロリーの合計（空なら表示しない）
  plannedKcal: string
  onShowPlan: () => void
  startLabel: string
  onStart: () => void
  // 1種目ずつ実行で完了した種目があるときの「完了して記録」
  onFinish?: () => void
  finishOnlyCompletedNote: boolean
  loading: boolean
  notice: string | null
  error: string | null
}

// 記録画面のメニュー作成フォーム。縦に長くならないよう1枚のフォームにまとめる
export default function PlanForm(props: Props): JSX.Element {
  const { setType } = props
  return (
    <form
      aria-label="メニュー作成"
      className={`max-w-2xl space-y-3 ${ui.card}`}
      onSubmit={(e) => { e.preventDefault(); if (props.canAdd) props.onAdd() }}
    >
      {props.completedSummary.length > 0 && (
        <section aria-label="完了した種目" className={ui.muted}>
          完了: {props.completedSummary.join(' / ')}
        </section>
      )}

      <div className="flex gap-2">
        {props.groups.length > 0 && (
          <select aria-label="部位" value={props.group} onChange={(e) => props.onGroupChange(e.target.value)} className={`w-32 ${ui.field}`}>
            {props.groups.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
          </select>
        )}
        <select aria-label="種目" value={props.exerciseId} onChange={(e) => props.onExerciseChange(e.target.value)} className={`min-w-0 flex-1 ${ui.field}`}>
          {props.exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {setType === 'reps' ? (
          <input type="number" min={1} aria-label="回数" value={props.reps} onChange={(e) => props.onRepsChange(Number(e.target.value))} className={`w-20 ${ui.field}`} />
        ) : (
          <input type="number" min={1} aria-label="秒数" value={props.timeSeconds} onChange={(e) => props.onTimeSecondsChange(Number(e.target.value))} className={`w-20 ${ui.field}`} />
        )}
        {/* 記録形式は種目ごとに決まっている（有酸素マシンは時間、それ以外は回数） */}
        <span className="text-sm text-gray-200">{setType === 'reps' ? '回' : '秒'}</span>
        <input type="number" min={0} placeholder="負荷" aria-label="負荷（kg・任意）" value={props.weight as any} onChange={(e) => props.onWeightChange(e.target.value === '' ? '' : Number(e.target.value))} className={`ml-2 w-20 ${ui.field}`} />
        <span className="text-sm text-gray-200">kg</span>
      </div>

      {/* 説明は行の幅に収め、スマートフォン幅でも横にはみ出さないようにする */}
      <div className="relative flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-200">予定RPE</span>
          <input type="range" min={1} max={10} step={1} aria-label="予定のきつさ（RPE 1〜10）" value={props.rpe} onChange={(e) => props.onRpeChange(Number(e.target.value))} />
          <span className="w-5 text-sm text-gray-200">{props.rpe}</span>
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
            消費カロリーの見積もりに使う、予定のきつさです。実際のきつさは実行中に各セットで入力し、記録時はその値で計算し直します。あと何回、フォームを保ってできそうかで決めます。RPE 10は余力なし、9はあと1回、8はあと2回、7はあと3回、6はあと4回以上が目安です。フォームが崩れる回数は数えません。
          </span>
        </span>
        <button type="submit" disabled={!props.canAdd} className={`ml-auto ${ui.btnSuccess} ${ui.btnSmall}`}>セットを追加</button>
      </div>

      <label className="block border-t border-white/10 pt-3">
        <span className={ui.label}>実行時に流すプレイリスト（YouTubeのURL・任意）</span>
        <input
          // type="url"だとIDだけの入力でフォーム送信（セットを追加）が止まるため、テキストで受けて実行開始時に検証する
          type="text"
          inputMode="url"
          value={props.playlistUrl}
          onChange={(e) => props.onPlaylistUrlChange(e.target.value)}
          placeholder="https://www.youtube.com/playlist?list=…"
          className={ui.input}
        />
      </label>

      {props.notice && <div role="status" className={ui.success}>{props.notice}</div>}
      {props.error && <div role="alert" className={ui.error}>{props.error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={props.onShowPlan} className={ui.btnSecondary}>作成中のセット（{props.planCount}）</button>
        <button type="button" onClick={props.onStart} className={ui.btnPrimary}>{props.startLabel}</button>
        {props.onFinish && (
          <button type="button" onClick={props.onFinish} disabled={props.loading} className={ui.btnPrimary}>{props.loading ? '保存中...' : '完了して記録'}</button>
        )}
      </div>
      {props.planSummary && <p className={ui.muted}>{props.planSummary}</p>}
      {props.plannedKcal && <p className={ui.muted}>{props.plannedKcal}</p>}
      {props.finishOnlyCompletedNote && (
        <p className={ui.muted}>「完了して記録」では、実行を終えた種目だけを保存します。</p>
      )}
    </form>
  )
}
