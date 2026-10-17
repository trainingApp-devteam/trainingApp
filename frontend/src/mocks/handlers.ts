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
  // 標準種目はすべて推定対象。有酸素マシンは時間のみ
  calorieEnabled: true,
  calorieBases: category === '有酸素' ? ['MINUTE'] : ['REP', 'MINUTE'],
}))

let nextEstimateId = 1
const estimates = new Map<number, { kcal: number; rpe: number }>()
let sessions: Array<Record<string, any>> = []
let measurements: Array<Record<string, any>> = []
let routines: Array<Record<string, any>> = []
let nextId = 1
let account: Record<string, any> = { id: 1, username: 'demo', displayName: 'デモユーザー', role: 'USER', heightCm: null }

function sessionResponse(session: Record<string, any>) {
  return {
    ...session,
    exercises: (session.exercises || []).map((exercise: Record<string, any>) => ({
      ...exercise,
      exerciseName: exercises.find((item) => item.id === exercise.exerciseId)?.name,
      category: exercises.find((item) => item.id === exercise.exerciseId)?.category,
      sets: (exercise.sets || []).map((set: Record<string, any>) => ({
        ...set,
        estimatedCaloriesKcal: set.calorieEstimateId ? estimates.get(set.calorieEstimateId)?.kcal ?? null : null,
        rpe: set.calorieEstimateId ? estimates.get(set.calorieEstimateId)?.rpe ?? null : null,
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
  rest.patch('/api/v1/auth/me', async (req, res, ctx) => {
    const body = await req.json()
    account = { ...account, ...body }
    return res(ctx.json(account))
  }),
  rest.put('/api/v1/auth/me/password', (_req, res, ctx) => res(ctx.status(204))),
  rest.post('/api/v1/auth/logout', (_req, res, ctx) => res(ctx.status(204))),
  rest.post('/api/v1/invitations/accept', (_req, res, ctx) => res(ctx.status(201), ctx.json({ status: 'PENDING_APPROVAL' }))),

  rest.get('/api/v1/exercises', (req, res, ctx) => {
    const query = req.url.searchParams.get('q')?.toLowerCase() || ''
    const category = req.url.searchParams.get('category') || ''
    const result = exercises.filter((exercise) => (!query || exercise.name.toLowerCase().includes(query)) && (!category || exercise.category === category))
    return res(ctx.json(result))
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
    if (!exercise?.calorieEnabled || !exercise.calorieBases.includes(body.basis)) return res(ctx.status(422), ctx.json({ message: 'この種目では消費カロリーを推定できません。' }))
    const activeSeconds = body.basis === 'REP' ? body.reps * 3 : body.durationSeconds
    const metValue = body.rpe >= 7 ? 6 : 3.5
    const estimatedCaloriesKcal = Math.round(metValue * 3.5 * body.bodyWeightKg / 200 * activeSeconds / 60 * 100) / 100
    const estimateId = nextEstimateId++
    estimates.set(estimateId, { kcal: estimatedCaloriesKcal, rpe: body.rpe })
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
  rest.get('/api/v1/statistics/exercises', (_req, res, ctx) => {
    const byExercise = new Map<number, { count: number; last: string }>()
    sessions.forEach((session) => (session.exercises || []).forEach((exercise: Record<string, any>) => {
      const current = byExercise.get(exercise.exerciseId) || { count: 0, last: '' }
      byExercise.set(exercise.exerciseId, { count: current.count + 1, last: session.trainingDate > current.last ? session.trainingDate : current.last })
    }))
    return res(ctx.json([...byExercise.entries()].map(([id, value]) => {
      const exercise = exercises.find((item) => item.id === id)
      return { exerciseId: id, exerciseName: exercise?.name, category: exercise?.category, sessionCount: value.count, lastTrainingDate: value.last }
    }).sort((a, b) => b.lastTrainingDate.localeCompare(a.lastTrainingDate))))
  }),
  rest.get('/api/v1/statistics/exercises/:id', (req, res, ctx) => {
    const id = Number(req.params.id)
    const from = req.url.searchParams.get('from') || ''
    const exercise = exercises.find((item) => item.id === id)
    if (!exercise) return res(ctx.status(404), ctx.json({ message: '対象のデータが見つかりません。' }))
    const points = sessions
      .filter((session) => session.trainingDate >= from)
      .flatMap((session) => (session.exercises || [])
        .filter((item: Record<string, any>) => item.exerciseId === id)
        .map((item: Record<string, any>) => {
          const sets: Array<Record<string, any>> = item.sets || []
          const weights = sets.map((set) => set.weightKg).filter((w) => w != null)
          const volumeSets = sets.filter((set) => set.reps && set.weightKg != null)
          return {
            sessionId: session.id,
            trainingDate: session.trainingDate,
            maxWeightKg: weights.length ? Math.max(...weights) : null,
            volumeKg: volumeSets.length ? volumeSets.reduce((sum, set) => sum + set.weightKg * set.reps, 0) : null,
            totalReps: sets.reduce((sum, set) => sum + (set.reps || 0), 0),
            totalDurationSeconds: sets.reduce((sum, set) => sum + (set.durationSeconds || 0), 0),
            setCount: sets.length,
            estimatedCaloriesKcal: null,
          }
        }))
      .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate))
    return res(ctx.json({ exerciseId: id, exerciseName: exercise.name, category: exercise.category, points }))
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