import React, { useEffect, useState } from "react"
import { useLocation, useNavigate } from 'react-router-dom'
import { acceptInvitation, Account as AccountInfo, changePassword, getCurrentAccount, login, updateAccount } from '../api/auth'
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
          <div className="text-gray-100">
            ログイン中: <strong>{current.displayName || current.username}</strong>（{current.role}）
            <div className={`mt-1 ${ui.muted}`}>ユーザー名（ログインID）: {current.username}</div>
          </div>
        )}
      </div>
      {current && (
        <div className="mt-4 max-w-md space-y-4">
          <DisplayNameForm current={current} onChanged={setCurrent} />
          <PasswordForm />
        </div>
      )}
    </div>
  )
}

// アカウント名（ヘッダー等に表示する表示名）の変更
function DisplayNameForm({ current, onChanged }: { current: AccountInfo; onChanged: (account: AccountInfo) => void }): JSX.Element {
  const [displayName, setDisplayName] = useState(current.displayName)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    const name = displayName.trim()
    if (!name) return setError('アカウント名を入力してください')
    if (name.length > 100) return setError('アカウント名は100文字以内で入力してください')
    setBusy(true)
    try {
      onChanged(await updateAccount({ displayName: name }))
      setError(null)
      setMessage('アカウント名を変更しました')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アカウント名を変更できませんでした')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className={ui.card} aria-labelledby="account-name-heading">
      <h3 id="account-name-heading" className={ui.cardTitle}>アカウント名の変更</h3>
      <label htmlFor="account-new-display-name" className={ui.label}>アカウント名</label>
      <input id="account-new-display-name" maxLength={100} value={displayName} onChange={e => setDisplayName(e.target.value)} className={`mb-3 ${ui.input}`} />
      <p className={`mb-3 ${ui.muted}`}>ヘッダーなどに表示される名前です。ログインに使うユーザー名は変わりません。</p>
      <button type="submit" disabled={busy} className={ui.btnSuccess}>{busy ? '処理中...' : 'アカウント名を変更'}</button>
      {error && <div role="alert" className={`mt-3 ${ui.error}`}>{error}</div>}
      {message && <div role="status" className={`mt-3 ${ui.success}`}>{message}</div>}
    </form>
  )
}

function PasswordForm(): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (!currentPassword) return setError('現在のパスワードを入力してください')
    if (newPassword.length < 12 || newPassword.length > 128) return setError('新しいパスワードは12〜128文字で入力してください')
    if (newPassword !== confirmation) return setError('新しいパスワード（確認）が一致しません')
    if (newPassword === currentPassword) return setError('現在と異なるパスワードを入力してください')
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword(''); setNewPassword(''); setConfirmation('')
      setError(null)
      setMessage('パスワードを変更しました。次回から新しいパスワードでログインしてください')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'パスワードを変更できませんでした')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className={ui.card} aria-labelledby="account-password-heading">
      <h3 id="account-password-heading" className={ui.cardTitle}>パスワードの変更</h3>
      <div className="mb-3"><label htmlFor="account-current-password" className={ui.label}>現在のパスワード</label>
        <input id="account-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={ui.input} /></div>
      <div className="mb-3"><label htmlFor="account-new-password" className={ui.label}>新しいパスワード（12文字以上）</label>
        <input id="account-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={ui.input} /></div>
      <div className="mb-4"><label htmlFor="account-confirm-password" className={ui.label}>新しいパスワード（確認）</label>
        <input id="account-confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className={ui.input} /></div>
      <button type="submit" disabled={busy} className={ui.btnSuccess}>{busy ? '処理中...' : 'パスワードを変更'}</button>
      {error && <div role="alert" className={`mt-3 ${ui.error}`}>{error}</div>}
      {message && <div role="status" className={`mt-3 ${ui.success}`}>{message}</div>}
    </form>
  )
}