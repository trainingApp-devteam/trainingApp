import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HistoryDetail from '../HistoryDetail'
import { updateRecord, withCalorieEstimates } from '../../api/records'

const record = {
  id: '1',
  date: '2026-10-13',
  exerciseId: '5',
  note: '朝トレ',
  sets: [
    { exerciseId: '5', exerciseName: 'チェストプレス', type: 'reps', reps: 10, weight: 40, calorieEstimateId: 7, estimatedCaloriesKcal: 3.15, rpe: 8 },
    { exerciseId: '5', exerciseName: 'チェストプレス', type: 'reps', reps: 10, weight: 40, calorieEstimateId: 8, estimatedCaloriesKcal: 1.5 },
    { exerciseId: '14', exerciseName: 'ダンベル', type: 'reps', reps: 8 },
  ],
}

vi.mock('../../api/records', () => ({
  getRecord: vi.fn(async () => record),
  updateRecord: vi.fn(async (_id: string, body: any) => ({ ...body, id: '1' })),
  // 推定対象で未推定のセットに推定IDを付ける
  withCalorieEstimates: vi.fn(async (sets: any[]) => sets.map((set) =>
    set.calorieEnabled && set.calorieEstimateId === undefined ? { ...set, calorieEstimateId: 99, estimatedCaloriesKcal: 4.2 } : set)),
}))
vi.mock('../../api/exercises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/exercises')>()),
  searchExercises: vi.fn(async () => [{ id: '5', name: 'チェストプレス', group: '胸', calorieEnabled: true, calorieBases: ['REP', 'MINUTE'] }]),
}))
vi.mock('../../api/bodyMeasurements', () => ({ getLatestBodyWeight: vi.fn(async () => 70) }))

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/history/1']}>
      <Routes><Route path="/history/:id" element={<HistoryDetail />} /></Routes>
    </MemoryRouter>,
  )
}

describe('HistoryDetail page', () => {
  beforeEach(() => { vi.mocked(updateRecord).mockClear(); vi.mocked(withCalorieEstimates).mockClear() })

  test('shows per-set and total estimated calories, leaving uncalculated sets blank', async () => {
    renderPage()

    expect(await screen.findByText(/推定 3.15 kcal/)).toBeInTheDocument()
    expect(screen.getByText('4.65 kcal')).toBeInTheDocument()
    expect(screen.getByText(/ダンベル: 8回$/)).toBeInTheDocument()
  })

  test('edits a set and re-estimates the calories only for the changed set with its original RPE', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: '編集' }))

    const reps = screen.getByLabelText('セット1の回数')
    await user.clear(reps)
    await user.type(reps, '12')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(updateRecord).toHaveBeenCalledTimes(1)
    const [id, body] = vi.mocked(updateRecord).mock.calls[0]
    expect(id).toBe('1')
    expect(body.note).toBe('朝トレ')
    const [prepared, bodyWeightKg] = vi.mocked(withCalorieEstimates).mock.calls[0]
    expect(bodyWeightKg).toBe(70)
    expect(prepared[0]).toMatchObject({ reps: 12, rpe: 8, calorieEnabled: true, calorieEstimateId: undefined })
    expect(body.sets[0]).toMatchObject({ reps: 12, calorieEstimateId: 99, estimatedCaloriesKcal: 4.2 })
    expect(body.sets[1]).toMatchObject({ reps: 10, calorieEstimateId: 8 })
    expect(await screen.findByRole('button', { name: '編集' })).toBeInTheDocument()
  })

  test('removes and copies sets, and rejects invalid values', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: '編集' }))

    await user.click(screen.getAllByRole('button', { name: 'コピー' })[2])
    expect(screen.getAllByLabelText(/^セット\d+の回数$/)).toHaveLength(4)
    await user.click(screen.getAllByRole('button', { name: '削除' })[3])
    expect(screen.getAllByLabelText(/^セット\d+の回数$/)).toHaveLength(3)

    const reps = screen.getByLabelText('セット3の回数')
    await user.clear(reps)
    await user.type(reps, '0')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByRole('alert')).toHaveTextContent('1以上の整数')
    expect(updateRecord).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument()
  })
})