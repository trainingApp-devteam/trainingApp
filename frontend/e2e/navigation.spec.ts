import { expect, test } from '@playwright/test'

test('hamburger menu replaces header nav and quick links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('クイックリンク')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '履歴' })).toHaveCount(0)

  await page.getByRole('button', { name: 'メニュー' }).click()
  const nav = page.getByRole('navigation', { name: 'メインメニュー' })
  await expect(nav.getByRole('link')).toHaveText(['記録', '履歴', 'メニュー', '身体測定', 'アカウント'])
  await expect(page.locator('time')).toHaveCount(1)
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