import React from 'react'
import { render, screen } from '@testing-library/react'
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

  test('leaves the date to the header', () => {
    expect(screen.queryByText(new Date().toISOString().slice(0, 10))).not.toBeInTheDocument()
    expect(document.querySelector('time')).toBeNull()
  })

  test('does not duplicate the global navigation as quick links or an account dropdown', () => {
    expect(screen.queryByText('クイックリンク')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /アカウント/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '履歴' })).not.toBeInTheDocument()
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