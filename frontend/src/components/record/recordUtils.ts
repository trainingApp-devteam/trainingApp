import type { Exercise } from '../../api/exercises'
import type { SetItem } from '../../api/records'

// batch: 全種目のセットを組んでからまとめて実行（従来）
// step: 1種目のセットを組んで実行し、終わったら次の種目を設定する
export type Flow = 'batch' | 'step'

// 実行時に流すプレイリストのURL。端末ごとの入力の手間を省くためだけに保存する
const PLAYLIST_STORAGE_KEY = 'trainingApp.playlistUrl'

export function loadPlaylistUrl(): string {
  try { return localStorage.getItem(PLAYLIST_STORAGE_KEY) || '' } catch { return '' }
}

export function savePlaylistUrl(url: string) {
  try {
    if (url) localStorage.setItem(PLAYLIST_STORAGE_KEY, url)
    else localStorage.removeItem(PLAYLIST_STORAGE_KEY)
  } catch { /* 保存できなくても実行は続ける */ }
}

// 連続する同じ種目のセットを「種目名×セット数」にまとめる
export function groupSets(sets: SetItem[], exercises: Exercise[] = []): Array<{ name: string; count: number }> {
  const groups: Array<{ exerciseId?: string; name: string; count: number }> = []
  for (const set of sets) {
    const last = groups[groups.length - 1]
    if (last && last.exerciseId === set.exerciseId) last.count += 1
    else groups.push({ exerciseId: set.exerciseId, name: setName(set, exercises, '種目'), count: 1 })
  }
  return groups
}

// 先頭の種目のセット（連続する同じ種目）と、それ以降に分ける
export function splitFirstExercise(sets: SetItem[]): [SetItem[], SetItem[]] {
  let n = 0
  while (n < sets.length && sets[n].exerciseId === sets[0].exerciseId) n++
  return [sets.slice(0, n), sets.slice(n)]
}

// セットの種目名。作成時に控えた名前、種目一覧の名前、代わりの文字の順に使う
export function setName(set: SetItem, exercises: Exercise[], fallback = set.exerciseId || ''): string {
  return set.exerciseName || exercises.find((e) => e.id === set.exerciseId)?.name || fallback
}

export function setAmount(set: SetItem): string {
  return set.type === 'reps' ? `${set.reps} 回` : `${set.timeSeconds} 秒`
}

// 作成中のセットの予定消費カロリーの合計（「予定 約12.3 kcal」）。対象のセットがなければ空文字
export function plannedKcalText(sets: SetItem[]): string {
  const target = sets.filter((s) => s.calorieEnabled)
  if (target.length === 0) return ''
  const pending = target.some((s) => s.plannedCaloriesKcal === undefined)
  const total = target.reduce((sum, s) => sum + (s.plannedCaloriesKcal ?? 0), 0)
  return `予定 約${total.toFixed(1)} kcal${pending ? '（計算中）' : ''}`
}

// セットごとの消費カロリーの表示。保存後の値、予定の見積もり、計算中、対象外の順
export function setKcalText(set: SetItem): string {
  if (set.estimatedCaloriesKcal !== undefined) return `${set.estimatedCaloriesKcal} kcal`
  if (!set.calorieEnabled || set.plannedCaloriesKcal === null) return 'kcal対象外'
  if (set.plannedCaloriesKcal === undefined) return 'kcal計算中'
  return `予定 約${set.plannedCaloriesKcal.toFixed(1)} kcal`
}

// 名前のないセットに、種目一覧から名前と部位を補う
export function fillSetNames(sets: SetItem[], exercises: Exercise[]): SetItem[] {
  return sets.map((s) => {
    if (s.exerciseName) return s
    const found = exercises.find((e) => e.id === s.exerciseId)
    return found ? { ...s, exerciseName: found.name, exerciseGroup: found.group } : s
  })
}

let audioContext: AudioContext | null = null

// タイマー終了の合図音（約5秒）
export function playBeep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    if (!audioContext) audioContext = new Ctx()
    const ctx = audioContext
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    o.connect(g)
    g.connect(ctx.destination)
    const now = ctx.currentTime
    // gentle attack, sustain ~5s, then fade out
    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(0.2, now + 0.02)
    o.start(now)
    g.gain.setValueAtTime(0.2, now + 0.02)
    g.gain.linearRampToValueAtTime(0.0001, now + 5)
    o.stop(now + 5.05)
  } catch {
    // ignore audio errors
  }
}
