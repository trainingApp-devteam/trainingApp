import React, { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { acceptInvitation, Account as AccountInfo, getCurrentAccount, login } from '../api/auth'
import { onAuthChanged } from '../api/authEvents'
import { ui } from '../styles/ui'

export default function Account(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: string } | null)?.from
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [invitationToken, setInvitationToken] = useState('')
  const [current, setCurrent] = useState<AccountInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const refresh = () => getCurrentAccount().then(setCurrent).catch(() => setCurrent(null))
    refresh()
    return onAuthChanged(refresh)
  }, [])

  async function submitLogin() {
    setBusy(true); setError(null); setMessage(null)
    try {
      setCurrent(await login(username, password))
      navigate(returnTo || '/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインできませんでした')
    } finally { setBusy(false) }
  }

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setError(null)
    setMessage(null)
  }

  async function submitRegistration() {
    setBusy(true); setError(null); setMessage(null)
    try {
      await acceptInvitation({ token: invitationToken, username, displayName, password })
      setMessage('申請を受け付けました。管理者の承認後にログインできます。')
      setPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録できませんでした')
    } finally { setBusy(false) }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">アカウント</h2>
      <div className={`max-w-md ${ui.card}`}>
        {error && <div role="alert" className={`mb-3 ${ui.error}`}>{error}</div>}
        {message && <div role="status" className={`mb-3 ${ui.success}`}>{message}</div>}
        {!current && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (mode === 'login') submitLogin()
              else submitRegistration()
            }}
          >
            <h3 className={ui.cardTitle}>{mode === 'login' ? 'ログイン' : '新規登録'}</h3>
            {mode === 'login' && returnTo && !message && <p className={`mb-3 ${ui.muted}`}>この画面を利用するにはログインが必要です。</p>}
            {mode === 'register' && <>
              <div className="mb-3"><label htmlFor="account-invitation" className={ui.label}>招待コード</label>
                <input id="account-invitation" value={invitationToken} onChange={e => setInvitationToken(e.target.value)} className={ui.input} /></div>
              <div className="mb-3"><label htmlFor="account-display-name" className={ui.label}>表示名</label>
                <input id="account-display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} className={ui.input} /></div>
            </>}
            <div className="mb-3"><label htmlFor="account-username" className={ui.label}>ユーザー名</label>
              <input id="account-username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className={ui.input} /></div>
            <div className="mb-4"><label htmlFor="account-password" className={ui.label}>パスワード</label>
              <input id="account-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className={ui.input} /></div>
            <button type="submit" disabled={busy} className={`w-full ${ui.btnSuccess}`}>
              {busy ? '処理中...' : mode === 'login' ? 'ログイン' : '登録申請'}
            </button>
            <p className={`mt-4 ${ui.muted}`}>
              {mode === 'login' ? (
                <>アカウントをお持ちでない方は <button type="button" onClick={() => switchMode('register')} className={ui.link}>新規登録</button></>
              ) : (
                <>登録済みの方は <button type="button" onClick={() => switchMode('login')} className={ui.link}>ログインへ戻る</button></>
              )}
            </p>
          </form>
        )}

        {current && (
          <>
            <div className="mb-3 text-gray-100">ログイン中: <strong>{current.displayName || current.username}</strong>（{current.role}）</div>
            <p className={ui.muted}>
              カロリー推定に使う体重は、<Link to="/body" className={ui.link}>身体測定</Link>で登録した最新の体重です。
            </p>
          </>
        )}
      </div>
    </div>
  )
}