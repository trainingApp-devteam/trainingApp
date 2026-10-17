import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import SelectRecordMode from '../SelectRecordMode'

function CurrentUrl() {
  const location = useLocation()
  return <div data-testid="url">{location.pathname + location.search}</div>
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/record/select']}>
      <Routes>
        <Route path="/record/select" element={<SelectRecordMode />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SelectRecordMode page', () => {
  test('offers both ways to proceed, defaulting to building all sets first', () => {
    renderScreen()
    const flow = screen.getByRole('region', { name: '進め方' })

    expect(within(flow).getByRole('radio', { name: '全種目のセットを組んでまとめて実行' })).toBeChecked()
    expect(within(flow).getByRole('radio', { name: '1種目ずつ設定して実行' })).not.toBeChecked()
  })

  test('passes the default way to proceed without extra parameters', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: '一から種目を作成して記録' }))

    expect(screen.getByTestId('url')).toHaveTextContent('/record?mode=create')
    expect(screen.getByTestId('url')).not.toHaveTextContent('flow=step')
  })

  test('passes the one-exercise-at-a-time way to both the new record and the saved menu screens', async () => {
    const user = userEvent.setup()
    const { unmount } = renderScreen()
    await user.click(screen.getByRole('radio', { name: '1種目ずつ設定して実行' }))
    await user.click(screen.getByRole('button', { name: '一から種目を作成して記録' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/record?mode=create&flow=step')
    unmount()

    renderScreen()
    await user.click(screen.getByRole('radio', { name: '1種目ずつ設定して実行' }))
    await user.click(screen.getByRole('button', { name: '保存済メニューから選んで記録' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/record/select-menu?flow=step')
  })
})
