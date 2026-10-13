export type Exercise = {
  id: string
  name: string
  group?: string
  isBuiltin?: boolean
  calorieEnabled?: boolean
}

export async function searchExercises(q = '', category?: string): Promise<Exercise[]> {
  const url = new URL('/api/exercises', location.origin)
  if (q) url.searchParams.set('q', q)
  if (category) url.searchParams.set('category', category)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to fetch exercises')
  return res.json()
}

export async function listExerciseGroups(): Promise<Array<{ id: string; name: string }>> {
  const url = new URL('/api/exercise-groups', location.origin)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to fetch groups')
  return res.json()
}

export async function createExercise(name: string, group?: string): Promise<Exercise> {
  const url = new URL('/api/exercises', location.origin)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, group }),
  })
  if (!res.ok) throw new Error('Failed to create exercise')
  return res.json()
}
