import { apiRequest } from './client'

type BackendExercise = { id: number; name: string; category?: string | null; shared?: boolean; calorieEnabled?: boolean }
export type Exercise = {
  id: string
  name: string
  group?: string
  isBuiltin?: boolean
  calorieEnabled?: boolean
}

function mapExercise(exercise: BackendExercise): Exercise {
  return {
    id: String(exercise.id),
    name: exercise.name,
    group: exercise.category || undefined,
    isBuiltin: exercise.shared === true,
    calorieEnabled: exercise.calorieEnabled === true,
  }
}

export async function searchExercises(q = '', category?: string): Promise<Exercise[]> {
  const url = new URL('/api/v1/exercises', location.origin)
  if (q) url.searchParams.set('q', q)
  if (category) url.searchParams.set('category', category)
  const data = await apiRequest<BackendExercise[]>(`${url.pathname.replace('/api/v1', '')}${url.search}`)
  return data.map(mapExercise)
}

export async function listExerciseGroups(): Promise<Array<{ id: string; name: string }>> {
  const exercises = await searchExercises()
  const groups = new Set(exercises.map((exercise) => exercise.group).filter((group): group is string => Boolean(group)))
  return [...groups].sort().map((group) => ({ id: group, name: group }))
}

export async function createExercise(name: string, group?: string): Promise<Exercise> {
  const exercise = await apiRequest<BackendExercise>('/exercises', {
    method: 'POST',
    body: JSON.stringify({ name, category: group }),
  })
  return mapExercise(exercise)
}
