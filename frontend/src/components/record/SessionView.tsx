import React, { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../../api/exercises'
import type { SetItem } from '../../api/records'
import { ui } from '../../styles/ui'
import { setAmount, setKcalText, setName } from './recordUtils'

type Props = {
  sets: SetItem[]
  exercises: Exercise[]
  currentIndex: number
  heading: string
  // 最後のセットでの次へボタンの文言（「この種目を完了」「完了して記録」など）
  finishLabel: string
  // 現在のセットの実際のきつさ（初期値は予定のRPE）。記録時はこの値で消費カロリーを計算し直す
  rpe: number
  onRpeChange: (rpe: number) => void
  remaining: number | null
  isTimerRunning: boolean
  onToggleTimer: () => void
  onNext: () => void
  onStop: () => void
  error: string | null
}

// メニュー実行中の表示（現在のセット、タイマー、全メニュー一覧）
export default function SessionView(props: Props): JSX.Element {
  const { sets, currentIndex, exercises } = props
  const current = sets[currentIndex]
  const [showAllSets, setShowAllSets] = useState(false)
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([])

  useEffect(() => {
    if (!showAllSets) return
    const el = rowRefs.current[currentIndex]
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex, showAllSets])

  return (
    <div className={`max-w-2xl ${ui.card}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-300">{props.heading}</div>
        <div className="px-3 py-1 bg-black/30 rounded font-semibold text-sm text-gray-100">{currentIndex + 1}/{sets.length}</div>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-gray-300 mb-1">種目</div>
          <div className="px-4 py-2 bg-black/30 ring-1 ring-white/10 rounded text-gray-100">{setName(current, exercises)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-300 mb-1">回数/時間</div>
          <div className="px-4 py-2 bg-black/30 ring-1 ring-white/10 rounded text-gray-100">{setAmount(current)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-300 mb-1">負荷</div>
          <div className="px-4 py-2 bg-black/30 ring-1 ring-white/10 rounded text-gray-100">{current.weight ? `${current.weight} kg` : '-'}</div>
        </div>
      </div>

      <label className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-200">このセットのきつさ（RPE）</span>
        <input type="range" min={1} max={10} step={1} aria-label="このセットのきつさ（RPE 1〜10）" value={props.rpe} onChange={(e) => props.onRpeChange(Number(e.target.value))} />
        <span className="w-5 text-sm text-gray-200">{props.rpe}</span>
        <span className="text-xs text-gray-300">終わったら、あと何回できそうだったかで選ぶ</span>
      </label>

      {props.error && <div role="alert" className={`mb-3 ${ui.error}`}>{props.error}</div>}

      {current.type === 'time' && (
        <div className="text-center mb-4">
          <div className="text-6xl font-mono">{props.remaining !== null ? `${props.remaining}s` : ''}</div>
        </div>
      )}

      <div className="flex gap-3 mb-6">
        {current.type === 'time' && (
          <button
            onClick={props.onToggleTimer}
            className="px-4 py-2 rounded bg-yellow-500 text-gray-900 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            aria-pressed={props.isTimerRunning}
            aria-label={props.isTimerRunning ? '一時停止' : '開始'}
          >
            {props.isTimerRunning ? '一時停止' : '開始'}
          </button>
        )}
        <button onClick={props.onNext} className="px-4 py-2 rounded bg-indigo-600 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">{currentIndex + 1 < sets.length ? '次のメニューへ' : props.finishLabel}</button>
        <button onClick={props.onStop} className="px-4 py-2 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">中止</button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">全メニュー一覧</div>
          <button
            type="button"
            onClick={() => setShowAllSets((s) => !s)}
            aria-expanded={showAllSets}
            className="text-sm text-indigo-300 hover:underline"
          >
            {showAllSets ? '折りたたむ' : `展開する (${sets.length} 件)`}
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
                {sets.map((s, i) => (
                  <tr
                    key={i}
                    ref={(el) => { rowRefs.current[i] = el }}
                    className={`border-b border-white/10 ${i === currentIndex ? 'bg-indigo-500/25 font-semibold ring-1 ring-indigo-300/50' : ''}`}
                  >
                    <td className="px-4 py-3 align-top">{i + 1}</td>
                    <td className="px-4 py-3 align-top text-gray-100">{setName(s, exercises)}</td>
                    <td className="px-4 py-3 align-top">{s.type === 'reps' ? '回数' : '時間'}</td>
                    <td className="px-4 py-3 align-top">{setAmount(s)}</td>
                    <td className="px-4 py-3 align-top">{s.weight !== undefined ? `${s.weight} kg` : '-'}</td>
                    <td className="px-4 py-3 align-top">{s.rpe ?? '-'}</td>
                    <td className="px-4 py-3 align-top">{setKcalText(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-300">全 {sets.length} 件 — 展開して詳細を表示</div>
        )}
      </div>
    </div>
  )
}
