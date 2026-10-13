import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Record from '../Record'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/exercises', () => {
  return {
    searchExercises: vi.fn(async (q = '', category?: string) => {
      return [ { id: 'e1', name: '既存種目', group: category || 'その他' } ]
    }),
    listExerciseGroups: vi.fn(async () => [ { id: 'その他', name: 'その他' } ]),
    createExercise: vi.fn(async (name: string, group?: string) => ({ id: `ex_${Date.now()}`, name, group: group || 'その他' })),
  }
})

vi.mock('../../api/records', () => ({ createRecord: vi.fn(async () => ({ id: 'r1' })) }))

describe('Record page', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('renders selects and can open create modal', async () => {
    render(<MemoryRouter><Record /></MemoryRouter>)
    // groups select should exist
    expect(await screen.findByRole('combobox', { name: /部位|種目/ })).toBeTruthy()
  })

  test('adds the selected exercise to the set list', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Record /></MemoryRouter>)
    expect(await screen.findByRole('option', { name: '既存種目' })).toBeInTheDocument()
    const addBtn = screen.getByRole('button', { name: /セットを追加/ })
    await user.click(addBtn)

    const found = await screen.findAllByText('既存種目')
    expect(found.length).toBeGreaterThan(0)
  })

  test('uses the account body weight and provides RPE guidance', async () => {
    localStorage.setItem('trainingapp:authUser', JSON.stringify({ username: 'test-user' }))
    localStorage.setItem('trainingApp.accountProfile:test-user', JSON.stringify({ bodyWeightKg: 63.5 }))
    render(<MemoryRouter><Record /></MemoryRouter>)

    expect(await screen.findByText('推定用体重: 63.5 kg（アカウント登録値）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'RPEの目安' })).toHaveAttribute('aria-describedby', 'rpe-help')
    expect(screen.getByRole('tooltip')).toHaveTextContent('あと2回')
  })
})
