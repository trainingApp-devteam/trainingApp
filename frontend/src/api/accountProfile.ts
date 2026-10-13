const PROFILE_KEY = 'trainingApp.accountProfile'

export function getAccountBodyWeight(): number | null {
  const savedProfile = localStorage.getItem(PROFILE_KEY)
  if (!savedProfile) return null

  try {
    const profile = JSON.parse(savedProfile) as { bodyWeightKg?: unknown }
    const bodyWeightKg = profile.bodyWeightKg
    if (typeof bodyWeightKg !== 'number' || !Number.isFinite(bodyWeightKg)) return null
    return bodyWeightKg >= 20 && bodyWeightKg <= 300 ? bodyWeightKg : null
  } catch {
    return null
  }
}

export function saveAccountBodyWeight(bodyWeightKg: number): void {
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg < 20 || bodyWeightKg > 300) {
    throw new Error('体重は20〜300kgの範囲で入力してください')
  }

  localStorage.setItem(PROFILE_KEY, JSON.stringify({ bodyWeightKg }))
}