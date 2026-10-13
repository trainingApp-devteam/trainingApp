const PROFILE_KEY_PREFIX = 'trainingApp.accountProfile:'

export function getCurrentAccountUsername(): string | null {
  try {
    const authUser = JSON.parse(localStorage.getItem('trainingapp:authUser') || 'null') as { username?: unknown } | null
    return typeof authUser?.username === 'string' && authUser.username ? authUser.username : null
  } catch {
    return null
  }
}

function profileKey(username: string): string {
  return `${PROFILE_KEY_PREFIX}${encodeURIComponent(username)}`
}

export function getAccountBodyWeight(username = getCurrentAccountUsername()): number | null {
  if (!username) return null
  const savedProfile = localStorage.getItem(profileKey(username))
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

export function saveAccountBodyWeight(bodyWeightKg: number, username = getCurrentAccountUsername()): void {
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg < 20 || bodyWeightKg > 300) {
    throw new Error('体重は20〜300kgの範囲で入力してください')
  }
  if (!username) throw new Error('ログインしてから体重を登録してください')

  localStorage.setItem(profileKey(username), JSON.stringify({ bodyWeightKg }))
}