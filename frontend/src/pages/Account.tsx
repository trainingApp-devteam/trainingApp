import React, { useEffect, useState } from "react"
import { useNavigate } from 'react-router-dom'
import { acceptInvitation, Account as AccountInfo, getCurrentAccount, login, logout } from '../api/auth'

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
            <div className="flex gap-2">
              <button disabled={busy} onClick={signOut} className="px-3 py-2 rounded bg-red-700 disabled:opacity-50">ログアウト</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
