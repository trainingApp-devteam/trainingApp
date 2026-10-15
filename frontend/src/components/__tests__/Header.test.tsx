import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Header from '../Header'
import { AuthProvider } from '../../auth/AuthContext'
import { getCurrentAccount, logout } from '../../api/auth'
import { notifyAuthChanged } from '../../api/authEvents'

vi.mock('../../api/auth', () => ({ getCurrentAccount: vi.fn(), logout: vi.fn() }))

const member = { id: 2, username: 'taro', displayName: '太郎', role: 'USER' as const, bodyWeightKg: 63.5 }

function renderHeader(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Header />
        <Routes>
          <Route path="/account" element={<div>account page</div>} />
          <Route path="*" element={<div>content</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('Header hamburger menu', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getCurrentAccount).mockReset().mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(logout).mockReset().mockResolvedValue(undefined)
  })
  test('shows the local date', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 15, 0, 30))
    try {
      renderHeader()
      expect(screen.getByText('2026-10-15')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  test('keeps the page links hidden until the menu button is pressed', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: 'メニュー' })

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'TrainingApp' })).toHaveAttribute('href', '/')

    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const nav = screen.getByRole('navigation', { name: 'メインメニュー' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['記録', '/record'],
      ['履歴', '/history'],
      ['メニュー', '/menu'],
      ['身体測定', '/body'],
      ['アカウント', '/account'],
    ])
  })

  test('marks the current page', async () => {
    const user = userEvent.setup()
    renderHeader('/history')
    await user.click(screen.getByRole('button', { name: 'メニュー' }))

    expect(screen.getByRole('link', { name: '履歴' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '記録' })).not.toHaveAttribute('aria-current')
  })

  test('closes after choosing a page', async () => {
    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByRole('link', { name: '身体測定' }))

    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'メニュー' })).toHaveAttribute('aria-expanded', 'false')
  })

  test('closes with Escape and when clicking outside, and returns focus to the button on Escape', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: 'メニュー' })

    await user.click(button)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()

    await user.click(button)
    await user.click(screen.getByText('content'))
    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
  })

  test('toggles closed when the button is pressed again', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: 'メニュー' })

    await user.click(button)
    await user.click(button)

    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
  })

  describe('login state', () => {
    test('shows a login link when nobody is logged in', async () => {
      renderHeader()

      expect(await screen.findByRole('link', { name: 'ログイン' })).toHaveAttribute('href', '/account')
      expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
    })

    test('does not repeat the login link on the account screen itself', async () => {
      renderHeader('/account')
      await screen.findByRole('button', { name: 'メニュー' })
      await act(async () => { await Promise.resolve() })

      expect(screen.queryByRole('link', { name: 'ログイン' })).not.toBeInTheDocument()
    })

    test('shows the account name and a logout button when logged in', async () => {
      vi.mocked(getCurrentAccount).mockResolvedValue(member)
      renderHeader()

      expect(await screen.findByText('太郎')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'ログイン' })).not.toBeInTheDocument()
      expect(JSON.parse(localStorage.getItem('trainingapp:authUser') || 'null')).toEqual({ username: 'taro' })
    })

    test('falls back to the username when there is no display name', async () => {
      vi.mocked(getCurrentAccount).mockResolvedValue({ ...member, displayName: '' })
      renderHeader()

      expect(await screen.findByText('taro')).toBeInTheDocument()
    })

    test('logs out, returns to the login screen (which has its own login form), and clears the cached account', async () => {
      const user = userEvent.setup()
      vi.mocked(getCurrentAccount).mockResolvedValue(member)
      renderHeader('/history')

      await user.click(await screen.findByRole('button', { name: 'ログアウト' }))

      expect(logout).toHaveBeenCalledTimes(1)
      expect(await screen.findByText('account page')).toBeInTheDocument()
      expect(screen.queryByText('太郎')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
      expect(localStorage.getItem('trainingapp:authUser')).toBeNull()
    })

    test('stays logged in when logout fails', async () => {
      const user = userEvent.setup()
      vi.mocked(getCurrentAccount).mockResolvedValue(member)
      vi.mocked(logout).mockRejectedValue(new Error('network'))
      renderHeader('/history')

      await user.click(await screen.findByRole('button', { name: 'ログアウト' }))

      expect(await screen.findByText('太郎')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeEnabled()
      expect(screen.queryByText('account page')).not.toBeInTheDocument()
    })

    test('updates when another screen logs in', async () => {
      renderHeader()
      expect(await screen.findByRole('link', { name: 'ログイン' })).toBeInTheDocument()

      vi.mocked(getCurrentAccount).mockResolvedValue(member)
      await act(async () => { notifyAuthChanged() })

      expect(await screen.findByText('太郎')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'ログイン' })).not.toBeInTheDocument()
    })
  })
})