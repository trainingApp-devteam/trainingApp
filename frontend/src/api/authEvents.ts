import type { Account } from './auth'

const AUTH_CHANGED = 'trainingapp:auth-changed'

type Detail = { known: boolean; account: Account | null }

// ログイン/ログアウト後に、ヘッダーなど離れた画面部品へ状態の更新を知らせる。
// account を渡すとその場で反映し(遷移直後の画面が最新状態を見られる)、省略するとサーバーへ再確認する。
// null はログアウトを表す。(CustomEventのdetailはundefinedがnullになるため、省略の有無を別に持つ)
export function notifyAuthChanged(account?: Account | null): void {
  const detail: Detail = { known: account !== undefined, account: account ?? null }
  window.dispatchEvent(new CustomEvent<Detail>(AUTH_CHANGED, { detail }))
}

export function onAuthChanged(listener: (account?: Account | null) => void): () => void {
  const handler = (event: Event) => {
    const { known, account } = (event as CustomEvent<Detail>).detail
    listener(known ? account : undefined)
  }
  window.addEventListener(AUTH_CHANGED, handler)
  return () => window.removeEventListener(AUTH_CHANGED, handler)
}