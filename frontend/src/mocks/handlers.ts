import { rest } from 'msw'

const exercises = [
  ['トレッドミル', '有酸素'], ['アップライトバイク', '有酸素'], ['リカンベントバイク', '有酸素'],
  ['クロストレーナー', '有酸素'], ['チェストプレス', '胸'], ['ベンチプレス', '胸'],
  ['ラットプルダウン', '背中'], ['バックエクステンション', '背中'], ['オーバーヘッドプレス', '肩'],
  ['レッグエクステンション', '脚'], ['レッグカール', '脚'], ['レッグプレス', '脚'],
  ['スクワット', '脚'], ['アブドミナル', '腹'], ['腹筋台', '腹'], ['ダンベル', 'フリーウェイト'],
  ['スミスマシン', 'フリーウェイト'], ['パワーラック', 'フリーウェイト'],
].map(([name, category], index) => ({
  id: index + 1,
  name,
  category,
  shared: true,
  calorieEnabled: !['ダンベル', 'スミスマシン', 'パワーラック', 'スクワット'].includes(name),
}))

let nextExerciseId = exercises.length + 1
let nextEstimateId = 1
const estimates = new Map<number, number>()
let sessions: Array<Record<string, any>> = []
let measurements: Array<Record<string, any>> = []
let routines: Array<Record<string, any>> = []
let nextId = 1
let account: Record<string, any> = { id: 1, username: 'demo', displayName: 'デモユーザー', role: 'USER', bodyWeightKg: null }

function sessionResponse(session: Record<string, any>) {
  return {
    ...session,
    exercises: (session.exercises || []).map((exercise: Record<string, any>) => ({
      ...exercise,
      exerciseName: exercises.find((item) => item.id === exercise.exerciseId)?.name,
      category: exercises.find((item) => item.id === exercise.exerciseId)?.category,
      sets: (exercise.sets || []).map((set: Record<string, any>) => ({
        ...set,
        estimatedCaloriesKcal: set.calorieEstimateId ? estimates.get(set.calorieEstimateId) ?? null : null,
      })),
    })),
  }
}

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
  rest.put('/api/v1/auth/me/profile', async (req, res, ctx) => {
    const body = await req.json()
    account = { ...account, bodyWeightKg: body.bodyWeightKg }
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
    const exercise = { id: nextExerciseId++, name: body.name, category: body.category || null, shared: false, calorieEnabled: false }
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
    return res(ctx.json({ content: sessions.slice(start, start + size).map(sessionResponse), page, size, totalElements: sessions.length, totalPages: Math.ceil(sessions.length / size) }))
  }),
  rest.post('/api/v1/training-sessions', async (req, res, ctx) => {
    const body = await req.json()
    const session = { ...body, id: nextId++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    sessions.unshift(session)
    return res(ctx.status(201), ctx.json(sessionResponse(session)))
  }),
  rest.get('/api/v1/training-sessions/:id', (req, res, ctx) => {
    const session = sessions.find((item) => item.id === Number(req.params.id))
    return session ? res(ctx.json(sessionResponse(session))) : res(ctx.status(404))
  }),
  rest.put('/api/v1/training-sessions/:id', async (req, res, ctx) => {
    const index = sessions.findIndex((item) => item.id === Number(req.params.id))
    if (index < 0) return res(ctx.status(404))
    sessions[index] = { ...sessions[index], ...await req.json(), updatedAt: new Date().toISOString() }
    return res(ctx.json(sessionResponse(sessions[index])))
  }),
  rest.delete('/api/v1/training-sessions/:id', (req, res, ctx) => {
    sessions = sessions.filter((item) => item.id !== Number(req.params.id))
    return res(ctx.status(204))
  }),

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
  }),

  rest.post('/api/v1/calorie-estimates', async (req, res, ctx) => {
    const body = await req.json()
    const exercise = exercises.find((item) => item.id === body.exerciseId)
    if (!exercise?.calorieEnabled) return res(ctx.status(422), ctx.json({ message: 'この種目では消費カロリーを推定できません。' }))
    const activeSeconds = body.basis === 'REP' ? body.reps * 3 : body.durationSeconds
    const metValue = body.rpe >= 7 ? 6 : 3.5
    const estimatedCaloriesKcal = Math.round(metValue * 3.5 * body.bodyWeightKg / 200 * activeSeconds / 60 * 100) / 100
    const estimateId = nextEstimateId++
    estimates.set(estimateId, estimatedCaloriesKcal)
    return res(ctx.status(201), ctx.json({
      estimateId,
      exerciseId: body.exerciseId,
      exerciseCode: String(body.exerciseId),
      basis: body.basis,
      rpe: body.rpe,
      bodyWeightKg: body.bodyWeightKg,
      activeSeconds,
      metValue,
      estimatedCaloriesKcal,
      note: '推定値。休憩時間は含みません。動作時間とRPEは概算です。',
    }))
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