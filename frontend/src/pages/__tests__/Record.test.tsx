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

  test('provides RPE guidance without showing the estimation body weight', async () => {
    localStorage.setItem('trainingapp:authUser', JSON.stringify({ username: 'test-user' }))
    localStorage.setItem('trainingApp.accountProfile:test-user', JSON.stringify({ bodyWeightKg: 63.5 }))
    render(<MemoryRouter><Record /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: 'RPEの目安' })).toHaveAttribute('aria-describedby', 'rpe-help')
    expect(screen.getByRole('tooltip')).toHaveTextContent('あと2回')
    expect(screen.queryByText(/推定用体重/)).not.toBeInTheDocument()
    expect(screen.queryByText(/63\.5/)).not.toBeInTheDocument()
  })

  test('separates date, set entry, the set list, and run controls into their own sections', async () => {
    render(<MemoryRouter><Record /></MemoryRouter>)
    await screen.findByRole('option', { name: '既存種目' })

    const date = screen.getByRole('region', { name: '日付' })
    const add = screen.getByRole('form', { name: '種目を選んでセットを追加' })
    const sets = screen.getByRole('region', { name: '作成中のセット' })
    const run = screen.getByRole('region', { name: '実行' })

    expect(within(date).getByLabelText('日付')).toBeInTheDocument()
    expect(within(add).getByRole('button', { name: 'セットを追加' })).toBeInTheDocument()
    expect(within(sets).getByText('まだセットがありません')).toBeInTheDocument()
    expect(within(run).getByRole('button', { name: '実行開始' })).toBeInTheDocument()
    expect(within(run).getByRole('button', { name: 'リセット' })).toBeInTheDocument()
    // each control lives in exactly one section
    expect(within(add).queryByRole('button', { name: '実行開始' })).not.toBeInTheDocument()
    expect(within(sets).queryByRole('button', { name: 'セットを追加' })).not.toBeInTheDocument()
  })

  test('has no way to apply a saved menu on this screen', async () => {
    render(<MemoryRouter><Record /></MemoryRouter>)
    await screen.findByRole('option', { name: '既存種目' })

    expect(screen.queryByRole('button', { name: 'メニューを適用' })).not.toBeInTheDocument()
    expect(screen.queryByText('-- 保存メニューから選択 --')).not.toBeInTheDocument()
  })

  test('reset clears the sets and the list shows what was added', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Record /></MemoryRouter>)
    await screen.findByRole('option', { name: '既存種目' })
    const sets = screen.getByRole('region', { name: '作成中のセット' })

    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    expect(within(sets).getByText('既存種目')).toBeInTheDocument()
    expect(within(sets).queryByText('まだセットがありません')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'リセット' }))
    expect(within(sets).getByText('まだセットがありません')).toBeInTheDocument()
  })

  test('shows a validation error inside the run section when starting with no sets', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Record /></MemoryRouter>)
    await screen.findByRole('option', { name: '既存種目' })

    await user.click(screen.getByRole('button', { name: '実行開始' }))

    expect(within(screen.getByRole('region', { name: '実行' })).getByRole('alert')).toHaveTextContent('少なくとも1つのセットを追加してください')
  })
})