import { expect, test, type Page } from '@playwright/test'

const username = process.env.E2E_ADMIN_USERNAME || 'e2e-admin'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-password-123'

async function api(page: Page, method: 'POST' | 'GET', path: string, data?: unknown) {
  await page.request.get('/api/v1/auth/csrf')
  const token = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value
  const response = await page.request.fetch(`/api/v1${path}`, {
    method,
    data,
    headers: token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : undefined,
  })
  expect(response.ok(), `${method} ${path}`).toBeTruthy()
  return response.status() === 204 ? null : response.json()
}

test('login, body weight, menu auto-start, calorie estimate, and record editing', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'ログアウト' })).toHaveCount(0)
  await page.locator('header').getByRole('link', { name: 'ログイン' }).click()
  await expect(page).toHaveURL(/\/account$/)
  await page.getByLabel('ユーザー名').fill(username)
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page).toHaveURL('/')

  const header = page.locator('header')
  await expect(header.getByText(username)).toBeVisible()
  await expect(header.getByRole('link', { name: /ログイン/ })).toHaveCount(0)

  await page.goto('/account')
  await expect(page.locator('main').getByText('ログイン中')).toBeVisible()
  await page.getByLabel('体重（kg）').fill('63.5')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('status')).toHaveText('体重を保存しました')

  const [bench] = await api(page, 'GET', '/exercises?q=' + encodeURIComponent('ベンチプレス'))
  await api(page, 'POST', '/routines', {
    name: 'E2Eメニュー',
    exerciseIds: [bench.id],
    exerciseTargets: [{ exerciseId: bench.id, type: 'reps', reps: 8, weightKg: 40 }],
  })

  // menu selection starts the session automatically
  await page.goto('/record/select-menu')
  await page.getByRole('button', { name: '選択して記録へ' }).first().click()
  await expect(page.getByRole('heading', { name: 'メニュー実行' })).toBeVisible()
  await page.getByRole('button', { name: '完了して記録' }).click()
  await expect(page).toHaveURL(/\/history$/)

  await expect(page.getByText(/ベンチプレス/).first()).toBeVisible()
  await page.getByRole('link', { name: '詳細' }).first().click()
  await expect(page.getByText(/推定 1\.56 kcal/)).toBeVisible()

  await page.getByRole('button', { name: '編集' }).click()
  await page.getByLabel('セット1の回数').fill('12')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText(/12回 × 40kg/)).toBeVisible()
  await expect(page.getByText(/推定 .* kcal/)).toHaveCount(0)

  // header logout returns to the login screen and ends the server session
  await page.locator('header').getByRole('button', { name: 'ログアウト' }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeVisible()
  await expect(page.locator('header').getByText(username)).toHaveCount(0)
})
