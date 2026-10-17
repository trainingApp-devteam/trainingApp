// toISOString() はUTCの日付になり、日本時間の0〜9時に前日を返すため、端末のローカル日付を使う
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

// <input type="datetime-local"> の値（ローカル時刻、秒なし）
export function localDateTimeInputValue(date: Date = new Date()): string {
  return `${localDateString(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// 画面表示用。ISO日時（UTC）を端末のローカル時刻で「YYYY/MM/DD HH:mm」にする
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}