import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LineChart from '../LineChart'

const points = [
  { x: '2026-10-15', y: 68.5 },
  { x: '2026-10-01', y: 70 },
  { x: '2026-10-08', y: 69.2 },
]

describe('LineChart', () => {
  test('shows the latest value, one line, and a marker per point in date order', () => {
    const { container } = render(<LineChart title="体重" unit="kg" points={points} />)

    expect(screen.getByRole('figure')).toHaveTextContent('68.5 kg（2026/10/15）')
    expect(container.querySelectorAll('polyline')).toHaveLength(1)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    const xs = (container.querySelector('polyline')!.getAttribute('points') || '').split(' ').map((p) => Number(p.split(',')[0]))
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  test('lists every value in a table, newest first', async () => {
    const user = userEvent.setup()
    render(<LineChart title="体重" unit="kg" points={points} />)

    await user.click(screen.getByText('数値一覧を表示（3件）'))
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual(['2026/10/1568.5', '2026/10/869.2', '2026/10/170'])
  })

  test('reads values with the arrow keys', () => {
    render(<LineChart title="体重" unit="kg" points={points} />)
    const chart = screen.getByRole('img', { name: /体重の推移（3件）/ })

    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent('70 kg')
    expect(screen.getByRole('status')).toHaveTextContent('2026/10/1')
    fireEvent.keyDown(chart, { key: 'End' })
    expect(screen.getByRole('status')).toHaveTextContent('68.5 kg')
    fireEvent.keyDown(chart, { key: 'Escape' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('shows an empty state instead of an empty chart', () => {
    render(<LineChart title="体脂肪率" unit="%" points={[]} />)

    expect(screen.getByText('この期間のデータがありません')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
