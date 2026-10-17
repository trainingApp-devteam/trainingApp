import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Record from '../Record'
import { getLatestBodyWeight } from '../../api/bodyMeasurements'
import { MemoryRouter } from 'react-router-dom'
import { createRecord } from '../../api/records'

vi.mock('../../api/exercises', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('../../api/exercises')>()),
    searchExercises: vi.fn(async (q = '', category?: string) => {
      return [ { id: 'e1', name: '既存種目', group: category || 'その他' } ]
    }),
    listExerciseGroups: vi.fn(async () => [ { id: 'その他', name: 'その他' } ]),
  }
})

vi.mock('../../api/records', () => ({
  createRecord: vi.fn(async () => ({ id: 'r1' })),
  withCalorieEstimates: vi.fn(async (sets: unknown[]) => sets),
}))
vi.mock('../../api/bodyMeasurements', () => ({ getLatestBodyWeight: vi.fn(async () => null) }))

describe('Record page', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getLatestBodyWeight).mockReset().mockResolvedValue(null)
    vi.mocked(createRecord).mockClear()
  })

  test('renders the part and exercise selects', async () => {
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
    vi.mocked(getLatestBodyWeight).mockResolvedValue(63.5)
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

  test('asks for a body measurement when a calorie-capable exercise is added without a registered weight', async () => {
    const user = userEvent.setup()
    vi.mocked(getLatestBodyWeight).mockResolvedValue(null)
    const exercises = await import('../../api/exercises')
    vi.mocked(exercises.searchExercises).mockImplementation((async () => [{ id: 'e2', name: 'ベンチプレス', group: '胸', calorieEnabled: true, calorieBases: ['REP', 'MINUTE'] }]) as any)
    try {
      render(<MemoryRouter><Record /></MemoryRouter>)
      await screen.findByRole('option', { name: 'ベンチプレス' })

      await user.click(screen.getByRole('button', { name: 'セットを追加' }))

      expect(await screen.findByText('消費カロリーを推定するには、身体測定で体重を登録してください')).toBeInTheDocument()
    } finally {
      vi.mocked(exercises.searchExercises).mockImplementation((async (_q = '', category?: string) => [{ id: 'e1', name: '既存種目', group: category || 'その他' }]) as any)
    }
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

  test('records cardio machines by time only, because reps cannot be estimated', async () => {
    const exercises = await import('../../api/exercises')
    vi.mocked(exercises.searchExercises).mockImplementation((async () => [{ id: 'e3', name: 'トレッドミル', group: '有酸素', calorieEnabled: true, calorieBases: ['MINUTE'] }]) as any)
    try {
      render(<MemoryRouter><Record /></MemoryRouter>)
      await screen.findByRole('option', { name: 'トレッドミル' })

      expect(screen.getByRole('radio', { name: '回数' })).toBeDisabled()
      expect(screen.getByRole('radio', { name: '時間' })).toBeChecked()
      expect(screen.getByText('この種目は消費カロリーを推定するため、時間で記録します。')).toBeInTheDocument()
    } finally {
      vi.mocked(exercises.searchExercises).mockImplementation((async (_q = '', category?: string) => [{ id: 'e1', name: '既存種目', group: category || 'その他' }]) as any)
    }
  })

  test('offers both ways to proceed, defaulting to building all sets first', async () => {
    render(<MemoryRouter><Record /></MemoryRouter>)
    const flow = await screen.findByRole('region', { name: '進め方' })

    expect(within(flow).getByRole('radio', { name: '全種目のセットを組んでまとめて実行' })).toBeChecked()
    expect(within(flow).getByRole('radio', { name: '1種目ずつ設定して実行' })).not.toBeChecked()
  })

  test('runs one exercise at a time, then lets the user set the next one and save everything', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Record /></MemoryRouter>)
    await screen.findByRole('option', { name: '既存種目' })

    await user.click(screen.getByRole('radio', { name: '1種目ずつ設定して実行' }))
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    // the way to proceed cannot change while sets exist
    expect(screen.getByRole('radio', { name: '全種目のセットを組んでまとめて実行' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
    expect(screen.getByText('1種目目・現在のセット')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '次のメニューへ' }))
    await user.click(screen.getByRole('button', { name: 'この種目を完了' }))

    // back to setting up the next exercise, nothing saved yet
    expect(createRecord).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('「既存種目」が完了しました')
    const done = screen.getByRole('region', { name: '完了した種目' })
    expect(within(done).getByText('1. 既存種目（2セット）')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: '次の種目を選んでセットを追加' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '作成中のセット' })).getByText('まだセットがありません')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '完了して記録' }))

    expect(createRecord).toHaveBeenCalledTimes(1)
    const body = vi.mocked(createRecord).mock.calls[0][0]
    expect(body.sets).toHaveLength(2)
    expect(body.sets[0]).toMatchObject({ exerciseId: 'e1', type: 'reps', reps: 8 })
  })

  test('keeps the completed exercises when the next exercise is stopped midway', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Record /></MemoryRouter>)
    await screen.findByRole('option', { name: '既存種目' })

    await user.click(screen.getByRole('radio', { name: '1種目ずつ設定して実行' }))
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
    await user.click(screen.getByRole('button', { name: 'この種目を完了' }))

    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
    expect(screen.getByText('2種目目・現在のセット')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '中止' }))

    expect(within(screen.getByRole('region', { name: '完了した種目' })).getByText('1. 既存種目（1セット）')).toBeInTheDocument()
    expect(screen.getByText('「完了して記録」では、実行を終えた種目だけを保存します。')).toBeInTheDocument()
  })
})
