import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Body from '../Body'
import { createBodyMeasurement, deleteBodyMeasurement, listBodyMeasurements } from '../../api/bodyMeasurements'
import { formatDateTime } from '../../utils/date'

vi.mock('../../api/bodyMeasurements', () => ({
  listBodyMeasurements: vi.fn(),
  createBodyMeasurement: vi.fn(async () => ({})),
  deleteBodyMeasurement: vi.fn(async () => undefined),
}))

const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).toISOString()
const row = (id: string, type: 'height_cm' | 'weight_kg' | 'body_fat_pct', value: number, measuredAt: string) => ({ id, type, value, measuredAt, date: measuredAt.slice(0, 10) })

describe('Body page', () => {
  beforeEach(() => {
    vi.mocked(listBodyMeasurements).mockReset().mockResolvedValue([])
    vi.mocked(createBodyMeasurement).mockClear()
    vi.mocked(deleteBodyMeasurement).mockClear()
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
    await user.type(screen.getByLabelText('体脂肪(%)'), '18.2')
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
    expect(items[0]).toHaveTextContent('- / 66.4 kg / 18.2%')
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
})