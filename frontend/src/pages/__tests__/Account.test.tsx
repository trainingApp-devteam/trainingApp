import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { getAccountBodyWeight, saveAccountBodyWeight } from '../../api/accountProfile'
import Account from '../Account'

describe('Account page', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('trainingapp:authUser', JSON.stringify({ username: 'test-user' }))
  })

  test('saves the account body weight for calorie estimates', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Account /></MemoryRouter>)

    await user.type(screen.getByLabelText('体重（kg）'), '63.5')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByRole('status')).toHaveTextContent('体重を保存しました')
    expect(localStorage.getItem('trainingApp.accountProfile:test-user')).toBe('{"bodyWeightKg":63.5}')
  })

  test('keeps body weights separate between accounts', () => {
    saveAccountBodyWeight(63.5, 'first-user')
    saveAccountBodyWeight(81, 'second-user')

    expect(getAccountBodyWeight('first-user')).toBe(63.5)
    expect(getAccountBodyWeight('second-user')).toBe(81)
  })
})