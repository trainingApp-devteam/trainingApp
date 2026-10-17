import React from 'react'

export type Period = '1m' | '3m' | '1y' | 'all'

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '1m', label: '1か月' },
  { value: '3m', label: '3か月' },
  { value: '1y', label: '1年' },
  { value: 'all', label: '全期間' },
]

// 期間の開始日（ローカル日付の0時）。全期間はnull
export function periodStart(period: Period, now: Date = new Date()): Date | null {
  if (period === 'all') return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === '1m') start.setMonth(start.getMonth() - 1)
  if (period === '3m') start.setMonth(start.getMonth() - 3)
  if (period === '1y') start.setFullYear(start.getFullYear() - 1)
  return start
}

export default function PeriodSelect({ value, onChange, label = '期間' }: { value: Period; onChange: (value: Period) => void; label?: string }): JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-black/30 p-1 ring-1 ring-white/10">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          role="radio"
          aria-checked={value === period.value}
          onClick={() => onChange(period.value)}
          className={`rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${value === period.value ? 'bg-indigo-600 font-semibold text-white' : 'text-gray-200 hover:bg-white/10'}`}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
