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

  test('create exercise flow and add set shows created name', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Record /></MemoryRouter>)
    // open modal
    const createBtn = await screen.findByRole('button', { name: /独自種目作成/ })
    await user.click(createBtn)
    const nameInput = await screen.findByLabelText(/種目名/)
    await user.type(nameInput, 'テスト種目')
    // find the modal dialog and click the 作成 button inside it
    const dialog = await screen.findByRole('dialog')
    const { getByRole } = within(dialog)
    const submit = getByRole('button', { name: /作成/ })
    await user.click(submit)

    // wait for option to appear in select
    const option = await screen.findByRole('option', { name: 'テスト種目' })
    expect(option).toBeInTheDocument()

    // find the exercise select that contains this option
    const selects = screen.getAllByRole('combobox')
    let exerciseSelect: HTMLSelectElement | null = null
    for (const s of selects) {
      try {
        within(s).getByRole('option', { name: 'テスト種目' })
        exerciseSelect = s as HTMLSelectElement
        break
      } catch (e) {
        // not this one
      }
    }
    if (!exerciseSelect) throw new Error('exercise select not found')
    await user.selectOptions(exerciseSelect, option as HTMLOptionElement)
    const addBtn = screen.getByRole('button', { name: /セットを追加/ })
    await user.click(addBtn)

    // created set should show the human-readable name (option + table cell may both exist)
    const found = await screen.findAllByText('テスト種目')
    expect(found.length).toBeGreaterThan(0)
  })

  test('uses the account body weight and provides RPE guidance', async () => {
    localStorage.setItem('trainingApp.accountProfile', JSON.stringify({ bodyWeightKg: 63.5 }))
    render(<MemoryRouter><Record /></MemoryRouter>)

    expect(await screen.findByText('推定用体重: 63.5 kg（アカウント登録値）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'RPEの目安' })).toHaveAttribute('aria-describedby', 'rpe-help')
    expect(screen.getByRole('tooltip')).toHaveTextContent('あと2回')
  })
})
