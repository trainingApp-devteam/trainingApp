import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../api/auth'
import { useAuth } from '../auth/AuthContext'

export const navItems = [
  { to: '/record', label: '記録' },
  { to: '/history', label: '履歴' },
  { to: '/menu', label: 'メニュー' },
  { to: '/progress', label: '推移' },
  { to: '/body', label: '身体測定' },
  { to: '/account', label: 'アカウント' },
]

export default function Header(): JSX.Element {
  const [open, setOpen] = useState(false)
  const { status, account, clear } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (event.target instanceof Node && containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function signOut() {
    setLoggingOut(true)
    try {
      await logout()
      clear()
      navigate('/account')
    } catch {
      // ログアウトに失敗した場合はログイン状態のまま表示し、再度の操作を可能にする
    } finally {
      setLoggingOut(false)
    }
  }

  const accountName = account ? account.displayName || account.username : ''

  return (
    <header className="w-full bg-gray-800 text-white shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-bold">
          <img src="/otter.svg" alt="" width={36} height={36} className="h-9 w-9" />
          TrainingApp
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {account ? (
            <>
              <span className="min-w-0 max-w-[9rem] truncate text-sm text-gray-100 sm:max-w-[14rem]" title={`${account.username}${account.role === 'ADMIN' ? '（管理者）' : ''}`}>
                <span className="sr-only">ログイン中: </span>{accountName}
              </span>
              <button
                type="button"
                onClick={signOut}
                disabled={loggingOut}
                className="shrink-0 rounded bg-red-700 px-3 py-1.5 text-sm hover:bg-red-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                ログアウト
              </button>
            </>
          ) : status === 'anonymous' && location.pathname !== '/account' ? (
            <Link to="/account" className="shrink-0 rounded bg-indigo-600 px-3 py-1.5 text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              ログイン
            </Link>
          ) : null}
          <div ref={containerRef} className="relative shrink-0">
            <button
              ref={buttonRef}
              type="button"
              aria-label="メニュー"
              aria-haspopup="true"
              aria-expanded={open}
              aria-controls="global-menu"
              onClick={() => setOpen((value) => !value)}
              className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <span aria-hidden="true" className={`block h-0.5 w-5 bg-white transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
              <span aria-hidden="true" className={`block h-0.5 w-5 bg-white transition-opacity ${open ? 'opacity-0' : ''}`} />
              <span aria-hidden="true" className={`block h-0.5 w-5 bg-white transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
            </button>
            {open && (
              <nav id="global-menu" aria-label="メインメニュー" className="absolute right-0 z-20 mt-2 w-48 rounded-lg bg-gray-800 p-2 shadow-xl ring-1 ring-white/10">
                <ul>
                  {navItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) => `block rounded px-3 py-2 hover:bg-gray-700 ${isActive ? 'bg-gray-700 font-semibold' : ''}`}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}