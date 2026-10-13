import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SelectMenu(): JSX.Element {
  const [savedMenus, setSavedMenus] = useState<Array<{id:string;name:string;exercises:any[]}>>([])
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('trainingapp:menus')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setSavedMenus(parsed)
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="bg-white/5 p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-semibold mb-4">保存済メニューを選択</h2>
        {savedMenus.length === 0 && (
          <div className="p-4 bg-white/3 rounded">保存されたメニューがありません。</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {savedMenus.map((m) => (
            <div key={m.id} className="p-4 bg-white/3 rounded flex items-center justify-between">
              <div>{m.name}</div>
                <div className="flex gap-2">
                <button onClick={() => navigate(`/record?menuId=${encodeURIComponent(m.id)}&autoStart=1`)} className="px-3 py-1 rounded bg-indigo-600 text-white">選択して記録へ</button>
                <button onClick={() => { navigator.clipboard?.writeText(m.id) }} className="px-2 py-1 rounded bg-gray-600 text-white">IDコピー</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
