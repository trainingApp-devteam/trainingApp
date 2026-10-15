import React from 'react'
import { render, screen, within } from '@testing-library/react'
import Home from '../Home'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import { getCurrentAccount } from '../../api/auth'
import { listRecords } from '../../api/records'
import { listBodyMeasurements } from '../../api/bodyMeasurements'
import { formatDateTime } from '../../utils/date'
import '@testing-library/jest-dom/vitest';

vi.mock('../../api/auth', () => ({ getCurrentAccount: vi.fn() }))
vi.mock('../../api/records', () => ({ listRecords: vi.fn(async () => []) }))
vi.mock('../../api/bodyMeasurements', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/bodyMeasurements')>()),
  listBodyMeasurements: vi.fn(async () => []),
}))

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
    vi.mocked(listBodyMeasurements).mockReset().mockResolvedValue([])
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

describe('Home page body data', () => {
  const measured = (id: string, type: 'height_cm' | 'weight_kg' | 'body_fat_pct', value: number, measuredAt: string) =>
    ({ id, type, value, measuredAt, date: measuredAt.slice(0, 10) })

  beforeEach(() => {
    vi.mocked(getCurrentAccount).mockReset().mockResolvedValue(member)
    vi.mocked(listBodyMeasurements).mockReset()
  })

  test('shows the latest height, weight, and body fat with their measurement date-time at the top', async () => {
    const newest = new Date(2026, 9, 15, 21, 30).toISOString()
    const older = new Date(2026, 9, 1, 8, 0).toISOString()
    vi.mocked(listBodyMeasurements).mockResolvedValue([
      measured('1', 'weight_kg', 70, older),
      measured('2', 'weight_kg', 66.4, newest),
      measured('3', 'height_cm', 171.5, older),
      measured('4', 'body_fat_pct', 18.2, newest),
    ])
    renderHome()

    const weight = await screen.findByTestId('body-weight_kg')
    expect(weight).toHaveTextContent('体重')
    expect(weight).toHaveTextContent('66.4')
    expect(weight).toHaveTextContent(`測定日時: ${formatDateTime(newest)}`)
    expect(screen.getByTestId('body-height_cm')).toHaveTextContent('171.5')
    expect(screen.getByTestId('body-height_cm')).toHaveTextContent(`測定日時: ${formatDateTime(older)}`)
    expect(screen.getByTestId('body-body_fat_pct')).toHaveTextContent('18.2')
    expect(screen.queryByText(/まだ登録されていません/)).not.toBeInTheDocument()
    expect(screen.queryByText('未登録')).not.toBeInTheDocument()

    // the body data comes before the record actions
    const heading = screen.getByRole('heading', { name: '現在の身体データ' })
    const actions = screen.getByRole('heading', { name: 'トレーニングを記録' })
    expect(heading.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('asks the user to register when nothing has been measured', async () => {
    vi.mocked(listBodyMeasurements).mockResolvedValue([])
    renderHome()

    expect(await screen.findByText(/身長・体重・体脂肪がまだ登録されていません/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '身体測定を登録する' })).toHaveAttribute('href', '/body')
    expect(screen.getAllByText('未登録')).toHaveLength(3)
  })

  test('marks only the missing items as unregistered when some are measured', async () => {
    vi.mocked(listBodyMeasurements).mockResolvedValue([measured('1', 'weight_kg', 66.4, new Date(2026, 9, 15, 9, 0).toISOString())])
    renderHome()

    expect(await screen.findByTestId('body-weight_kg')).toHaveTextContent('66.4')
    expect(screen.queryByText(/まだ登録されていません/)).not.toBeInTheDocument()
    expect(screen.getByTestId('body-height_cm')).toHaveTextContent('未登録')
    expect(screen.getByTestId('body-body_fat_pct')).toHaveTextContent('未登録')
    expect(within(screen.getByTestId('body-height_cm')).getByRole('link', { name: '身体測定で登録する' })).toHaveAttribute('href', '/body')
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