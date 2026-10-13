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
  calorieEstimateId?: number
  calorieNote?: string
}

export type RecordItem = {
  id: string
  date: string
  exerciseId: string
  sets: SetItem[]
}

type BackendSession = {
  id: number
  trainingDate: string
  exercises: Array<{
    exerciseId: number
    exerciseName: string
    category?: string
    sets: Array<{ reps: number | null; durationSeconds: number | null; weightKg: number | null }>
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
  })))
  return {
    id: String(session.id),
    date: session.trainingDate,
    exerciseId: sets[0]?.exerciseId || '',
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

export async function listRecords(): Promise<RecordItem[]> {
  const page = await apiRequest<SessionPage>('/training-sessions?page=0&size=100')
  return page.content.map(mapSession)
}

export async function getRecord(id: string): Promise<RecordItem> {
  return mapSession(await apiRequest<BackendSession>(`/training-sessions/${encodeURIComponent(id)}`))
}

export async function createRecord(body: Omit<RecordItem, 'id'>): Promise<RecordItem> {
  const grouped = new Map<string, SetItem[]>()
  body.sets.forEach((set) => {
    const exerciseId = set.exerciseId || body.exerciseId
    if (!exerciseId) throw new Error('種目を選択してください')
    grouped.set(exerciseId, [...(grouped.get(exerciseId) || []), set])
  })
  const session = await apiRequest<BackendSession>('/training-sessions', {
    method: 'POST',
    body: JSON.stringify({
      trainingDate: body.date,
      exercises: [...grouped.entries()].map(([exerciseId, sets], index) => ({
        exerciseId: Number(exerciseId),
        displayOrder: index + 1,
        sets: sets.map((set) => ({
          reps: set.type === 'reps' ? set.reps : undefined,
          durationSeconds: set.type === 'time' ? set.timeSeconds : undefined,
          weightKg: set.weight,
        })),
      })),
    }),
  })
  return mapSession(session)
}

export async function deleteRecord(id: string): Promise<void> {
  await apiRequest<void>(`/training-sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
