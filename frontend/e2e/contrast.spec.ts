import { expect, test, type Page } from '@playwright/test'

// 背景(濃色)に対して文字が読めるかを、実際に描画された画面で検査する。
// 通常の文字は4.5:1、大きい文字(24px以上、または太字18.66px以上)は3:1(WCAG AA)。

const username = process.env.E2E_ADMIN_USERNAME || 'e2e-admin'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-password-123'

type Violation = { text: string; fg: string; bg: string; ratio: number; required: number; tag: string }

async function auditContrast(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    type RGBA = [number, number, number, number]
    // ページ全体の背景は gray-900 → gray-800 → gray-900 のグラデーション。明るい文字には明るい側(gray-800)が不利。
    const baseColors: RGBA[] = [[17, 24, 39, 1], [31, 41, 55, 1]]

    function parse(value: string): RGBA | null {
      const m = value.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const parts = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number)
      if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null
      return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
    }
    function over(top: RGBA, below: RGBA): RGBA {
      const a = top[3] + below[3] * (1 - top[3])
      if (a === 0) return [0, 0, 0, 0]
      const mix = (i: number) => (top[i] * top[3] + below[i] * below[3] * (1 - top[3])) / a
      return [mix(0), mix(1), mix(2), a]
    }
    function luminance([r, g, b]: RGBA): number {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    function ratio(a: RGBA, b: RGBA): number {
      const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (l1 + 0.05) / (l2 + 0.05)
    }
    // 要素の背景候補(グラデーションは各色を候補にする)を、祖先の半透明背景も重ねて求める
    function backgrounds(el: Element): RGBA[] {
      const layers: RGBA[][] = []
      for (let node: Element | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        const image = style.backgroundImage
        if (image && image !== 'none') {
          const colors = (image.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean) as RGBA[]
          if (colors.length) { layers.push(colors); if (colors.every((c) => c[3] === 1)) break }
        }
        const color = parse(style.backgroundColor)
        if (color && color[3] > 0) { layers.push([color]); if (color[3] === 1) break }
      }
      let candidates: RGBA[] = baseColors
      for (let i = layers.length - 1; i >= 0; i--) {
        candidates = layers[i].flatMap((layer) => candidates.map((base) => over(layer, base)))
      }
      return candidates
    }
    function visible(el: Element): boolean {
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false
      const rect = el.getBoundingClientRect()
      if (rect.width <= 1 || rect.height <= 1) return false
      for (let node: Element | null = el.parentElement; node; node = node.parentElement) {
        const s = getComputedStyle(node)
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
      }
      return true
    }

    const results: Violation[] = []
    const seen = new Set<string>()
    const elements = Array.from(document.querySelectorAll('body *'))
    for (const el of elements) {
      if (['SCRIPT', 'STYLE', 'OPTION', 'OPTGROUP', 'SVG', 'PATH'].includes(el.tagName.toUpperCase())) continue
      const isField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
      const ownText = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent || '').join('').trim()
      const fieldText = isField && (el as HTMLInputElement).type !== 'radio' && (el as HTMLInputElement).type !== 'checkbox' && (el as HTMLInputElement).type !== 'range'
      if (!ownText && !fieldText) continue
      if (!visible(el)) continue
      if ((el as HTMLButtonElement).disabled) continue

      const style = getComputedStyle(el)
      const fgRaw = parse(style.color)
      if (!fgRaw) continue
      const size = parseFloat(style.fontSize)
      const bold = Number(style.fontWeight) >= 700
      const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
      const bgs = backgrounds(el)
      let worst = Infinity
      let worstBg: RGBA = bgs[0]
      for (const bg of bgs) {
        const fg = over(fgRaw, bg)
        const r = ratio(fg, bg)
        if (r < worst) { worst = r; worstBg = bg }
      }
      if (worst < required) {
        const label = (ownText || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '').slice(0, 40)
        const key = `${el.tagName}|${label}|${style.color}|${worstBg.join(',')}`
        if (seen.has(key)) continue
        seen.add(key)
        results.push({
          tag: el.tagName.toLowerCase(), text: label, fg: style.color,
          bg: `rgb(${worstBg.slice(0, 3).map(Math.round).join(', ')})`, ratio: Math.round(worst * 100) / 100, required,
        })
      }
    }
    return results
  })
}

async function api(page: Page, method: 'POST' | 'GET' | 'PATCH', path: string, data?: unknown) {
  await page.request.get('/api/v1/auth/csrf')
  const token = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value
  const response = await page.request.fetch(`/api/v1${path}`, {
    method, data, headers: token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : undefined,
  })
  expect(response.ok(), `${method} ${path}`).toBeTruthy()
  return response.status() === 204 ? null : response.json()
}

async function expectReadable(page: Page, name: string) {
  await page.waitForTimeout(250)
  const violations = await auditContrast(page)
  expect(violations, `${name}: 背景に対して読みにくい文字`).toEqual([])
}

