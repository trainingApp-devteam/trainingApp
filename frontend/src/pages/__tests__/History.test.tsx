import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import History from '../History'
import { deleteRecord, listRecords } from '../../api/records'

vi.mock('../../api/records', () => ({
  listRecords: vi.fn(),
  deleteRecord: vi.fn(async () => undefined),
}))
vi.mock('../../api/exercises', () => ({
  searchExercises: vi.fn(async () => [{ id: '5', name: 'チェストプレス', group: '胸' }]),
  listExerciseGroups: vi.fn(async () => [{ id: '胸', name: '胸' }]),
}))

const records = [
  { id: '2', date: '2026-10-13', exerciseId: '5', sets: [{ exerciseId: '5', exerciseName: 'チェストプレス', type: 'reps', reps: 10, weight: 40, estimatedCaloriesKcal: 3.15 }, { exerciseId: '5', type: 'reps', reps: 8, estimatedCaloriesKcal: 1.5 }] },
  { id: '1', date: '2026-10-12', exerciseId: '5', sets: [{ exerciseId: '5', type: 'time', timeSeconds: 600 }] },
]

describe('History page', () => {
  beforeEach(() => {
    vi.mocked(listRecords).mockResolvedValue(records as any)
    vi.mocked(deleteRecord).mockClear()
  })
  afterEach(() => { vi.restoreAllMocks() })

  test('lists records with calorie totals only where estimates exist', async () => {
    render(<MemoryRouter><History /></MemoryRouter>)

    expect(await screen.findByText(/2026-10-13 — チェストプレス/)).toBeInTheDocument()
    expect(screen.getByText(/推定消費カロリー: 4.65 kcal/)).toBeInTheDocument()
    expect(screen.getAllByText(/推定消費カロリー/)).toHaveLength(1)
    expect(screen.getByText(/600秒/)).toBeInTheDocument()
  })

  test('deletes a record after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryRouter><History /></MemoryRouter>)

    const row = (await screen.findByText(/2026-10-13 — チェストプレス/)).closest('li') as HTMLElement
    await user.click(within(row).getByRole('button', { name: '削除' }))

    expect(deleteRecord).toHaveBeenCalledWith('2')
    expect(screen.queryByText(/2026-10-13 — チェストプレス/)).not.toBeInTheDocument()
  })

  test('keeps the record when deletion is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><History /></MemoryRouter>)

    const row = (await screen.findByText(/2026-10-13 — チェストプレス/)).closest('li') as HTMLElement
    await user.click(within(row).getByRole('button', { name: '削除' }))

    expect(deleteRecord).not.toHaveBeenCalled()
  })
})