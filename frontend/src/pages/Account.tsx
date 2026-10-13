import React, { useEffect, useState } from "react"
import { useNavigate } from 'react-router-dom'
import { getAccountBodyWeight, saveAccountBodyWeight } from '../api/accountProfile'

type User = { username: string; password?: string }

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem('trainingapp:users')
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveUsers(users: User[]) { localStorage.setItem('trainingapp:users', JSON.stringify(users)) }

function setAuthUser(user: { username: string } | null) {
  if (user) localStorage.setItem('trainingapp:authUser', JSON.stringify(user))
  else localStorage.removeItem('trainingapp:authUser')
}

function loadCurrentUser(): { username: string } | null {
  try {
    const raw = localStorage.getItem('trainingapp:authUser')
    if (!raw) return null
    const user = JSON.parse(raw) as { username?: unknown }
    return typeof user.username === 'string' && user.username ? { username: user.username } : null
  } catch {
    return null
  }
}

export default function Account(): JSX.Element {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [current, setCurrent] = useState<{ username: string } | null>(loadCurrentUser)
  const [bodyWeight, setBodyWeight] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const savedWeight = current ? getAccountBodyWeight(current.username) : null
    setBodyWeight(savedWeight === null ? '' : String(savedWeight))
    setError('')
    setMessage('')
  }, [current?.username])

  function register() {
    const accountName = username.trim()
    if (!accountName) return alert('ユーザ名を入力してください')
    const users = loadUsers()
    users.push({ username: accountName, password })
    saveUsers(users)
    alert('登録しました')
    setAuthUser({ username: accountName })
    setCurrent({ username: accountName })
    navigate('/')
  }

  function login() {
    const accountName = username.trim()
    if (!accountName) return alert('ユーザ名を入力してください')
    setAuthUser({ username: accountName })
    setCurrent({ username: accountName })
    alert('ログインしました')
    navigate('/')
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(bodyWeight)
    if (!current || bodyWeight === '' || !Number.isFinite(value) || value < 20 || value > 300) {
      setError('体重は20〜300kgの範囲で入力してください')
      setMessage('')
      return
    }

    saveAccountBodyWeight(value, current.username)
    setError('')
    setMessage('体重を保存しました')
  }

  function logout() {
    setAuthUser(null)
    setCurrent(null)
    navigate('/')
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">アカウント</h2>
      <div className="p-6 bg-white/5 rounded-lg max-w-md">
        {!current && (
          <>
            <div className="mb-3"><label className="block text-sm">ユーザ名</label>
              <input value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>
            <div className="mb-3"><label className="block text-sm">パスワード</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>
            <div className="flex gap-2">
              <button type="button" onClick={register} className="px-3 py-2 rounded bg-green-600">登録</button>
              <button type="button" onClick={login} className="px-3 py-2 rounded bg-blue-600">ログイン</button>
            </div>
          </>
        )}

        {current && (
          <>
            <div className="mb-3">ログイン中: <strong>{current.username}</strong></div>
            <form onSubmit={saveProfile} className="mt-4 max-w-xl space-y-4 rounded-lg bg-white p-6 text-gray-900 shadow-sm">
              <h3 className="text-lg font-semibold">プロフィール</h3>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">体重（kg）</span>
                <input
                  type="number"
                  min={20}
                  max={300}
                  step={0.1}
                  value={bodyWeight}
                  onChange={(event) => setBodyWeight(event.target.value)}
                  required
                  className="w-40 rounded border px-3 py-2"
                />
              </label>
              <p className="text-sm text-gray-600">トレーニングの消費カロリー推定に使用します。</p>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              {message && <p role="status" className="text-sm text-green-700">{message}</p>}
              <button type="submit" className="rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700">
                保存
              </button>
            </form>
            <div className="mt-4">
              <button type="button" onClick={logout} className="px-3 py-2 rounded bg-red-600">ログアウト</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
