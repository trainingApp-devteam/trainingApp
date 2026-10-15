import React from 'react'
import { render, screen } from '@testing-library/react'
import Home from '../Home'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import { getCurrentAccount } from '../../api/auth'
import { listRecords } from '../../api/records'
import '@testing-library/jest-dom/vitest';

vi.mock('../../api/auth', () => ({ getCurrentAccount: vi.fn() }))
vi.mock('../../api/records', () => ({ listRecords: vi.fn(async () => []) }))
vi.mock('../../api/bodyMeasurements', () => ({ listBodyMeasurements: vi.fn(async () => []) }))

const member = { id: 1, username: 'taro', displayName: '太郎', role: 'USER' as const }

function renderHome() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Home />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Home page when logged in', () => {
  beforeEach(() => {
    vi.mocked(getCurrentAccount).mockReset().mockResolvedValue(member)
    vi.mocked(listRecords).mockClear()
  })

  test('quick action links exist and point to correct routes', async () => {
    renderHome()
    const recordLink = (await screen.findByText('今すぐ記録')).closest('a')
    const menuLink = screen.getByText('メニューを作成').closest('a')
    expect(recordLink).toHaveAttribute('href', '/record/select')
    expect(menuLink).toHaveAttribute('href', '/menu')
  })

  test('shows placeholder when no recent records', async () => {
    renderHome()
    expect(await screen.findByText(/まだ記録がありません/)).toBeInTheDocument()
  })

  test('does not duplicate the global navigation or the date shown in the header', async () => {
    renderHome()
    await screen.findByText('今すぐ記録')
    expect(screen.queryByText('クイックリンク')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /アカウント/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '履歴' })).not.toBeInTheDocument()
    expect(document.querySelector('time')).toBeNull()
  })
})

describe('Home page when not logged in', () => {
  beforeEach(() => {
    vi.mocked(getCurrentAccount).mockReset().mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(listRecords).mockClear()
  })

  test('asks the user to log in instead of offering to record or create menus', async () => {
    renderHome()

    expect(await screen.findByText('ログインしてください')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ログイン画面へ' })).toHaveAttribute('href', '/account')
    expect(screen.queryByText('今すぐ記録')).not.toBeInTheDocument()
    expect(screen.queryByText('メニューを作成')).not.toBeInTheDocument()
    expect(listRecords).not.toHaveBeenCalled()
  })

  test('shows neither the actions nor the login prompt while the login state is unknown', () => {
    vi.mocked(getCurrentAccount).mockReturnValue(new Promise(() => {}))
    renderHome()

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    expect(screen.queryByText('今すぐ記録')).not.toBeInTheDocument()
    expect(screen.queryByText('ログインしてください')).not.toBeInTheDocument()
  })
})