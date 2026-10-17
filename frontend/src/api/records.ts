import { apiRequest } from './client'

export type SetItem = {
  exerciseId?: string
  exerciseName?: string
  exerciseGroup?: string
  calorieEnabled?: boolean
  type: 'reps' | 'time'
  reps?: number
  timeSeconds?: number
  weight?: number
  rpe?: number
  bodyWeightKg?: number
  estimatedCaloriesKcal?: number
  // メニュー作成時に予定のRPEで見積もった値（保存時は実行後のRPEで計算し直す）。nullは推定できない
  plannedCaloriesKcal?: number | null
  calorieEstimateId?: number
  calorieNote?: string
}

export type RecordItem = {
  id: string
  date: string
  exerciseId: string
  note?: string
  sets: SetItem[]
}

type BackendSession = {
  id: number
  trainingDate: string
  note?: string | null
  exercises: Array<{
    exerciseId: number
    exerciseName: string
    category?: string
    sets: Array<{ reps: number | null; durationSeconds: number | null; weightKg: number | null; calorieEstimateId?: number | null; estimatedCaloriesKcal?: number | null; rpe?: number | null }>
  }>
}

type SessionPage = { content: BackendSession[] }

function mapSession(session: BackendSession): RecordItem {
  const sets = session.exercises.flatMap((exercise) => exercise.sets.map((set) => ({
    exerciseId: String(exercise.exerciseId),
    exerciseName: exercise.exerciseName,
    exerciseGroup: exercise.category,
    type: set.reps === null ? 'time' as const : 'reps' as const,
    reps: set.reps ?? undefined,
    timeSeconds: set.durationSeconds ?? undefined,
    weight: set.weightKg ?? undefined,
    calorieEstimateId: set.calorieEstimateId ?? undefined,
    estimatedCaloriesKcal: set.estimatedCaloriesKcal ?? undefined,
    rpe: set.rpe ?? undefined,
  })))
  return {
    id: String(session.id),
    date: session.trainingDate,
    exerciseId: sets[0]?.exerciseId || '',
    note: session.note ?? undefined,
    sets,
  }
}

export type CalorieEstimateRequest = {
  exerciseId: number
  basis: 'REP' | 'MINUTE'
  rpe: number
  bodyWeightKg: number
  externalLoadKg?: number
  reps?: number
  durationSeconds?: number
}

export type CalorieEstimate = {
  estimateId: number
  exerciseId: number
  exerciseCode: string
  basis: 'REP' | 'MINUTE'
  rpe: number
  bodyWeightKg: number
  activeSeconds: number
  metValue: number
  estimatedCaloriesKcal: number
  note: string
}

export async function createCalorieEstimate(body: CalorieEstimateRequest): Promise<CalorieEstimate> {
  return apiRequest<CalorieEstimate>('/calorie-estimates', { method: 'POST', body: JSON.stringify(body) })
}

// メニュー作成時の見積もり（保存時と同じ式。サーバーには保存されない）。推定できないセットはnull
export async function previewCalories(set: SetItem, bodyWeightKg: number | null): Promise<number | null> {
  const weight = set.bodyWeightKg ?? bodyWeightKg
  if (!set.calorieEnabled || !set.exerciseId || !weight) return null
  try {
    const estimate = await apiRequest<CalorieEstimate>('/calorie-estimates/preview', {
      method: 'POST',
      body: JSON.stringify({
        exerciseId: Number(set.exerciseId),
        basis: set.type === 'reps' ? 'REP' : 'MINUTE',
        rpe: set.rpe || 6,
        bodyWeightKg: weight,
        externalLoadKg: set.weight,
        reps: set.type === 'reps' ? set.reps : undefined,
        durationSeconds: set.type === 'time' ? set.timeSeconds : undefined,
      }),
    })
    return Number(estimate.estimatedCaloriesKcal)
  } catch {
    return null
  }
}

export async function listRecords(): Promise<RecordItem[]> {
  const page = await apiRequest<SessionPage>('/training-sessions?page=0&size=100')
  return page.content.map(mapSession)
}

export async function getRecord(id: string): Promise<RecordItem> {
  return mapSession(await apiRequest<BackendSession>(`/training-sessions/${encodeURIComponent(id)}`))
}

function buildSessionBody(body: Omit<RecordItem, 'id'>) {
  const grouped = new Map<string, SetItem[]>()
  body.sets.forEach((set) => {
    const exerciseId = set.exerciseId || body.exerciseId
    if (!exerciseId) throw new Error('種目を選択してください')
    grouped.set(exerciseId, [...(grouped.get(exerciseId) || []), set])
  })
  return JSON.stringify({
    trainingDate: body.date,
    note: body.note,
    exercises: [...grouped.entries()].map(([exerciseId, sets], index) => ({
      exerciseId: Number(exerciseId),
      displayOrder: index + 1,
      sets: sets.map((set) => ({
        reps: set.type === 'reps' ? set.reps : undefined,
        durationSeconds: set.type === 'time' ? set.timeSeconds : undefined,
        weightKg: set.weight,
        calorieEstimateId: set.calorieEstimateId,
      })),
    })),
  })
}

export async function createRecord(body: Omit<RecordItem, 'id'>): Promise<RecordItem> {
  return mapSession(await apiRequest<BackendSession>('/training-sessions', { method: 'POST', body: buildSessionBody(body) }))
}

export async function updateRecord(id: string, body: Omit<RecordItem, 'id'>): Promise<RecordItem> {
  return mapSession(await apiRequest<BackendSession>(`/training-sessions/${encodeURIComponent(id)}`, { method: 'PUT', body: buildSessionBody(body) }))
}

export async function deleteRecord(id: string): Promise<void> {
  await apiRequest<void>(`/training-sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// 推定対象のセットだけ消費カロリーを推定する。推定済みのセットはそのまま。
// 推定に失敗したセットは未計算のまま返し、記録の保存自体は止めない
export async function withCalorieEstimates(sets: SetItem[], bodyWeightKg: number | null): Promise<SetItem[]> {
  return Promise.all(sets.map(async (set) => {
    const weight = set.bodyWeightKg ?? bodyWeightKg
    if (set.calorieEstimateId !== undefined || !set.calorieEnabled || !set.exerciseId || !weight) return set
    try {
      const estimate = await createCalorieEstimate({
        exerciseId: Number(set.exerciseId),
        basis: set.type === 'reps' ? 'REP' : 'MINUTE',
        rpe: set.rpe || 6,
        bodyWeightKg: weight,
        externalLoadKg: set.weight,
        reps: set.type === 'reps' ? set.reps : undefined,
        durationSeconds: set.type === 'time' ? set.timeSeconds : undefined,
      })
      return {
        ...set,
        estimatedCaloriesKcal: estimate.estimatedCaloriesKcal,
        calorieEstimateId: estimate.estimateId,
        calorieNote: estimate.note,
      }
    } catch {
      return set
    }
  }))
}
