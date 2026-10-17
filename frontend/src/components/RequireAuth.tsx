import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// 未ログインでは画面を表示せず、ログイン画面へ移動する(ログイン後は元の画面へ戻る)
export default function RequireAuth({ children }: { children: React.ReactNode }): JSX.Element {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <div className="container mx-auto px-4 py-10 text-gray-300">読み込み中...</div>
  if (status === 'anonymous') {
    return <Navigate to="/account" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <>{children}</>
}