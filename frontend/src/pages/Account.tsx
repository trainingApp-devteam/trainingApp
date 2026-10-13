import React, { useEffect, useState } from "react"
import { useNavigate } from 'react-router-dom'
<<<<<<< HEAD
import { acceptInvitation, Account as AccountInfo, getCurrentAccount, login, logout } from '../api/auth'
=======
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
>>>>>>> 3dd71bc16ad53b976676a283f5be393cace8c33a

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
  const [mode, setMode] = useState<'login' | 'invitation'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
<<<<<<< HEAD
  const [displayName, setDisplayName] = useState('')
  const [invitationToken, setInvitationToken] = useState('')
  const [current, setCurrent] = useState<AccountInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getCurrentAccount().then(setCurrent).catch(() => setCurrent(null))
  }, [])

  async function submitLogin() {
    setBusy(true); setError(null); setMessage(null)
    try {
      setCurrent(await login(username, password))
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインできませんでした')
    } finally { setBusy(false) }
  }

  async function submitInvitation() {
    setBusy(true); setError(null); setMessage(null)
    try {
      await acceptInvitation({ token: invitationToken, username, displayName, password })
      setMessage('申請を受け付けました。管理者の承認後にログインできます。')
      setPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録できませんでした')
    } finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true); setError(null)
    try {
      await logout()
      setCurrent(null)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログアウトできませんでした')
    } finally { setBusy(false) }
=======
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
>>>>>>> 3dd71bc16ad53b976676a283f5be393cace8c33a
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">アカウント</h2>
      <div className="p-6 bg-white/5 rounded-lg max-w-md">
        {error && <div role="alert" className="mb-3 text-red-400">{error}</div>}
        {message && <div role="status" className="mb-3 text-green-400">{message}</div>}
        {!current && (
          <>
<<<<<<< HEAD
            <div className="mb-4 flex gap-2" role="tablist" aria-label="アカウント操作">
              <button role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')} className="px-3 py-2 rounded bg-blue-700">ログイン</button>
              <button role="tab" aria-selected={mode === 'invitation'} onClick={() => setMode('invitation')} className="px-3 py-2 rounded bg-gray-700">招待で登録</button>
=======
            <div className="mb-3"><label className="block text-sm">ユーザ名</label>
              <input value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>
            <div className="mb-3"><label className="block text-sm">パスワード</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>
            <div className="flex gap-2">
              <button type="button" onClick={register} className="px-3 py-2 rounded bg-green-600">登録</button>
              <button type="button" onClick={login} className="px-3 py-2 rounded bg-blue-600">ログイン</button>
>>>>>>> 3dd71bc16ad53b976676a283f5be393cace8c33a
            </div>
            {mode === 'invitation' && <>
              <div className="mb-3"><label className="block text-sm">招待コード</label>
                <input value={invitationToken} onChange={e => setInvitationToken(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>
              <div className="mb-3"><label className="block text-sm">表示名</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>
            </>}
            <div className="mb-3"><label className="block text-sm">ユーザー名</label>
              <input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>
            <div className="mb-3"><label className="block text-sm">パスワード</label>
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800/60" /></div>
            <button disabled={busy} onClick={mode === 'login' ? submitLogin : submitInvitation} className="px-3 py-2 rounded bg-green-700 disabled:opacity-50">
              {busy ? '処理中...' : mode === 'login' ? 'ログイン' : '登録申請'}
            </button>
          </>
        )}

        {current && (
          <>
<<<<<<< HEAD
            <div className="mb-3">ログイン中: <strong>{current.displayName || current.username}</strong>（{current.role}）</div>
            <div className="flex gap-2">
              <button disabled={busy} onClick={signOut} className="px-3 py-2 rounded bg-red-700 disabled:opacity-50">ログアウト</button>
=======
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
>>>>>>> 3dd71bc16ad53b976676a283f5be393cace8c33a
            </div>
          </>
        )}
      </div>
    </div>
  )
}
