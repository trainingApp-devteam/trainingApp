import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HistoryDetail from '../HistoryDetail'

vi.mock('../../api/records', () => ({
  getRecord: vi.fn(async () => ({
    id: '1',
    date: '2026-10-13',
    exerciseId: '5',
    sets: [
      { exerciseId: '5', exerciseName: 'チェストプレス', type: 'reps', reps: 10, weight: 40, estimatedCaloriesKcal: 3.15 },
      { exerciseId: '5', exerciseName: 'チェストプレス', type: 'reps', reps: 10, weight: 40, estimatedCaloriesKcal: 1.5 },
      { exerciseId: '14', exerciseName: 'ダンベル', type: 'reps', reps: 8 },
    ],
  })),
}))

describe('HistoryDetail page', () => {
  test('shows per-set and total estimated calories, leaving uncalculated sets blank', async () => {
    render(
      <MemoryRouter initialEntries={['/history/1']}>
        <Routes><Route path="/history/:id" element={<HistoryDetail />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/推定 3.15 kcal/)).toBeInTheDocument()
    expect(screen.getByText('4.65 kcal')).toBeInTheDocument()
    expect(screen.getByText(/ダンベル: 8回$/)).toBeInTheDocument()
  })
})
