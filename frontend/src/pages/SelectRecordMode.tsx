import React from "react"
import { useNavigate } from "react-router-dom"
import { ui } from "../styles/ui"

export default function SelectRecordMode(): JSX.Element {
  const navigate = useNavigate()
  return (
    <div className="container mx-auto px-4 py-10">
      <div className={ui.card}>
        <h2 className="text-xl font-semibold mb-4">記録方法を選択</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => navigate('/record?mode=create')} className="flex-1 bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-800 hover:to-emerald-800 text-white py-4 rounded-lg font-medium">一から種目を作成して記録</button>
          <button onClick={() => navigate('/record/select-menu')} className="flex-1 border border-white/30 text-gray-100 py-4 rounded-lg text-center hover:bg-white/10">保存済メニューから選んで記録</button>
        </div>
        <div className="mt-4 text-sm text-gray-300">記録画面での作業を分離して、見やすくします。</div>
      </div>
    </div>
  )
}
