import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../Home'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest';

vi.mock('../../api/records', () => ({ listRecords: vi.fn(async () => []) }))
vi.mock('../../api/bodyMeasurements', () => ({ listBodyMeasurements: vi.fn(async () => []) }))

describe('Home page', () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
  })

  test('shows today date (YYYY-MM-DD)', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(screen.getByText(today)).toBeInTheDocument()
  })

  test('user menu is hidden initially and toggles on button click', async () => {
    const button = screen.getByRole('button', { name: /アカウント/ })
    expect(button).toHaveAttribute('aria-haspopup', 'true')
    // 初期はメニュー項目が無い
    expect(screen.queryByText('プロフィール')).not.toBeInTheDocument()

    await userEvent.click(button)
    expect(screen.getByText('プロフィール')).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(button)
    expect(screen.queryByText('プロフィール')).not.toBeInTheDocument()
  })

  test('clicking outside closes the menu', async () => {
    const button = screen.getByRole('button', { name: /アカウント/ })
    await userEvent.click(button)
    expect(screen.getByText('プロフィール')).toBeInTheDocument()

    // document body をクリックして閉じる挙動を確認
    fireEvent.click(document.body)
    expect(screen.queryByText('プロフィール')).not.toBeInTheDocument()
  })

  test('quick action links exist and point to correct routes', () => {
    const recordLink = screen.getByText('今すぐ記録').closest('a')
    const menuLink = screen.getByText('メニューを作成').closest('a')
    expect(recordLink).toHaveAttribute('href', '/record/select')
    expect(menuLink).toHaveAttribute('href', '/menu')
  })

  test('shows placeholder when no recent records', () => {
    expect(screen.getByText(/まだ記録がありません/)).toBeInTheDocument()
  })
})