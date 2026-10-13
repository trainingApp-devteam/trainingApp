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
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )
  })

  test('renders selects and can open create modal', async () => {
    // groups select should exist
    expect(await screen.findByRole('combobox', { name: /部位|種目/ })).toBeTruthy()
  })

  test('selecting an existing exercise and adding a set shows its name', async () => {
    const user = userEvent.setup()
    const option = await screen.findByRole('option', { name: '既存種目' })
    const selects = screen.getAllByRole('combobox')
    const exerciseSelect = selects.find((select) => within(select).queryByRole('option', { name: '既存種目' }))
    if (!exerciseSelect) throw new Error('exercise select not found')
    await user.selectOptions(exerciseSelect, option as HTMLOptionElement)
    const addBtn = screen.getByRole('button', { name: /セットを追加/ })
    await user.click(addBtn)

    const found = await screen.findAllByText('既存種目')
    expect(found.length).toBeGreaterThan(0)
  })
})
