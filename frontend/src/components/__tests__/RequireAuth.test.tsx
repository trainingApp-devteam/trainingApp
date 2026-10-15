import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import RequireAuth from '../RequireAuth'
import { AuthProvider } from '../../auth/AuthContext'
import { getCurrentAccount } from '../../api/auth'

vi.mock('../../api/auth', () => ({ getCurrentAccount: vi.fn() }))

function LoginScreen() {
  const location = useLocation()
  return <div>login screen (from: {(location.state as { from?: string } | null)?.from})</div>
}

function renderGuarded(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/account" element={<LoginScreen />} />
          <Route path="/record" element={<RequireAuth><div>record page</div></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => { vi.mocked(getCurrentAccount).mockReset() })

  test('shows the protected page to a logged-in user', async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue({ id: 1, username: 'taro', displayName: '太郎', role: 'USER' })
    renderGuarded('/record')

    expect(await screen.findByText('record page')).toBeInTheDocument()
  })

  test('redirects an anonymous user to the login screen and remembers the destination', async () => {
    vi.mocked(getCurrentAccount).mockRejectedValue(new Error('unauthenticated'))
    renderGuarded('/record?menuId=3&autoStart=1')

    expect(await screen.findByText(/login screen/)).toHaveTextContent('from: /record?menuId=3&autoStart=1')
    expect(screen.queryByText('record page')).not.toBeInTheDocument()
  })

  test('renders nothing from the protected page while the login state is unknown', () => {
    vi.mocked(getCurrentAccount).mockReturnValue(new Promise(() => {}))
    renderGuarded('/record')

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    expect(screen.queryByText('record page')).not.toBeInTheDocument()
  })
})