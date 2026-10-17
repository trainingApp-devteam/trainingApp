// 画面共通の配色。背景(gray-900〜800の濃色グラデーション)に合わせ、文字は明るい色にして
// 通常テキストでWCAG AA(4.5:1)を満たす組み合わせだけを使う。
export const ui = {
  card: 'rounded-2xl bg-white/5 p-6 shadow-lg ring-1 ring-white/10',
  cardTitle: 'mb-3 text-lg font-semibold text-gray-100',
  label: 'mb-1 block text-sm font-medium text-gray-200',
  muted: 'text-sm text-gray-300',
  field:
    'rounded-md border border-white/20 bg-gray-900/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60',
  input: 'w-full rounded-md border border-white/20 bg-gray-900/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60',
  panel: 'rounded-lg bg-black/20 p-4 ring-1 ring-white/10',
  btnPrimary:
    'rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50',
  btnSuccess:
    'rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-300 disabled:cursor-not-allowed disabled:opacity-50',
  btnDanger:
    'rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50',
  btnSecondary:
    'rounded-md bg-gray-700 px-4 py-2 font-medium text-gray-100 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50',
  btnSmall: 'px-3 py-1 text-sm',
  link: 'text-indigo-300 underline hover:text-indigo-200',
  error: 'text-red-300',
  success: 'text-green-300',
} as const