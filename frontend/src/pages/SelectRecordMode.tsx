import React from "react"
import { Link, useNavigate } from "react-router-dom"

export default function SelectRecordMode(): JSX.Element {
  const navigate = useNavigate()
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="bg-white/5 p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-semibold mb-4">記録方法を選択</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => navigate('/record?mode=create')} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-lg font-medium">一から種目を作成して記録</button>
          <button onClick={() => navigate('/record/select-menu')} className="flex-1 border border-gray-600 text-gray-100 py-4 rounded-lg text-center">保存済メニューから選んで記録</button>
        </div>
        <div className="mt-4 text-sm text-gray-300">記録画面での作業を分離して、見やすくします。</div>
      </div>
    </div>
  )
}
