import React from 'react'
import type { Exercise } from '../../api/exercises'
import type { SetItem } from '../../api/records'
import { ui } from '../../styles/ui'
import Modal from '../Modal'
import { setAmount, setKcalText, setName } from './recordUtils'

type Props = {
  open: boolean
  onClose: () => void
  sets: SetItem[]
  exercises: Exercise[]
  // 保存済みメニューを1種目ずつ実行するときの、まだ設定に出していない種目名
  upcoming: string[]
  onMove: (index: number, dir: -1 | 1) => void
  onRemove: (index: number) => void
  onClear: () => void
}

// 作成中のセットの一覧（並べ替え・削除）
export default function PlanSetsModal({ open, onClose, sets, exercises, upcoming, onMove, onRemove, onClear }: Props): JSX.Element {
  return (
    <Modal open={open} title="作成中のセット" onClose={onClose}>
      {sets.length === 0 && <div className="text-sm text-gray-300">まだセットがありません</div>}
      {sets.length > 0 && (
        <ol className="divide-y divide-white/10 rounded-lg ring-1 ring-white/10">
          {sets.map((s, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-gray-300">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-gray-100">{setName(s, exercises)}</div>
                <div className="text-xs text-gray-300">
                  {[
                    setAmount(s),
                    s.weight !== undefined ? `${s.weight} kg` : null,
                    `予定RPE ${s.rpe ?? '-'}`,
                    setKcalText(s),
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" aria-label={`セット${i + 1}を上へ`} onClick={() => onMove(i, -1)} className="px-2 py-1 bg-gray-700 text-gray-100 hover:bg-gray-600 rounded">↑</button>
                <button type="button" aria-label={`セット${i + 1}を下へ`} onClick={() => onMove(i, 1)} className="px-2 py-1 bg-gray-700 text-gray-100 hover:bg-gray-600 rounded">↓</button>
                <button type="button" aria-label={`セット${i + 1}を削除`} onClick={() => onRemove(i)} className="px-2 py-1 bg-red-700 text-white hover:bg-red-800 rounded">×</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {upcoming.length > 0 && (
        <p className={`mt-2 ${ui.muted}`}>このあとの種目: {upcoming.join(' → ')}</p>
      )}
      {sets.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={onClear} className={`${ui.btnDanger} ${ui.btnSmall}`}>すべて削除</button>
        </div>
      )}
    </Modal>
  )
}
