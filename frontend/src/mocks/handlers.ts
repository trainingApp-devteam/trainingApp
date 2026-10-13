import { rest } from 'msw'

<<<<<<< HEAD
const exercises = [
  ['トレッドミル', '有酸素'], ['アップライトバイク', '有酸素'], ['リカンベントバイク', '有酸素'],
  ['クロストレーナー', '有酸素'], ['チェストプレス', '胸'], ['ベンチプレス', '胸'],
  ['ラットプルダウン', '背中'], ['バックエクステンション', '背中'], ['オーバーヘッドプレス', '肩'],
  ['レッグエクステンション', '脚'], ['レッグカール', '脚'], ['レッグプレス', '脚'],
  ['スクワット', '脚'], ['アブドミナル', '腹'], ['腹筋台', '腹'], ['ダンベル', 'フリーウェイト'],
  ['スミスマシン', 'フリーウェイト'], ['パワーラック', 'フリーウェイト'],
].map(([name, category], index) => ({ id: index + 1, name, category, shared: true }))
=======
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
>>>>>>> 3dd71bc16ad53b976676a283f5be393cace8c33a

let nextExerciseId = exercises.length + 1
let sessions: Array<Record<string, any>> = []
let measurements: Array<Record<string, any>> = []
let routines: Array<Record<string, any>> = []
let nextId = 1
let account = { id: 1, username: 'demo', displayName: 'デモユーザー', role: 'USER' }

function routineResponse(routine: Record<string, any>) {
  return {
    ...routine,
    exercises: routine.exerciseIds.map((id: number) => exercises.find((exercise) => exercise.id === id)),
    exerciseTargets: routine.exerciseTargets.map((target: Record<string, any>) => ({
      ...target,
      exerciseName: exercises.find((exercise) => exercise.id === target.exerciseId)?.name,
    })),
  }
}

