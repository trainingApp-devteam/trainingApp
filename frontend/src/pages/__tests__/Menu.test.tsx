import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Menu from '../Menu'
import { listRoutines, saveRoutine } from '../../api/routines'

vi.mock('../../api/exercises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/exercises')>()),
  searchExercises: vi.fn(async () => [
    { id: 'e1', name: 'ベンチプレス', group: '胸', calorieEnabled: true, calorieBases: ['REP', 'MINUTE'] },
    { id: 'e2', name: 'スクワット', group: '脚', calorieEnabled: true, calorieBases: ['REP', 'MINUTE'] },
    { id: 'e3', name: 'トレッドミル', group: '有酸素', calorieEnabled: true, calorieBases: ['MINUTE'] },
  ]),
}))

vi.mock('../../api/routines', () => ({
  listRoutines: vi.fn(async () => []),
  saveRoutine: vi.fn(async (routine: any) => ({ id: 'm1', ...routine })),
  deleteRoutine: vi.fn(async () => undefined),
}))

async function openForm() {
  const user = userEvent.setup()
  render(<Menu />)
  await user.click(screen.getByRole('button', { name: '新規作成' }))
  await user.click(await screen.findByRole('button', { name: '胸' }))
  return user
}

describe('Menu page', () => {
  beforeEach(() => {
    vi.mocked(saveRoutine).mockClear()
    vi.mocked(listRoutines).mockResolvedValue([])
  })

  test('has no manual add by ID and no separate set settings', async () => {
    await openForm()

    expect(screen.queryByRole('button', { name: '手動追加' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '候補を追加' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /部位|種目/ })).not.toBeInTheDocument()
  })

  test('picks the body part with a tab and adds an exercise with one tap', async () => {
    const user = await openForm()
    const exercises = screen.getByRole('group', { name: '種目' })

    expect(screen.getByRole('button', { name: '胸' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(exercises).getByRole('button', { name: /ベンチプレス/ })).toBeInTheDocument()
    expect(within(exercises).queryByRole('button', { name: /スクワット/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '脚' }))
    await user.click(within(screen.getByRole('group', { name: '種目' })).getByRole('button', { name: /スクワット/ }))

    expect(screen.getByLabelText('スクワットの回数')).toHaveValue(8)
    expect(screen.queryByLabelText('スクワットの記録形式')).not.toBeInTheDocument()
  })

  test('adds cardio machines by time, fixed because reps cannot be estimated', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: '有酸素' }))
    await user.click(screen.getByRole('button', { name: /トレッドミル/ }))

    expect(screen.getByLabelText('トレッドミルの秒数')).toHaveValue(60)
    expect(screen.queryByLabelText('トレッドミルの回数')).not.toBeInTheDocument()
  })

  test('edits reps, time, and weight in the list and saves them', async () => {
    const user = await openForm()
    await user.type(screen.getByRole('textbox'), '胸の日')
    await user.click(screen.getByRole('button', { name: /ベンチプレス/ }))

    await user.clear(screen.getByLabelText('ベンチプレスの回数'))
    await user.type(screen.getByLabelText('ベンチプレスの回数'), '10')
    await user.type(screen.getByLabelText('ベンチプレスの負荷（kg・任意）'), '60')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(saveRoutine).toHaveBeenCalledWith({
      name: '胸の日',
      exercises: [{ exerciseId: 'e1', exerciseName: 'ベンチプレス', type: 'reps', reps: 10, weight: 60 }],
    }, undefined)
    expect(await screen.findByText('ベンチプレス(10回/60kg)')).toBeInTheDocument()
  })

  test('blocks saving an empty value', async () => {
    const user = await openForm()
    await user.type(screen.getByRole('textbox'), '胸の日')
    await user.click(screen.getByRole('button', { name: /ベンチプレス/ }))

    await user.clear(screen.getByLabelText('ベンチプレスの回数'))
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByRole('alert')).toHaveTextContent('「ベンチプレス」の回数は1以上の整数を入力してください')
    expect(saveRoutine).not.toHaveBeenCalled()
  })

  test('reorders and removes exercises in the list', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: /ベンチプレス/ }))
    await user.click(screen.getByRole('button', { name: '脚' }))
    await user.click(screen.getByRole('button', { name: /スクワット/ }))

    await user.click(screen.getByRole('button', { name: 'スクワットを上へ' }))
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('スクワット')

    await user.click(screen.getByRole('button', { name: 'ベンチプレスを削除' }))
    expect(screen.queryByLabelText('ベンチプレスの回数')).not.toBeInTheDocument()
  })
})
