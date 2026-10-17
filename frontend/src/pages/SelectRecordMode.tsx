import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ui } from "../styles/ui"

// batch: 全種目のセットを組んでからまとめて実行 / step: 1種目ずつ設定して実行
type Flow = 'batch' | 'step'

export default function SelectRecordMode(): JSX.Element {
  const navigate = useNavigate()
  const [flow, setFlow] = useState<Flow>('batch')
  const flowQuery = flow === 'step' ? 'flow=step' : ''

  return (
    <div className="container mx-auto px-4 py-10">
      <div className={ui.card}>
        <h2 className="text-xl font-semibold mb-4">記録方法を選択</h2>

        <section aria-labelledby="record-flow-heading" className={`mb-4 ${ui.panel}`}>
          <h3 id="record-flow-heading" className={ui.cardTitle}>進め方</h3>
          <div role="radiogroup" aria-labelledby="record-flow-heading" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2 text-gray-100">
              <input type="radio" name="flow" checked={flow === 'batch'} onChange={() => setFlow('batch')} />
              全種目のセットを組んでまとめて実行
            </label>
            <label className="flex items-center gap-2 text-gray-100">
              <input type="radio" name="flow" checked={flow === 'step'} onChange={() => setFlow('step')} />
              1種目ずつ設定して実行
            </label>
          </div>
          <p className={`mt-2 ${ui.muted}`}>
            {flow === 'batch'
              ? 'すべての種目のセットを追加してから実行を開始し、最後のセットで記録します。'
              : '1つの種目のセットを実行し、終わったら次の種目へ進みます。すべて終えたら「完了して記録」で保存します。'}
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => navigate(`/record?mode=create${flowQuery ? `&${flowQuery}` : ''}`)} className="flex-1 bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-800 hover:to-emerald-800 text-white py-4 rounded-lg font-medium">一から種目を作成して記録</button>
          <button onClick={() => navigate(`/record/select-menu${flowQuery ? `?${flowQuery}` : ''}`)} className="flex-1 border border-white/30 text-gray-100 py-4 rounded-lg text-center hover:bg-white/10">保存済メニューから選んで記録</button>
        </div>
      </div>
    </div>
  )
}
