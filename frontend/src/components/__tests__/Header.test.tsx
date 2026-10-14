import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Header from '../Header'

function renderHeader(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Header />
      <Routes>
        <Route path="*" element={<div>content</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Header hamburger menu', () => {
  test('shows the local date', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 15, 0, 30))
    try {
      renderHeader()
      expect(screen.getByText('2026-10-15')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  test('keeps the page links hidden until the menu button is pressed', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: 'メニュー' })

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'TrainingApp' })).toHaveAttribute('href', '/')

    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const nav = screen.getByRole('navigation', { name: 'メインメニュー' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['記録', '/record'],
      ['履歴', '/history'],
      ['メニュー', '/menu'],
      ['身体測定', '/body'],
      ['アカウント', '/account'],
    ])
  })

  test('marks the current page', async () => {
    const user = userEvent.setup()
    renderHeader('/history')
    await user.click(screen.getByRole('button', { name: 'メニュー' }))

    expect(screen.getByRole('link', { name: '履歴' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '記録' })).not.toHaveAttribute('aria-current')
  })

  test('closes after choosing a page', async () => {
    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByRole('link', { name: '身体測定' }))

    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'メニュー' })).toHaveAttribute('aria-expanded', 'false')
  })

  test('closes with Escape and when clicking outside, and returns focus to the button on Escape', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: 'メニュー' })

    await user.click(button)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()

    await user.click(button)
    await user.click(screen.getByText('content'))
    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
  })

  test('toggles closed when the button is pressed again', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: 'メニュー' })

    await user.click(button)
    await user.click(button)

    expect(screen.queryByRole('navigation', { name: 'メインメニュー' })).not.toBeInTheDocument()
  })
})