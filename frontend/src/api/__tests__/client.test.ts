import { apiRequest } from '../client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('apiRequest', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })
  afterEach(() => { vi.unstubAllGlobals() })

  test('sends GET requests to /api/v1 without a CSRF round trip', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/exercises?q=a')).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/exercises?q=a')
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('same-origin')
  })

  test('fetches a CSRF token and sends it on state-changing requests', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === '/api/v1/auth/csrf') {
        document.cookie = 'XSRF-TOKEN=abc%3D123; path=/'
        return new Response(null, { status: 204 })
      }
      return jsonResponse({ id: 1 }, 201)
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/routines', { method: 'POST', body: JSON.stringify({ name: 'x' }) })

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(['/api/v1/auth/csrf', '/api/v1/routines'])
    const init = fetchMock.mock.calls[1][1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('X-XSRF-TOKEN')).toBe('abc=123')
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  test('returns undefined for 204 responses', async () => {
    document.cookie = 'XSRF-TOKEN=t; path=/'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))

    await expect(apiRequest<void>('/routines/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  test('uses the API error message, falling back to the status code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください。' }, 400)))
    await expect(apiRequest('/exercises')).rejects.toThrow('入力内容を確認してください。')

    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 502 })))
    await expect(apiRequest('/exercises')).rejects.toThrow('APIエラー (502)')
  })

  test('fails when the CSRF token cannot be obtained', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))

    await expect(apiRequest('/routines', { method: 'POST', body: '{}' })).rejects.toThrow('CSRFトークンを取得できませんでした')
  })
})