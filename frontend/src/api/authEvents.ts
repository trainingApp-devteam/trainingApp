const AUTH_CHANGED = 'trainingapp:auth-changed'

// ログイン/ログアウト後に、ヘッダーなど離れた画面部品へ状態の更新を知らせる
export function notifyAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED))
}

export function onAuthChanged(listener: () => void): () => void {
  window.addEventListener(AUTH_CHANGED, listener)
  return () => window.removeEventListener(AUTH_CHANGED, listener)
}