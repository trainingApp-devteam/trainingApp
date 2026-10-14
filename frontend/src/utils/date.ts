// toISOString() はUTCの日付になり、日本時間の0〜9時に前日を返すため、端末のローカル日付を使う
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}