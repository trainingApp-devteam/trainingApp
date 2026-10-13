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

export type CalorieEstimateRequest = {
  exerciseCode: string
  basis: 'REP' | 'MINUTE'
  rpe: number
  bodyWeightKg: number
  externalLoadKg?: number
  reps?: number
  durationSeconds?: number
}

export type CalorieEstimate = {
  estimateId: number
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
  const res = await fetch('/api/calorie-estimates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('消費カロリーの推定に失敗しました')
  return res.json()
}

export async function listRecords(): Promise<RecordItem[]> {
  const res = await fetch('/api/records')
  if (!res.ok) throw new Error('Failed to fetch records')
  return res.json()
}

export async function getRecord(id: string): Promise<RecordItem> {
  const res = await fetch(`/api/records/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export async function createRecord(body: Omit<RecordItem, 'id'>): Promise<RecordItem> {
  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to create')
  return res.json()
}

export async function deleteRecord(id: string): Promise<void> {
  const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete')
}
