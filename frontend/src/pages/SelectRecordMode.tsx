import React from "react"
import { useNavigate } from "react-router-dom"
import { ui } from "../styles/ui"

export default function SelectRecordMode(): JSX.Element {
  const navigate = useNavigate()
  // アプリ共通の配色（ui.ts）に合わせる。進め方の2つは主ボタン、保存済みメニューは副ボタン
  const primary = `${ui.btnPrimary} py-3`

  return (
    <div className="container mx-auto px-4 py-10">
      <div className={`max-w-xl ${ui.card}`}>
        <h2 className="text-xl font-semibold mb-4">記録方法を選択</h2>

        <div className="flex flex-col gap-3">
          <button onClick={() => navigate('/record?mode=create')} className={primary}>まとめて実行</button>
          <button onClick={() => navigate('/record?mode=create&flow=step')} className={primary}>1種目ずつ実行</button>
          <button onClick={() => navigate('/record/select-menu')} className={`${ui.btnSecondary} py-3`}>保存済みメニューから</button>
        </div>
      </div>
    </div>
  )
}
