import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Progress from '../Progress'
import { getExerciseProgress, listRecordedExercises } from '../../api/statistics'

vi.mock('../../api/statistics', () => ({
  listRecordedExercises: vi.fn(),
  getExerciseProgress: vi.fn(),
}))

const point = (date: string, extra: Record<string, unknown>) => ({
  sessionId: 1, trainingDate: date, maxWeightKg: null, volumeKg: null, totalReps: 0, totalDurationSeconds: 0, setCount: 1, estimatedCaloriesKcal: null, ...extra,
})

function renderPage() {
  return render(<MemoryRouter><Progress /></MemoryRouter>)
}

describe('Progress page', () => {
  beforeEach(() => {
    vi.mocked(listRecordedExercises).mockReset().mockResolvedValue([
      { exerciseId: 6, exerciseName: 'ベンチプレス', category: '胸', sessionCount: 2, lastTrainingDate: '2026-10-08' },
      { exerciseId: 1, exerciseName: 'トレッドミル', category: '有酸素', sessionCount: 1, lastTrainingDate: '2026-10-01' },
    ])
    vi.mocked(getExerciseProgress).mockReset().mockImplementation(async (id) => id === 6
      ? { exerciseId: 6, exerciseName: 'ベンチプレス', points: [
          point('2026-10-01', { maxWeightKg: 45, volumeKg: 760, totalReps: 18 }),
          point('2026-10-08', { maxWeightKg: 50, volumeKg: 800, totalReps: 16, estimatedCaloriesKcal: 3.2 }),
        ] }
      : { exerciseId: 1, exerciseName: 'トレッドミル', points: [point('2026-10-01', { totalDurationSeconds: 1200 })] })
  })

  test('shows max weight and volume for the most recently recorded exercise over 3 months', async () => {
    renderPage()

    expect(await screen.findByRole('img', { name: /最大重量の推移（2件）/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /トレーニング量の推移（2件）/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /推定消費カロリーの推移（1件）/ })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /合計時間/ })).not.toBeInTheDocument()
    expect(screen.getByText(/時間で記録したセットと重量のないセットは含みません/)).toBeInTheDocument()
    const [id, from] = vi.mocked(getExerciseProgress).mock.calls[0]
    expect(id).toBe(6)
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('switches exercise and period', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('img', { name: /最大重量/ })

    await user.selectOptions(screen.getByLabelText('種目'), 'トレッドミル（1回）')
    expect(await screen.findByRole('img', { name: /合計時間の推移（1件）/ })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /最大重量/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: '全期間' }))
    expect(vi.mocked(getExerciseProgress).mock.calls.slice(-1)[0]).toEqual([1, null])
  })

  test('guides to recording when nothing has been recorded', async () => {
    vi.mocked(listRecordedExercises).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText(/まだ記録がありません/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'トレーニングを記録' })).toHaveAttribute('href', '/record/select')
    expect(getExerciseProgress).not.toHaveBeenCalled()
  })
})