test('every screen keeps text readable against the dark background', async ({ page }) => {
  // 未ログインの画面
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ログインしてください' })).toBeVisible()
  await expectReadable(page, 'ホーム(未ログイン)')

  await page.goto('/account')
  await expectReadable(page, 'ログイン')
  await page.getByRole('button', { name: '新規登録' }).click()
  await expectReadable(page, '新規登録')
  await page.getByRole('button', { name: 'ログインへ戻る' }).click()
  await page.getByLabel('ユーザー名').fill('nobody')
  await page.getByLabel('パスワード').fill('wrong-password')
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectReadable(page, 'ログイン(エラー表示)')

  // ログイン
  await page.getByLabel('ユーザー名').fill(username)
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expectReadable(page, 'ホーム(身体データ未登録)')

  // データを用意
  const [bench] = await api(page, 'GET', '/exercises?q=' + encodeURIComponent('ベンチプレス'))
  await api(page, 'POST', '/routines', {
    name: '配色確認メニュー', exerciseIds: [bench.id],
    exerciseTargets: [{ exerciseId: bench.id, type: 'reps', reps: 8, weightKg: 40 }],
  })
  // 他のテストが後から登録する測定値より必ず古い日時にする
  const measuredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  await api(page, 'POST', '/body-measurements', { measurementTypeCode: 'weight_kg', measuredAt, value: 66.4 })
  // 身長は測定値ではなく、アカウントに一度だけ登録する
  await api(page, 'PATCH', '/auth/me', { heightCm: 171.5 })
  const session = await api(page, 'POST', '/training-sessions', {
    trainingDate: new Date().toISOString().slice(0, 10),
    exercises: [{ exerciseId: bench.id, displayOrder: 1, sets: [{ reps: 10, weightKg: 40 }, { reps: 8, weightKg: 40 }] }],
  })

  await page.goto('/')
  await expect(page.getByTestId('body-weight_kg')).toContainText('66.4')
  await expectReadable(page, 'ホーム(身体データあり・一部未登録)')

  await page.goto('/account')
  await expect(page.locator('main').getByText('ログイン中')).toBeVisible()
  await expectReadable(page, 'アカウント(ログイン中)')

  await page.getByRole('button', { name: 'メニュー' }).click()
  await expectReadable(page, 'ハンバーガーメニュー')
  await page.keyboard.press('Escape')

  // 記録(メニュー作成)
  await page.goto('/record')
  await expectReadable(page, 'メニュー作成(空)')
  await page.getByRole('button', { name: '実行開始' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectReadable(page, 'メニュー作成(エラー)')
  await page.getByRole('button', { name: 'セットを追加' }).click()
  await page.getByLabel('記録形式').selectOption('time')
  await page.getByRole('button', { name: 'セットを追加' }).click()
  await expectReadable(page, 'メニュー作成(セットあり)')
  await page.getByRole('button', { name: /^作成中のセット/ }).click()
  await expect(page.getByRole('dialog', { name: '作成中のセット' })).toBeVisible()
  await expectReadable(page, '作成中のセット(モーダル)')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'RPEの目安' }).focus()
  await expectReadable(page, 'メニュー作成(RPEの説明)')
  await page.getByRole('button', { name: '実行開始' }).click()
  await expect(page.getByRole('heading', { name: 'メニュー実行' })).toBeVisible()
  await expectReadable(page, 'メニュー実行')
  await page.getByRole('button', { name: /展開する/ }).click()
  await expectReadable(page, 'メニュー実行(一覧展開)')

  await page.goto('/record/select')
  await expectReadable(page, '記録方法の選択')
  await page.goto('/record/select-menu')
  await expect(page.getByText('配色確認メニュー')).toBeVisible()
  await expectReadable(page, '保存済メニュー選択')

  // 履歴
  await page.goto('/history')
  await expect(page.getByRole('link', { name: '詳細' }).first()).toBeVisible()
  await expectReadable(page, '履歴')
  await page.goto(`/history/${session.id}`)
  await expect(page.getByRole('button', { name: '編集' })).toBeVisible()
  await expectReadable(page, '履歴詳細')
  await page.getByRole('button', { name: '編集' }).click()
  await expectReadable(page, '履歴詳細(編集)')
  await page.getByLabel('セット1の回数').fill('0')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectReadable(page, '履歴詳細(編集エラー)')

  // メニュー管理
  await page.goto('/menu')
  await expect(page.getByText('配色確認メニュー').first()).toBeVisible()
  await expectReadable(page, 'メニュー一覧')
  await page.getByRole('button', { name: '新規作成' }).click()
  await expectReadable(page, 'メニュー作成フォーム')
  await page.getByRole('group', { name: '種目' }).getByRole('button').first().click()
  await expect(page.getByRole('button', { name: /を削除$/ })).toBeVisible()
  await expectReadable(page, 'メニュー作成フォーム(種目あり)')

  // 身体測定
  await page.goto('/body')
  await expect(page.getByRole('region', { name: '履歴' }).getByRole('listitem').first()).toBeVisible()
  await expect(page.getByRole('figure', { name: '体重の推移グラフ' })).toBeVisible()
  await expectReadable(page, '身体測定')

  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectReadable(page, '身体測定(エラー)')

  await page.goto('/progress')
  await expect(page.getByRole('img', { name: /最大重量の推移/ })).toBeVisible()
  await expectReadable(page, '種目別の推移')

  // スマートフォン幅でも確認
  await page.setViewportSize({ width: 375, height: 700 })
  for (const path of ['/', '/record', '/history', '/body', '/menu', '/progress']) {
    await page.goto(path)
    await expectReadable(page, `${path}(スマートフォン幅)`)
  }
})