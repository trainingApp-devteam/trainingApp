import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Account from '../Account'
import { getAccountBodyWeight, saveAccountBodyWeight } from '../../api/accountProfile'
import { acceptInvitation, getCurrentAccount, login, updateBodyWeight } from '../../api/auth'

vi.mock('../../api/auth', () => ({
  getCurrentAccount: vi.fn(),
  login: vi.fn(),
  acceptInvitation: vi.fn(),
  updateBodyWeight: vi.fn(),
}))

const member = { id: 2, username: 'taro', displayName: '太郎', role: 'USER' as const }

function Destination() {
  const location = useLocation()
  return <div>moved to {location.pathname}{location.search}</div>
}

function renderAccount(entry: string | { pathname: string; state: unknown } = '/account') {
  return render(
    <MemoryRouter initialEntries={[entry as any]}>
      <Routes>
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Account screen when logged out', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getCurrentAccount).mockReset().mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(login).mockReset().mockResolvedValue(member)
    vi.mocked(acceptInvitation).mockReset().mockResolvedValue({ status: 'PENDING_APPROVAL' })
  })

  test('has exactly one login button and no logout button', async () => {
    renderAccount()

    expect(await screen.findByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /ログイン/ })).toHaveLength(1)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
  })

  test('logs in with the form and goes to the home screen', async () => {
    const user = userEvent.setup()
    renderAccount()

    await user.type(await screen.findByLabelText('ユーザー名'), 'taro')
    await user.type(screen.getByLabelText('パスワード'), 'secret-password')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(login).toHaveBeenCalledWith('taro', 'secret-password')
    expect(await screen.findByText('moved to /')).toBeInTheDocument()
  })

  test('submits with the Enter key', async () => {
    const user = userEvent.setup()
    renderAccount()

    await user.type(await screen.findByLabelText('ユーザー名'), 'taro')
    await user.type(screen.getByLabelText('パスワード'), 'secret-password{Enter}')

    expect(login).toHaveBeenCalledWith('taro', 'secret-password')
  })

  test('returns to the page that required login', async () => {
    const user = userEvent.setup()
    renderAccount({ pathname: '/account', state: { from: '/record?menuId=3&autoStart=1' } })

    expect(await screen.findByText('この画面を利用するにはログインが必要です。')).toBeInTheDocument()
    await user.type(screen.getByLabelText('ユーザー名'), 'taro')
    await user.type(screen.getByLabelText('パスワード'), 'secret-password')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByText('moved to /record?menuId=3&autoStart=1')).toBeInTheDocument()
  })

  test('shows the login error and stays on the screen', async () => {
    const user = userEvent.setup()
    vi.mocked(login).mockRejectedValue(new Error('ユーザー名またはパスワードが正しくありません。'))
    renderAccount()

    await user.type(await screen.findByLabelText('ユーザー名'), 'taro')
    await user.type(screen.getByLabelText('パスワード'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ユーザー名またはパスワードが正しくありません。')
    expect(screen.queryByText(/moved to/)).not.toBeInTheDocument()
  })

  test('switches to 新規登録 (not 招待で登録) and registers with an invitation code', async () => {
    const user = userEvent.setup()
    renderAccount()

    expect(screen.queryByText('招待で登録')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '新規登録' }))

    expect(screen.getByRole('heading', { name: '新規登録' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログイン' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('招待コード'), 'invite-token')
    await user.type(screen.getByLabelText('表示名'), '太郎')
    await user.type(screen.getByLabelText('ユーザー名'), 'taro')
    await user.type(screen.getByLabelText('パスワード'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: '登録申請' }))

    expect(acceptInvitation).toHaveBeenCalledWith({ token: 'invite-token', username: 'taro', displayName: '太郎', password: 'long-enough-password' })
    expect(await screen.findByRole('status')).toHaveTextContent('申請を受け付けました')

    await user.click(screen.getByRole('button', { name: 'ログインへ戻る' }))
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    expect(screen.queryByLabelText('招待コード')).not.toBeInTheDocument()
  })
})

describe('Account screen when logged in', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getCurrentAccount).mockReset().mockResolvedValue(member)
  })

  test('shows the profile without login or logout controls (logout lives in the header)', async () => {
    renderAccount()

    expect(await screen.findByLabelText('体重（kg）')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ログイン/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
  })
})

describe('Account profile storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getCurrentAccount).mockReset().mockResolvedValue(member)
    vi.mocked(updateBodyWeight).mockReset().mockImplementation(async (bodyWeightKg: number) => ({ ...member, bodyWeightKg }))
  })

  test('saves the account body weight for calorie estimates', async () => {
    const user = userEvent.setup()
    renderAccount()

    await user.type(await screen.findByLabelText('体重（kg）'), '63.5')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(updateBodyWeight).toHaveBeenCalledWith(63.5)
    expect(await screen.findByRole('status')).toHaveTextContent('体重を保存しました')
    expect(localStorage.getItem('trainingApp.accountProfile:taro')).toBe('{"bodyWeightKg":63.5}')
  })

  test('rejects an out-of-range body weight without calling the server', async () => {
    const user = userEvent.setup()
    renderAccount()

    const input = await screen.findByLabelText('体重（kg）')
    await user.type(input, '10')
    // ブラウザー標準の範囲検証をすり抜けた場合でも、アプリ側で拒否する
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    expect(await screen.findByRole('alert')).toHaveTextContent('20〜300kg')
    expect(updateBodyWeight).not.toHaveBeenCalled()
  })

  test('keeps body weights separate between accounts', () => {
    saveAccountBodyWeight(63.5, 'first-user')
    saveAccountBodyWeight(81, 'second-user')

    expect(getAccountBodyWeight('first-user')).toBe(63.5)
    expect(getAccountBodyWeight('second-user')).toBe(81)
  })
})