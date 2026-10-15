import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { getCurrentAccount } from '../../api/auth'
import { notifyAuthChanged } from '../../api/authEvents'

vi.mock('../../api/auth', () => ({ getCurrentAccount: vi.fn() }))

const member = { id: 1, username: 'taro', displayName: '太郎', role: 'USER' as const, bodyWeightKg: 63.5 }

function Probe() {
  const { status, account } = useAuth()
  return <div>{status}:{account?.username ?? '-'}</div>
}

function renderProbe() {
  return render(<AuthProvider><Probe /></AuthProvider>)
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getCurrentAccount).mockReset()
  })

  test('starts as loading, then reflects the server session', async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue(member)
    renderProbe()

    expect(screen.getByText('loading:-')).toBeInTheDocument()
    expect(await screen.findByText('authenticated:taro')).toBeInTheDocument()
    expect(localStorage.getItem('trainingApp.accountProfile:taro')).toBe('{"bodyWeightKg":63.5}')
  })

  test('becomes anonymous when there is no session', async () => {
    vi.mocked(getCurrentAccount).mockRejectedValue(new Error('unauthenticated'))
    renderProbe()

    expect(await screen.findByText('anonymous:-')).toBeInTheDocument()
    expect(localStorage.getItem('trainingapp:authUser')).toBeNull()
  })

  test('applies a login immediately, without waiting for another server round trip', async () => {
    vi.mocked(getCurrentAccount).mockRejectedValue(new Error('unauthenticated'))
    renderProbe()
    await screen.findByText('anonymous:-')
    vi.mocked(getCurrentAccount).mockClear()

    act(() => { notifyAuthChanged(member) })

    expect(screen.getByText('authenticated:taro')).toBeInTheDocument()
    expect(getCurrentAccount).not.toHaveBeenCalled()
  })

  test('applies a logout immediately', async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue(member)
    renderProbe()
    await screen.findByText('authenticated:taro')

    act(() => { notifyAuthChanged(null) })

    expect(screen.getByText('anonymous:-')).toBeInTheDocument()
    expect(localStorage.getItem('trainingapp:authUser')).toBeNull()
  })

  test('re-checks the server when notified without an account', async () => {
    vi.mocked(getCurrentAccount).mockRejectedValue(new Error('unauthenticated'))
    renderProbe()
    await screen.findByText('anonymous:-')

    vi.mocked(getCurrentAccount).mockResolvedValue(member)
    await act(async () => { notifyAuthChanged() })

    expect(await screen.findByText('authenticated:taro')).toBeInTheDocument()
  })
})