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
  await expect(page.getByLabel('体重（kg）')).toHaveCount(0)

  // 体重は身体測定で登録し、ホームの上部に測定日時付きで表示される。カロリー推定にもこの体重を使う
  await page.goto('/body')
  await page.getByLabel('体重(kg)').fill('63.5')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('status')).toHaveText('保存しました')
  await page.goto('/')
  await expect(page.getByTestId('body-weight_kg')).toContainText('63.5')
  await expect(page.getByTestId('body-weight_kg')).toContainText('測定日時')
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
  // 回数を変えたセットは、元のRPEと最新の体重で推定し直す（8回で1.56kcal → 12回で2.33kcal）
  await expect(page.getByText(/推定 2\.33 kcal/)).toBeVisible()

  // 種目別の推移: 記録した種目の最大重量とトレーニング量（12回×40kg = 480kg）をグラフで確認できる
  await page.goto('/progress')
  await expect(page.getByLabel('種目')).toHaveValue(String(bench.id))
  await expect(page.getByRole('img', { name: /最大重量の推移/ })).toBeVisible()
  await expect(page.getByRole('figure', { name: 'トレーニング量の推移グラフ' })).toContainText('最新 480 kg')

  // 体重の推移グラフ
  await page.goto('/body')
  await expect(page.getByRole('figure', { name: '体重の推移グラフ' })).toContainText('最新 63.5 kg')

  // header logout returns to the login screen and ends the server session
  await page.locator('header').getByRole('button', { name: 'ログアウト' }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeVisible()
  await expect(page.locator('header').getByText(username)).toHaveCount(0)
})
