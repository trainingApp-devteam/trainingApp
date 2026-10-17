import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Account, getCurrentAccount } from '../api/auth'
import { onAuthChanged } from '../api/authEvents'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthValue = {
  status: AuthStatus
  account: Account | null
  // ログアウト成功後に、サーバーへ再問い合わせせず未ログイン状態へ切り替える
  clear: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [account, setAccount] = useState<Account | null>(null)

  const clear = useCallback(() => {
    setAccount(null)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    let active = true
    function apply(current: Account | null) {
      if (!active) return
      if (current) {
        setAccount(current)
        setStatus('authenticated')
      } else {
        setAccount(null)
        setStatus('anonymous')
      }
    }
    function refresh() {
      getCurrentAccount().then(apply).catch(() => apply(null))
    }
    refresh()
    const unsubscribe = onAuthChanged((changed) => {
      if (changed === undefined) refresh()
      else apply(changed)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  const value = useMemo(() => ({ status, account, clear }), [status, account, clear])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth は AuthProvider の内側で使用してください')
  return value
}