import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BodyPage from '../Body'
import { createBodyMeasurement, deleteBodyMeasurement, listBodyMeasurements, listMeasurementHistory } from '../../api/bodyMeasurements'
import { getCurrentAccount, updateAccount } from '../../api/auth'
import { notifyAuthChanged } from '../../api/authEvents'
import { AuthProvider } from '../../auth/AuthContext'
import { formatDateTime } from '../../utils/date'

vi.mock('../../api/bodyMeasurements', () => ({
  listBodyMeasurements: vi.fn(),
  createBodyMeasurement: vi.fn(async () => ({})),
  deleteBodyMeasurement: vi.fn(async () => undefined),
  listMeasurementHistory: vi.fn(async () => []),
}))
vi.mock('../../api/auth', () => ({ getCurrentAccount: vi.fn(), updateAccount: vi.fn() }))

const member = { id: 2, username: 'taro', displayName: '太郎', role: 'USER' as const, heightCm: null as number | null }

function Body() {
  return <AuthProvider><BodyPage /></AuthProvider>
}

const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).toISOString()
const row = (id: string, type: 'height_cm' | 'weight_kg' | 'body_fat_pct', value: number, measuredAt: string) => ({ id, type, value, measuredAt, date: measuredAt.slice(0, 10) })

describe('Body page', () => {
  beforeEach(() => {
    vi.mocked(listBodyMeasurements).mockReset().mockResolvedValue([])
    vi.mocked(createBodyMeasurement).mockClear()
    vi.mocked(deleteBodyMeasurement).mockClear()
    vi.mocked(listMeasurementHistory).mockReset().mockResolvedValue([])
    vi.mocked(getCurrentAccount).mockReset().mockResolvedValue({ ...member })
    vi.mocked(updateAccount).mockReset().mockImplementation(async (changes) => {
      const account = { ...member, ...changes }
      notifyAuthChanged(account)
      return account
    })
  })

  test('registers only weight and body fat as measurements (no height field in the measurement form)', async () => {
    render(<Body />)
    const form = await screen.findByRole('form', { name: '体重・体脂肪率を登録' })

    expect(within(form).getByLabelText('体重(kg)')).toBeInTheDocument()
    expect(within(form).getByLabelText('体脂肪率(%)')).toBeInTheDocument()
    expect(within(form).queryByLabelText('身長(cm)')).not.toBeInTheDocument()
  })

  test('registers the height once, then shows it with a correction button instead of the input', async () => {
    const user = userEvent.setup()
    render(<Body />)
    const height = await screen.findByRole('region', { name: '身長' })

    await user.type(await within(height).findByLabelText('身長(cm)'), '171.5')
    await user.click(within(height).getByRole('button', { name: '登録' }))

    expect(updateAccount).toHaveBeenCalledWith({ heightCm: 171.5 })
    expect(createBodyMeasurement).not.toHaveBeenCalled()
    expect(await within(height).findByRole('status')).toHaveTextContent('身長を登録しました')
    expect(within(height).getByText('171.5')).toBeInTheDocument()
    expect(within(height).queryByLabelText('身長(cm)')).not.toBeInTheDocument()
    expect(within(height).getByRole('button', { name: '修正' })).toBeInTheDocument()
  })

  test('lets the user correct a registered height', async () => {
    const user = userEvent.setup()
    vi.mocked(getCurrentAccount).mockResolvedValue({ ...member, heightCm: 170 })
    render(<Body />)
    const height = await screen.findByRole('region', { name: '身長' })

    await user.click(await within(height).findByRole('button', { name: '修正' }))
    const input = within(height).getByLabelText('身長(cm)')
    expect(input).toHaveValue(170)
    await user.clear(input)
    await user.type(input, '171')
    await user.click(within(height).getByRole('button', { name: '保存' }))

    expect(updateAccount).toHaveBeenCalledWith({ heightCm: 171 })
    expect(await within(height).findByRole('status')).toHaveTextContent('身長を修正しました')
  })

  test('rejects an out-of-range height without calling the server', async () => {
    const user = userEvent.setup()
    render(<Body />)
    const height = await screen.findByRole('region', { name: '身長' })

    await user.type(await within(height).findByLabelText('身長(cm)'), '30')
    await user.click(within(height).getByRole('button', { name: '登録' }))

    expect(within(height).getByRole('alert')).toHaveTextContent('身長は50〜300')
    expect(updateAccount).not.toHaveBeenCalled()
  })

  test('has a date-time input (not only a date) for the measurement time', async () => {
    render(<Body />)
    const input = await screen.findByLabelText('測定日時')

    expect(input).toHaveAttribute('type', 'datetime-local')
    expect((input as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  test('saves the entered values at the chosen measurement time as one UTC instant', async () => {
    const user = userEvent.setup()
    render(<Body />)
    const when = await screen.findByLabelText('測定日時')
    await user.clear(when)
    await user.type(when, '2026-10-15T21:30')
    await user.type(screen.getByLabelText('体重(kg)'), '66.4')
    await user.type(screen.getByLabelText('体脂肪率(%)'), '18.2')
    await user.click(screen.getByRole('button', { name: '保存' }))

    const instant = new Date(2026, 9, 15, 21, 30).toISOString()
    expect(createBodyMeasurement).toHaveBeenCalledTimes(2)
    expect(createBodyMeasurement).toHaveBeenCalledWith(instant, 'weight_kg', 66.4)
    expect(createBodyMeasurement).toHaveBeenCalledWith(instant, 'body_fat_pct', 18.2)
    expect(await screen.findByRole('status')).toHaveTextContent('保存しました')
  })

  test('rejects an empty entry and an out-of-range weight without calling the server', async () => {
    const user = userEvent.setup()
    render(<Body />)
    await screen.findByLabelText('測定日時')

    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('測定値を1つ以上入力してください')

    await user.type(screen.getByLabelText('体重(kg)'), '10')
    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByRole('alert')).toHaveTextContent('体重は20〜300')
    expect(createBodyMeasurement).not.toHaveBeenCalled()
  })

  test('lists measurements newest first with the date and time, grouped by measurement time', async () => {
    vi.mocked(listBodyMeasurements).mockResolvedValue([
      row('1', 'weight_kg', 70, at(1, 8)),
      row('2', 'weight_kg', 66.4, at(15, 21)),
      row('3', 'body_fat_pct', 18.2, at(15, 21)),
    ])
    render(<Body />)

    const history = await screen.findByRole('region', { name: '履歴' })
    const items = within(history).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent(formatDateTime(at(15, 21)))
    expect(items[0]).toHaveTextContent('体重 66.4 kg / 体脂肪率 18.2%')
    expect(items[1]).toHaveTextContent(formatDateTime(at(1, 8)))
  })

  test('deletes every value saved at that measurement time after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(listBodyMeasurements).mockResolvedValue([
      row('2', 'weight_kg', 66.4, at(15, 21)),
      row('3', 'body_fat_pct', 18.2, at(15, 21)),
    ])
    render(<Body />)

    await user.click(await screen.findByRole('button', { name: '削除' }))

    expect(deleteBodyMeasurement).toHaveBeenCalledTimes(2)
    expect(deleteBodyMeasurement).toHaveBeenCalledWith('2')
    expect(deleteBodyMeasurement).toHaveBeenCalledWith('3')
    vi.restoreAllMocks()
  })

  test('charts weight and body fat separately for the chosen period', async () => {
    const user = userEvent.setup()
    vi.mocked(listMeasurementHistory).mockImplementation(async (type) => type === 'weight_kg'
      ? [row('1', 'weight_kg', 70, at(1, 8)), row('2', 'weight_kg', 68.5, at(15, 8))]
      : [])
    render(<Body />)

    const trend = await screen.findByRole('region', { name: '推移' })
    expect(await within(trend).findByRole('img', { name: /体重の推移（2件）/ })).toBeInTheDocument()
    expect(within(trend).getByText('体脂肪率')).toBeInTheDocument()
    expect(within(trend).getByText('この期間のデータがありません')).toBeInTheDocument()
    // the default period is 3 months
    expect(within(trend).getByRole('radio', { name: '3か月' })).toHaveAttribute('aria-checked', 'true')
    const [, from] = vi.mocked(listMeasurementHistory).mock.calls[0]
    expect(from).toBeInstanceOf(Date)

    await user.click(within(trend).getByRole('radio', { name: '全期間' }))
    expect(within(trend).getByRole('radio', { name: '全期間' })).toHaveAttribute('aria-checked', 'true')
    const last = vi.mocked(listMeasurementHistory).mock.calls.slice(-1)[0]
    expect(last[1]).toBeNull()
  })
})
