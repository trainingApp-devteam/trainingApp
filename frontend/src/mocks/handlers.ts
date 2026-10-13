import { rest } from 'msw'

const sampleExercises = [
  { id: 'treadmill', name: 'トレッドミル', group: '有酸素' },
  { id: 'upright_bike', name: 'アップライトバイク', group: '有酸素' },
  { id: 'recumbent_bike', name: 'リカンベントバイク', group: '有酸素' },
  { id: 'cross_trainer', name: 'クロストレーナー', group: '有酸素' },
  { id: 'chest_press', name: 'チェストプレス', group: '胸' },
  { id: 'lat_pulldown', name: 'ラットプルダウン', group: '背中' },
  { id: 'overhead_press', name: 'オーバーヘッドプレス', group: '肩' },
  { id: 'leg_extension', name: 'レッグエクステンション', group: '脚' },
  { id: 'leg_curl', name: 'レッグカール', group: '脚' },
  { id: 'leg_press', name: 'レッグプレス', group: '脚' },
  { id: 'hip_abduction_adduction', name: 'ヒップアブダクション・アダクション', group: '脚' },
  { id: 'abdominal', name: 'アブドミナル', group: '腹' },
  { id: 'back_extension', name: 'バックエクステンション', group: '背中' },
  { id: 'decline_bench', name: '腹筋台', group: '腹' },
  { id: 'hyperextension_bench', name: '背筋台', group: '背中' },
  { id: 'dumbbell', name: 'ダンベル', group: 'フリーウェイト' },
  { id: 'smith_machine', name: 'スミスマシン', group: 'フリーウェイト' },
  { id: 'bench_press', name: 'ベンチプレス', group: '胸' },
  { id: 'power_rack', name: 'パワーラック', group: 'フリーウェイト' },
  { id: 'dips_chinning', name: 'ディップス・チンニングマシン', group: '背中' },
].map((exercise) => ({
  ...exercise,
  isBuiltin: true,
  calorieEnabled: !['dumbbell', 'smith_machine', 'power_rack'].includes(exercise.id),
}))

let records = [
  {
    id: 'r1',
    date: '2026-09-26',
    exerciseId: 'ex1',
    sets: [{ reps: 8, weight: 60 }],
  },
]

export const handlers = [
  // List records
  rest.get('/api/records', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(records))
  }),

  // Create record
  rest.post('/api/records', async (req, res, ctx) => {
    const body = await req.json()
    const newRec = { id: `r${Date.now()}`, ...body }
    records.push(newRec)
    return res(ctx.status(201), ctx.json(newRec))
  }),

  // Get / Update / Delete by id
  rest.get('/api/records/:id', (req, res, ctx) => {
    const { id } = req.params as { id: string }
    const rec = records.find((r) => r.id === id)
    if (!rec) return res(ctx.status(404))
    return res(ctx.status(200), ctx.json(rec))
  }),

  rest.put('/api/records/:id', async (req, res, ctx) => {
    const { id } = req.params as { id: string }
    const body = await req.json()
    const idx = records.findIndex((r) => r.id === id)
    if (idx === -1) return res(ctx.status(404))
    records[idx] = { ...records[idx], ...body }
    return res(ctx.status(200), ctx.json(records[idx]))
  }),

  rest.delete('/api/records/:id', (req, res, ctx) => {
    const { id } = req.params as { id: string }
    records = records.filter((r) => r.id !== id)
    return res(ctx.status(204))
  }),

  // Exercise search
  rest.get('/api/exercises', (req, res, ctx) => {
    const q = req.url.searchParams.get('q') || ''
    const category = req.url.searchParams.get('category') || ''
    let result = sampleExercises
    if (category) result = result.filter((e) => e.group === category)
    if (q) result = result.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
    return res(ctx.status(200), ctx.json(result))
  }),

  // Create exercise (custom)
  rest.post('/api/exercises', async (req, res, ctx) => {
    try {
      const body = await req.json()
      const raw = String(body.name || '')
      const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      const id = slug ? `${slug}_${Date.now()}` : `ex_${Date.now()}`
      const ex = { id, name: raw, group: body.group || 'その他', isBuiltin: false, calorieEnabled: false }
      sampleExercises.push(ex)
      return res(ctx.status(201), ctx.json(ex))
    } catch (e) {
      return res(ctx.status(400))
    }
  }),

  // Exercise groups
  rest.get('/api/exercise-groups', (req, res, ctx) => {
    const groups = Array.from(new Set(sampleExercises.map((e) => e.group))).map((g) => ({ id: g, name: g }))
    return res(ctx.status(200), ctx.json(groups))
  }),
]

export default handlers
