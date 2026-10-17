import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Record from '../Record'
import { getLatestBodyWeight } from '../../api/bodyMeasurements'
import { MemoryRouter } from 'react-router-dom'
import { createRecord } from '../../api/records'
import { listRoutines } from '../../api/routines'

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
vi.mock('../../api/routines', () => ({ listRoutines: vi.fn(async () => []) }))
vi.mock('../../api/bodyMeasurements', () => ({ getLatestBodyWeight: vi.fn(async () => null) }))
// 音楽プレーヤーはYouTubeを読み込むため、受け取った値だけを表示する代わりの部品にする
vi.mock('../../components/MusicPlayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/MusicPlayer')>()),
  default: ({ playlistId, suspended }: { playlistId: string; suspended?: boolean }) => (
    <section aria-label="音楽">{playlistId}{suspended ? '（一時停止）' : ''}</section>
  ),
}))

async function renderRecord(entry = '/record') {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[entry]}><Record /></MemoryRouter>)
  await screen.findByRole('option', { name: '既存種目' })
  return user
}

async function openPlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^作成中のセット/ }))
  return screen.getByRole('dialog', { name: '作成中のセット' })
}

describe('Record page', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getLatestBodyWeight).mockReset().mockResolvedValue(null)
    vi.mocked(createRecord).mockClear()
  })

  test('keeps the menu creation compact: one form, a small date field, and no flow or section headings', async () => {
    await renderRecord()

    const form = screen.getByRole('form', { name: 'メニュー作成' })
    expect(screen.getByLabelText('日付')).not.toHaveClass('w-full')
    expect(within(form).getByRole('combobox', { name: '部位' })).toBeInTheDocument()
    expect(within(form).getByRole('combobox', { name: '種目' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'セットを追加' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: '実行開始' })).toBeInTheDocument()
    expect(screen.queryByText(/進め方/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '種目を選んでセットを追加' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    // the set list lives in a dialog, and music is not shown while creating the menu
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '音楽を再生' })).not.toBeInTheDocument()
  })

  test('adds the selected exercise and shows the sets in a dialog', async () => {
    const user = await renderRecord()
    await user.clear(screen.getByLabelText('回数'))
    await user.type(screen.getByLabelText('回数'), '10')
    await user.type(screen.getByLabelText('負荷（kg・任意）'), '40')
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))

    expect(screen.getByRole('button', { name: '作成中のセット（2）' })).toBeInTheDocument()
    expect(screen.getByText('既存種目×2')).toBeInTheDocument()

    const dialog = await openPlan(user)
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2)
    expect(within(dialog).getAllByText('10 回 · 40 kg · RPE 6 · kcal対象外')).toHaveLength(2)

    await user.click(within(dialog).getByRole('button', { name: 'セット1を削除' }))
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '作成中のセット（1）' })).toBeInTheDocument()
  })

  test('clears all sets from the dialog', async () => {
    const user = await renderRecord()
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    const dialog = await openPlan(user)

    await user.click(within(dialog).getByRole('button', { name: 'すべて削除' }))

    expect(within(dialog).getByText('まだセットがありません')).toBeInTheDocument()
  })

  test('switches between reps and time with a unit select instead of radio buttons', async () => {
    const user = await renderRecord()

    expect(screen.getByLabelText('記録形式')).toHaveValue('reps')
    await user.selectOptions(screen.getByLabelText('記録形式'), 'time')
    expect(screen.getByLabelText('秒数')).toHaveValue(60)
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))

    expect(within(await openPlan(user)).getByText(/^60 秒/)).toBeInTheDocument()
  })

  test('provides RPE guidance without showing the estimation body weight', async () => {
    vi.mocked(getLatestBodyWeight).mockResolvedValue(63.5)
    render(<MemoryRouter><Record /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: 'RPEの目安' })).toHaveAttribute('aria-describedby', 'rpe-help')
    expect(screen.getByRole('tooltip')).toHaveTextContent('あと2回')
    expect(screen.queryByText(/推定用体重/)).not.toBeInTheDocument()
    expect(screen.queryByText(/63\.5/)).not.toBeInTheDocument()
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
    await renderRecord()

    expect(screen.queryByRole('button', { name: 'メニューを適用' })).not.toBeInTheDocument()
    expect(screen.queryByText('-- 保存メニューから選択 --')).not.toBeInTheDocument()
  })

  test('shows a validation error when starting with no sets', async () => {
    const user = await renderRecord()

    await user.click(screen.getByRole('button', { name: '実行開始' }))

    expect(screen.getByRole('alert')).toHaveTextContent('少なくとも1つのセットを追加してください')
  })

  test('records cardio machines by time only, because reps cannot be estimated', async () => {
    const exercises = await import('../../api/exercises')
    vi.mocked(exercises.searchExercises).mockImplementation((async () => [{ id: 'e3', name: 'トレッドミル', group: '有酸素', calorieEnabled: true, calorieBases: ['MINUTE'] }]) as any)
    try {
      render(<MemoryRouter><Record /></MemoryRouter>)
      await screen.findByRole('option', { name: 'トレッドミル' })

      expect(await screen.findByLabelText('秒数')).toBeInTheDocument()
      expect(screen.getByLabelText('記録形式')).toHaveValue('time')
      expect(screen.getByLabelText('記録形式')).toBeDisabled()
      expect(screen.getByText('この種目は消費カロリーを推定するため、時間で記録します。')).toBeInTheDocument()
    } finally {
      vi.mocked(exercises.searchExercises).mockImplementation((async (_q = '', category?: string) => [{ id: 'e1', name: '既存種目', group: category || 'その他' }]) as any)
    }
  })

  test('plays the entered playlist only after the run starts, and remembers the URL', async () => {
    const user = await renderRecord()
    const url = 'https://www.youtube.com/playlist?list=PLabcdefghij123'
    await user.type(screen.getByLabelText(/実行時に流すプレイリスト/), url)
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    expect(screen.queryByRole('region', { name: '音楽' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '実行開始' }))

    expect(screen.getByRole('heading', { name: 'メニュー実行' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '音楽' })).toHaveTextContent('PLabcdefghij123')
    expect(localStorage.getItem('trainingApp.playlistUrl')).toBe(url)
  })

  test('does not start with a playlist URL it cannot read, and plays nothing without one', async () => {
    const user = await renderRecord()
    await user.type(screen.getByLabelText(/実行時に流すプレイリスト/), 'https://example.com/music')
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: '実行開始' }))

    expect(screen.getByRole('alert')).toHaveTextContent('プレイリストのURLを確認してください')
    expect(screen.getByRole('heading', { name: 'メニュー作成' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/実行時に流すプレイリスト/))
    await user.click(screen.getByRole('button', { name: '実行開始' }))
    expect(screen.getByRole('heading', { name: 'メニュー実行' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '音楽' })).not.toBeInTheDocument()
  })

  test('runs one exercise at a time, then lets the user set the next one and save everything', async () => {
    const user = await renderRecord('/record?flow=step')

    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))

    await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
    expect(screen.getByText('1種目目・現在のセット')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '次のメニューへ' }))
    await user.click(screen.getByRole('button', { name: 'この種目を完了' }))

    // back to setting up the next exercise, nothing saved yet
    expect(createRecord).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('「既存種目」が完了しました')
    expect(screen.getByRole('region', { name: '完了した種目' })).toHaveTextContent('1. 既存種目（2セット）')
    expect(screen.getByRole('button', { name: '作成中のセット（0）' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '完了して記録' }))

    expect(createRecord).toHaveBeenCalledTimes(1)
    const body = vi.mocked(createRecord).mock.calls[0][0]
    expect(body.sets).toHaveLength(2)
    expect(body.sets[0]).toMatchObject({ exerciseId: 'e1', type: 'reps', reps: 8 })
  })

  test('keeps the completed exercises when the next exercise is stopped midway', async () => {
    const user = await renderRecord('/record?flow=step')

    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
    await user.click(screen.getByRole('button', { name: 'この種目を完了' }))

    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
    expect(screen.getByText('2種目目・現在のセット')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '中止' }))

    expect(screen.getByRole('region', { name: '完了した種目' })).toHaveTextContent('1. 既存種目（1セット）')
    expect(screen.getByText('「完了して記録」では、実行を終えた種目だけを保存します。')).toBeInTheDocument()
  })

  test('pauses the music while the next exercise is set up, then resumes it', async () => {
    localStorage.setItem('trainingApp.playlistUrl', 'PLabcdefghij123')
    const user = await renderRecord('/record?flow=step')
    expect(screen.getByLabelText(/実行時に流すプレイリスト/)).toHaveValue('PLabcdefghij123')

    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
    expect(screen.getByRole('region', { name: '音楽' })).not.toHaveTextContent('一時停止')
    await user.click(screen.getByRole('button', { name: 'この種目を完了' }))

    // hidden and paused, not removed, while creating the next exercise
    expect(screen.getByText(/PLabcdefghij123（一時停止）/).closest('div')).toHaveClass('hidden')
    await user.click(screen.getByRole('button', { name: 'セットを追加' }))
    await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
    expect(screen.getByRole('region', { name: '音楽' })).not.toHaveTextContent('一時停止')
  })

  test('runs a saved menu one exercise at a time when that way was chosen', async () => {
    const user = userEvent.setup()
    vi.mocked(listRoutines).mockResolvedValueOnce([{ id: 'm1', name: '胸の日', exercises: [
      { exerciseId: 'e1', exerciseName: '既存種目', type: 'reps', reps: 10 },
      { exerciseId: 'e1', exerciseName: '既存種目', type: 'reps', reps: 8 },
      { exerciseId: 'e9', exerciseName: 'プランク', type: 'time', timeSeconds: 30 },
    ] }])
    window.history.pushState({}, '', '/record?menuId=m1&autoStart=1&flow=step')
    try {
      render(<MemoryRouter initialEntries={['/record?menuId=m1&autoStart=1&flow=step']}><Record /></MemoryRouter>)

      // starts with the first exercise only
      expect(await screen.findByText('1種目目・現在のセット')).toBeInTheDocument()
      expect(screen.getByText('1/2')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '次のメニューへ' }))
      await user.click(screen.getByRole('button', { name: 'この種目を完了' }))

      // the next exercise of the menu is ready to run
      expect(screen.getByRole('status')).toHaveTextContent('次は「プランク」です')
      expect(within(await openPlan(user)).getByText('プランク')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '閉じる' }))
      await user.click(screen.getByRole('button', { name: 'この種目を実行' }))
      expect(screen.getByText('2種目目・現在のセット')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'この種目を完了' }))
      await user.click(screen.getByRole('button', { name: '完了して記録' }))

      expect(vi.mocked(createRecord).mock.calls[0][0].sets).toHaveLength(3)
    } finally {
      window.history.pushState({}, '', '/')
    }
  })
})
