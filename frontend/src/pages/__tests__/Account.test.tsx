import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Account from '../Account'

describe('Account page', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('saves the account body weight for calorie estimates', async () => {
    const user = userEvent.setup()
    render(<Account />)

    await user.type(screen.getByLabelText('体重（kg）'), '63.5')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByRole('status')).toHaveTextContent('体重を保存しました')
    expect(localStorage.getItem('trainingApp.accountProfile')).toBe('{"bodyWeightKg":63.5}')
  })
})