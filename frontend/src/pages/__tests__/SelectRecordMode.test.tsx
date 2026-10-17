import React from 'react'
import { render, screen } from '@testing-library/react'
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
  test('offers only the two ways to proceed and the saved menus, without radio buttons', () => {
    renderScreen()

    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['まとめて実行', '1種目ずつ実行', '保存済みメニューから'])
    expect(screen.queryByText('一から作成')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  test('opens the record screen with the chosen way to proceed', async () => {
    const user = userEvent.setup()
    const { unmount } = renderScreen()
    await user.click(screen.getByRole('button', { name: /^まとめて実行/ }))
    expect(screen.getByTestId('url')).toHaveTextContent('/record?mode=create')
    expect(screen.getByTestId('url')).not.toHaveTextContent('flow=step')
    unmount()

    renderScreen()
    await user.click(screen.getByRole('button', { name: /^1種目ずつ実行/ }))
    expect(screen.getByTestId('url')).toHaveTextContent('/record?mode=create&flow=step')
  })

  test('opens the saved menu list', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: '保存済みメニューから' }))

    expect(screen.getByTestId('url')).toHaveTextContent('/record/select-menu')
  })
})
