import { apiRequest } from './client'

export type RoutineExercise = { exerciseId: string; exerciseName?: string; type: 'reps' | 'time'; reps?: number; timeSeconds?: number; weight?: number }
export type Routine = { id: string; name: string; exercises: RoutineExercise[] }
type BackendRoutine = { id: number; name: string; exerciseTargets?: Array<{ exerciseId: number; exerciseName: string; type: 'reps' | 'time'; reps: number | null; durationSeconds: number | null; weightKg: number | null }> }

function mapRoutine(routine: BackendRoutine): Routine {
  return {
    id: String(routine.id),
    name: routine.name,
    exercises: (routine.exerciseTargets || []).map((target) => ({
      exerciseId: String(target.exerciseId),
      exerciseName: target.exerciseName,
      type: target.type,
      reps: target.reps ?? undefined,
      timeSeconds: target.durationSeconds ?? undefined,
      weight: target.weightKg ?? undefined,
    })),
  }
}

export async function listRoutines(): Promise<Routine[]> {
  return (await apiRequest<BackendRoutine[]>('/routines')).map(mapRoutine)
}

export async function saveRoutine(routine: Omit<Routine, 'id'>, id?: string): Promise<Routine> {
  const payload = {
    name: routine.name,
    exerciseIds: routine.exercises.map((exercise) => Number(exercise.exerciseId)),
    exerciseTargets: routine.exercises.map((exercise) => ({
      exerciseId: Number(exercise.exerciseId),
      type: exercise.type,
      reps: exercise.reps,
      durationSeconds: exercise.timeSeconds,
      weightKg: exercise.weight,
    })),
  }
  const saved = await apiRequest<BackendRoutine>(id ? `/routines/${encodeURIComponent(id)}` : '/routines', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  })
  return mapRoutine(saved)
}

export function deleteRoutine(id: string): Promise<void> {
  return apiRequest<void>(`/routines/${encodeURIComponent(id)}`, { method: 'DELETE' })
}