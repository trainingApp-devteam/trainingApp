import React, { useEffect, useState } from "react"
import { useNavigate } from 'react-router-dom'
import { acceptInvitation, Account as AccountInfo, getCurrentAccount, login, logout, updateBodyWeight } from '../api/auth'
import { getAccountBodyWeight, syncAccountProfile } from '../api/accountProfile'

export default function Account(): JSX.Element {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'invitation'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [invitationToken, setInvitationToken] = useState('')
  const [current, setCurrent] = useState<AccountInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [bodyWeight, setBodyWeight] = useState('')

  useEffect(() => {
    getCurrentAccount().then(setCurrent).catch(() => setCurrent(null))
  }, [])

  useEffect(() => {
    if (current) syncAccountProfile(current)
    else localStorage.removeItem('trainingapp:authUser')
    const savedWeight = current ? getAccountBodyWeight(current.username) : null
    setBodyWeight(savedWeight === null ? '' : String(savedWeight))
  }, [current?.username])

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
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(bodyWeight)
    if (!current || bodyWeight === '' || !Number.isFinite(value) || value < 20 || value > 300) {
      setError('体重は20〜300kgの範囲で入力してください')
      setMessage(null)
      return
    }

    try {
      const updated = await updateBodyWeight(value)
      syncAccountProfile(updated)
      setCurrent(updated)
      setError(null)
      setMessage('体重を保存しました')
    } catch (e) {
      setError(e instanceof Error ? e.message : '体重を保存できませんでした')
      setMessage(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">アカウント</h2>
      <div className="p-6 bg-white/5 rounded-lg max-w-md">
        {error && <div role="alert" className="mb-3 text-red-400">{error}</div>}
        {message && <div role="status" className="mb-3 text-green-400">{message}</div>}
        {!current && (
          <>
            <div className="mb-4 flex gap-2" role="tablist" aria-label="アカウント操作">
              <button role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')} className="px-3 py-2 rounded bg-blue-700">ログイン</button>
              <button role="tab" aria-selected={mode === 'invitation'} onClick={() => setMode('invitation')} className="px-3 py-2 rounded bg-gray-700">招待で登録</button>
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
            <div className="mb-3">ログイン中: <strong>{current.displayName || current.username}</strong>（{current.role}）</div>
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
              <button type="submit" className="rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700">
                保存
              </button>
            </form>
            <div className="mt-4 flex gap-2">
              <button disabled={busy} onClick={signOut} className="px-3 py-2 rounded bg-red-700 disabled:opacity-50">ログアウト</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
