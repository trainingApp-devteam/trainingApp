import { expect, test, type Page } from '@playwright/test'

const username = process.env.E2E_ADMIN_USERNAME || 'e2e-admin'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-password-123'

async function loginThroughForm(page: Page) {
  await page.goto('/account')
  await page.getByLabel('ユーザー名').fill(username)
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page).toHaveURL('/')
}

test('logged-out visitors cannot record or create menus', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ログインしてください' })).toBeVisible()
  await expect(page.getByText('今すぐ記録')).toHaveCount(0)
  await expect(page.getByText('メニューを作成')).toHaveCount(0)

  for (const path of ['/record', '/record/select', '/record/select-menu', '/history', '/menu', '/body']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByText('この画面を利用するにはログインが必要です。')).toBeVisible()
  }

  // the login screen has a single login button, and the header does not repeat it
  await expect(page.getByRole('button', { name: /ログイン/ })).toHaveCount(1)
  await expect(page.locator('header').getByRole('link', { name: /ログイン/ })).toHaveCount(0)
  await expect(page.getByRole('tab')).toHaveCount(0)

  await page.getByRole('button', { name: '新規登録' }).click()
  await expect(page.getByRole('heading', { name: '新規登録' })).toBeVisible()
  await expect(page.getByLabel('招待コード')).toBeVisible()
  await expect(page.getByText('招待で登録')).toHaveCount(0)
})

test('after login the protected page that was requested opens', async ({ page }) => {
  await page.goto('/history')
  await expect(page).toHaveURL(/\/account$/)
  await page.getByLabel('ユーザー名').fill(username)
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page).toHaveURL(/\/history$/)
})

test('hamburger menu replaces header nav and quick links', async ({ page }) => {
  await loginThroughForm(page)
  await expect(page.getByText('クイックリンク')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '履歴' })).toHaveCount(0)

  await page.getByRole('button', { name: 'メニュー' }).click()
  const nav = page.getByRole('navigation', { name: 'メインメニュー' })
  await expect(nav.getByRole('link')).toHaveText(['記録', '履歴', 'メニュー', '身体測定', 'アカウント'])
  await expect(page.locator('time')).toHaveCount(0)
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/hamburger-open.png' })

  await nav.getByRole('link', { name: '履歴' }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByRole('navigation', { name: 'メインメニュー' })).toHaveCount(0)

  await page.setViewportSize({ width: 375, height: 700 })
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page.getByRole('link', { name: 'アカウント' })).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/hamburger-mobile.png' })
})

test('record screen is split into date, set entry, set list, and run sections', async ({ page }) => {
  await loginThroughForm(page)
  await page.goto('/record')

  await expect(page.getByRole('heading', { name: 'メニュー作成' })).toBeVisible()
  for (const name of ['日付', '種目を選んでセットを追加', '作成中のセット', '実行']) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
  await expect(page.getByText('推定用体重')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'メニューを適用' })).toHaveCount(0)

  await page.getByRole('button', { name: 'セットを追加' }).click()
  await expect(page.getByRole('region', { name: '作成中のセット' }).getByRole('row')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/record-sections.png', fullPage: true })
})
