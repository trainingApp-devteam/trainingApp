import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { localDateString } from '../utils/date'

export const navItems = [
  { to: '/record', label: '記録' },
  { to: '/history', label: '履歴' },
  { to: '/menu', label: 'メニュー' },
  { to: '/body', label: '身体測定' },
  { to: '/account', label: 'アカウント' },
]

export default function Header(): JSX.Element {
  const today = localDateString()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const location = useLocation()

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

  return (
    <header className="w-full bg-gray-800 text-white shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">TrainingApp</Link>
        <div className="flex items-center gap-4">
          <time dateTime={today} className="text-sm text-gray-300">{today}</time>
          <div ref={containerRef} className="relative">
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