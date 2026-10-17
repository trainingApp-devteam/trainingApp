type RequestOptions = RequestInit & { csrf?: boolean }

// APIのURL。画面とAPIを別ドメインで配信する場合（GitHub Pages + Render など）は、
// ビルド時に VITE_API_BASE_URL=https://<api>.onrender.com を指定する。未指定なら同じドメインの /api/v1
export const API_BASE = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/v1`

let csrfRequest: Promise<string | null> | null = null

// CSRFトークンを取得する。別ドメインの画面はAPIのクッキーを読めないため、レスポンスヘッダーの値を使う
async function fetchCsrfToken(): Promise<string | null> {
  if (!csrfRequest) {
    csrfRequest = fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('CSRFトークンを取得できませんでした')
        return response.headers.get('X-XSRF-TOKEN')
      })
      .finally(() => { csrfRequest = null })
  }
  return csrfRequest
}

function csrfCookie(): string | null {
  const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))?.split('=').slice(1).join('=')
  return token ? decodeURIComponent(token) : null
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { csrf, headers: suppliedHeaders, ...init } = options
  const method = (init.method || 'GET').toUpperCase()
  const needsCsrf = csrf ?? !['GET', 'HEAD', 'OPTIONS'].includes(method)
  const headerToken = needsCsrf ? await fetchCsrfToken() : null

  const headers = new Headers(suppliedHeaders)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (needsCsrf) {
    const token = headerToken || csrfCookie()
    if (token) headers.set('X-XSRF-TOKEN', token)
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, method, headers, credentials: 'include' })
  if (!response.ok) {
    let message = `APIエラー (${response.status})`
    try {
      const error = await response.json()
      message = error.message || error.detail || message
    } catch {}
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
