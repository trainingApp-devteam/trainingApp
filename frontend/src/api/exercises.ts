import { apiRequest } from './client'

export type CalorieBasis = 'REP' | 'MINUTE'
type BackendExercise = { id: number; name: string; category?: string | null; calorieEnabled?: boolean; calorieBases?: CalorieBasis[] }
export type Exercise = {
  id: string
  name: string
  group?: string
  calorieEnabled?: boolean
  // 推定できる記録形式。有酸素マシンは時間(MINUTE)のみ
  calorieBases?: CalorieBasis[]
}

function mapExercise(exercise: BackendExercise): Exercise {
  return {
    id: String(exercise.id),
    name: exercise.name,
    group: exercise.category || undefined,
    calorieEnabled: exercise.calorieEnabled === true,
    calorieBases: exercise.calorieBases || [],
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


// そのセットの記録形式（回数/時間）で消費カロリーを推定できるか
export function canEstimate(exercise: Pick<Exercise, 'calorieEnabled' | 'calorieBases'> | undefined, type: 'reps' | 'time'): boolean {
  if (!exercise || exercise.calorieEnabled !== true) return false
  return (exercise.calorieBases || []).includes(type === 'reps' ? 'REP' : 'MINUTE')
}
