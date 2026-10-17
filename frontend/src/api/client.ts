type RequestOptions = RequestInit & { csrf?: boolean }

let csrfRequest: Promise<void> | null = null

async function ensureCsrf(): Promise<void> {
  if (!csrfRequest) {
    csrfRequest = fetch('/api/v1/auth/csrf', { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('CSRFトークンを取得できませんでした')
      })
      .finally(() => { csrfRequest = null })
  }
  await csrfRequest
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { csrf, headers: suppliedHeaders, ...init } = options
  const method = (init.method || 'GET').toUpperCase()
  const needsCsrf = csrf ?? !['GET', 'HEAD', 'OPTIONS'].includes(method)
  if (needsCsrf) await ensureCsrf()

  const headers = new Headers(suppliedHeaders)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (needsCsrf) {
    const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))?.split('=').slice(1).join('=')
    if (token) headers.set('X-XSRF-TOKEN', decodeURIComponent(token))
  }

  const response = await fetch(`/api/v1${path}`, { ...init, method, headers, credentials: 'same-origin' })
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