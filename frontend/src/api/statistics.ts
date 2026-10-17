import { apiRequest } from './client'

export type RecordedExercise = { exerciseId: number; exerciseName: string; category?: string | null; sessionCount: number; lastTrainingDate: string }

export type ProgressPoint = {
  sessionId: number
  trainingDate: string
  maxWeightKg: number | null
  volumeKg: number | null
  totalReps: number
  totalDurationSeconds: number
  setCount: number
  estimatedCaloriesKcal: number | null
}

export type ExerciseProgress = {
  exerciseId: number
  exerciseName: string
  category?: string | null
  points: ProgressPoint[]
}

export function listRecordedExercises(): Promise<RecordedExercise[]> {
  return apiRequest<RecordedExercise[]>('/statistics/exercises')
}

// from は 'YYYY-MM-DD'（ローカル日付）。省略時は全期間
export function getExerciseProgress(exerciseId: number, from?: string | null): Promise<ExerciseProgress> {
  const query = from ? `?from=${encodeURIComponent(from)}` : ''
  return apiRequest<ExerciseProgress>(`/statistics/exercises/${encodeURIComponent(String(exerciseId))}${query}`)
}