export const handlers = [
  rest.get('/api/v1/auth/csrf', (_req, res, ctx) => res(ctx.status(204), ctx.cookie('XSRF-TOKEN', 'mock-token'))),
  rest.get('/api/v1/auth/me', (_req, res, ctx) => res(ctx.json(account))),
  rest.post('/api/v1/auth/login', async (req, res, ctx) => {
    const body = await req.json()
    account = { ...account, username: body.username, displayName: body.username }
    return res(ctx.json(account))
  }),
  rest.post('/api/v1/auth/logout', (_req, res, ctx) => res(ctx.status(204))),
  rest.post('/api/v1/invitations/accept', (_req, res, ctx) => res(ctx.status(201), ctx.json({ status: 'PENDING_APPROVAL' }))),

  rest.get('/api/v1/exercises', (req, res, ctx) => {
    const query = req.url.searchParams.get('q')?.toLowerCase() || ''
    const category = req.url.searchParams.get('category') || ''
    const result = exercises.filter((exercise) => (!query || exercise.name.toLowerCase().includes(query)) && (!category || exercise.category === category))
    return res(ctx.json(result))
  }),
  rest.post('/api/v1/exercises', async (req, res, ctx) => {
    const body = await req.json()
    const exercise = { id: nextExerciseId++, name: body.name, category: body.category || null, shared: false }
    exercises.push(exercise)
    return res(ctx.status(201), ctx.json(exercise))
  }),
  rest.put('/api/v1/exercises/:id', async (req, res, ctx) => {
    const exercise = exercises.find((item) => item.id === Number(req.params.id))
    if (!exercise) return res(ctx.status(404))
    Object.assign(exercise, await req.json())
    return res(ctx.json(exercise))
  }),
  rest.delete('/api/v1/exercises/:id', (req, res, ctx) => {
    const index = exercises.findIndex((item) => item.id === Number(req.params.id))
    if (index < 0) return res(ctx.status(404))
    exercises.splice(index, 1)
    return res(ctx.status(204))
  }),

  rest.get('/api/v1/training-sessions', (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page') || 0)
    const size = Number(req.url.searchParams.get('size') || 20)
    const start = page * size
    return res(ctx.json({ content: sessions.slice(start, start + size), page, size, totalElements: sessions.length, totalPages: Math.ceil(sessions.length / size) }))
  }),
  rest.post('/api/v1/training-sessions', async (req, res, ctx) => {
    const body = await req.json()
    const session = { ...body, id: nextId++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    sessions.unshift(session)
    return res(ctx.status(201), ctx.json(session))
  }),
  rest.get('/api/v1/training-sessions/:id', (req, res, ctx) => {
    const session = sessions.find((item) => item.id === Number(req.params.id))
    return session ? res(ctx.json(session)) : res(ctx.status(404))
  }),
  rest.put('/api/v1/training-sessions/:id', async (req, res, ctx) => {
    const index = sessions.findIndex((item) => item.id === Number(req.params.id))
    if (index < 0) return res(ctx.status(404))
    sessions[index] = { ...sessions[index], ...await req.json(), updatedAt: new Date().toISOString() }
    return res(ctx.json(sessions[index]))
  }),
  rest.delete('/api/v1/training-sessions/:id', (req, res, ctx) => {
    sessions = sessions.filter((item) => item.id !== Number(req.params.id))
    return res(ctx.status(204))
  }),

<<<<<<< HEAD
  rest.get('/api/v1/body-measurements', (req, res, ctx) => {
    const code = req.url.searchParams.get('measurementTypeCode')
    const content = code ? measurements.filter((item) => item.measurementTypeCode === code) : measurements
    return res(ctx.json({ content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 }))
  }),
  rest.post('/api/v1/body-measurements', async (req, res, ctx) => {
    const body = await req.json()
    const names: Record<string, [string, string]> = { height_cm: ['身長', 'cm'], weight_kg: ['体重', 'kg'], body_fat_pct: ['体脂肪率', '%'] }
    const [name, unit] = names[body.measurementTypeCode] || ['', '']
    const measurement = { ...body, id: nextId++, name, unit }
    measurements.unshift(measurement)
    return res(ctx.status(201), ctx.json(measurement))
  }),
  rest.put('/api/v1/body-measurements/:id', async (req, res, ctx) => {
    const index = measurements.findIndex((item) => item.id === Number(req.params.id))
    if (index < 0) return res(ctx.status(404))
    measurements[index] = { ...measurements[index], ...await req.json() }
    return res(ctx.json(measurements[index]))
  }),
  rest.delete('/api/v1/body-measurements/:id', (req, res, ctx) => {
    measurements = measurements.filter((item) => item.id !== Number(req.params.id))
    return res(ctx.status(204))
=======
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
>>>>>>> 3dd71bc16ad53b976676a283f5be393cace8c33a
  }),

  rest.get('/api/v1/routines', (_req, res, ctx) => res(ctx.json(routines.map(routineResponse)))),
  rest.post('/api/v1/routines', async (req, res, ctx) => {
    const routine = { ...await req.json(), id: nextId++ }
    routines.unshift(routine)
    return res(ctx.status(201), ctx.json(routineResponse(routine)))
  }),
  rest.get('/api/v1/routines/:id', (req, res, ctx) => {
    const routine = routines.find((item) => item.id === Number(req.params.id))
    return routine ? res(ctx.json(routineResponse(routine))) : res(ctx.status(404))
  }),
  rest.put('/api/v1/routines/:id', async (req, res, ctx) => {
    const index = routines.findIndex((item) => item.id === Number(req.params.id))
    if (index < 0) return res(ctx.status(404))
    routines[index] = { ...await req.json(), id: routines[index].id }
    return res(ctx.json(routineResponse(routines[index])))
  }),
  rest.delete('/api/v1/routines/:id', (req, res, ctx) => {
    routines = routines.filter((item) => item.id !== Number(req.params.id))
    return res(ctx.status(204))
  }),
]

export default handlers