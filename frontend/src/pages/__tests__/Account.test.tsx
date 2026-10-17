import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Account from '../Account'
import { acceptInvitation, changePassword, getCurrentAccount, login, updateAccount } from '../../api/auth'

vi.mock('../../api/auth', () => ({
  getCurrentAccount: vi.fn(),
  login: vi.fn(),
  acceptInvitation: vi.fn(),
  updateAccount: vi.fn(),
  changePassword: vi.fn(),
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
    vi.mocked(getCurrentAccount).mockReset().mockResolvedValue(member)
  })

  test('shows who is logged in, without login, logout, or body weight controls', async () => {
    renderAccount()

    expect(await screen.findByText('太郎')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ログイン/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('体重（kg）')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
  })

  test('no longer explains the body weight used for calorie estimates', async () => {
    renderAccount()

    await screen.findByText('太郎')
    expect(screen.queryByText(/カロリー推定に使う体重/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '身体測定' })).not.toBeInTheDocument()
  })

  test('changes the account name', async () => {
    const user = userEvent.setup()
    vi.mocked(updateAccount).mockReset().mockResolvedValue({ ...member, displayName: '次郎' })
    renderAccount()
    const form = await screen.findByRole('form', { name: 'アカウント名の変更' })

    const input = within(form).getByLabelText('アカウント名')
    expect(input).toHaveValue('太郎')
    await user.clear(input)
    await user.type(input, '  次郎 ')
    await user.click(within(form).getByRole('button', { name: 'アカウント名を変更' }))

    expect(updateAccount).toHaveBeenCalledWith({ displayName: '次郎' })
    expect(await within(form).findByRole('status')).toHaveTextContent('アカウント名を変更しました')
    expect(screen.getByText('次郎')).toBeInTheDocument()
  })

  test('rejects an empty account name without calling the server', async () => {
    const user = userEvent.setup()
    vi.mocked(updateAccount).mockReset()
    renderAccount()
    const form = await screen.findByRole('form', { name: 'アカウント名の変更' })

    await user.clear(within(form).getByLabelText('アカウント名'))
    await user.click(within(form).getByRole('button', { name: 'アカウント名を変更' }))

    expect(within(form).getByRole('alert')).toHaveTextContent('アカウント名を入力してください')
    expect(updateAccount).not.toHaveBeenCalled()
  })

  test('changes the password after confirming the new one', async () => {
    const user = userEvent.setup()
    vi.mocked(changePassword).mockReset().mockResolvedValue(undefined)
    renderAccount()
    const form = await screen.findByRole('form', { name: 'パスワードの変更' })

    await user.type(within(form).getByLabelText('現在のパスワード'), 'old-password-123')
    await user.type(within(form).getByLabelText('新しいパスワード（12文字以上）'), 'new-password-456')
    await user.type(within(form).getByLabelText('新しいパスワード（確認）'), 'new-password-456')
    await user.click(within(form).getByRole('button', { name: 'パスワードを変更' }))

    expect(changePassword).toHaveBeenCalledWith('old-password-123', 'new-password-456')
    expect(await within(form).findByRole('status')).toHaveTextContent('パスワードを変更しました')
    expect(within(form).getByLabelText('現在のパスワード')).toHaveValue('')
  })

  test('checks the new password locally and shows a server error for a wrong current password', async () => {
    const user = userEvent.setup()
    vi.mocked(changePassword).mockReset().mockRejectedValue(new Error('現在のパスワードが正しくありません。'))
    renderAccount()
    const form = await screen.findByRole('form', { name: 'パスワードの変更' })
    const newPassword = within(form).getByLabelText('新しいパスワード（12文字以上）')
    const confirmation = within(form).getByLabelText('新しいパスワード（確認）')

    await user.type(within(form).getByLabelText('現在のパスワード'), 'old-password-123')
    await user.type(newPassword, 'short')
    await user.click(within(form).getByRole('button', { name: 'パスワードを変更' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('12〜128文字')

    await user.clear(newPassword)
    await user.type(newPassword, 'new-password-456')
    await user.type(confirmation, 'new-password-789')
    await user.click(within(form).getByRole('button', { name: 'パスワードを変更' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('一致しません')
    expect(changePassword).not.toHaveBeenCalled()

    await user.clear(confirmation)
    await user.type(confirmation, 'new-password-456')
    await user.click(within(form).getByRole('button', { name: 'パスワードを変更' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('現在のパスワードが正しくありません。')
  })
})
