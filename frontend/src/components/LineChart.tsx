import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

export type ChartPoint = {
  // 'YYYY-MM-DD' またはISO日時。横軸は時間の間隔どおりに並べる
  x: string
  y: number
}

type Props = {
  title: string
  unit: string
  points: ChartPoint[]
  // 表・ツールチップでの日付表示
  formatX?: (x: string) => string
  // 値の表示桁
  digits?: number
  emptyText?: string
  note?: string
}

// 1系列の折れ線グラフ。色はダークテーマ用に検証済みの系列色（dataviz既定パレットのslot1・dark）
const SERIES = '#3987e5'
const SURFACE = '#252b37'
// 描画幅は表示幅に合わせる（縮小表示で文字が小さくならないよう、SVGの座標=実ピクセルにする）
const DEFAULT_WIDTH = 640
const HEIGHT = 220
const PAD = { top: 16, right: 52, bottom: 28, left: 44 }

function time(x: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(`${x}T00:00:00`).getTime() : new Date(x).getTime()
}

function shortDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function defaultFormatX(x: string): string {
  const d = new Date(time(x))
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// 目盛りを1・2・5の倍数にそろえる
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1
    min -= pad
    max += pad
  }
  const raw = (max - min) / count
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) || raw
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toFixed(10)))
  return ticks
}

export default function LineChart({ title, unit, points, formatX = defaultFormatX, digits = 1, emptyText = 'この期間のデータがありません', note }: Props): JSX.Element {
  const id = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [WIDTH, setWidth] = useState(DEFAULT_WIDTH)

  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      if (width > 0) setWidth(Math.max(260, width))
    })
    observer.observe(box)
    return () => observer.disconnect()
    // グラフ領域は値があるときだけ描画されるため、値の有無が変わったら監視し直す
  }, [points.length > 0])
  const [active, setActive] = useState<number | null>(null)
  const sorted = useMemo(() => [...points].sort((a, b) => time(a.x) - time(b.x)), [points])
  const format = (v: number) => v.toLocaleString('ja-JP', { maximumFractionDigits: digits })

  const geometry = useMemo(() => {
    if (sorted.length === 0) return null
    const xs = sorted.map((p) => time(p.x))
    const ys = sorted.map((p) => p.y)
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys))
    const yMin = ticks[0]
    const yMax = ticks[ticks.length - 1]
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    const innerW = WIDTH - PAD.left - PAD.right
    const innerH = HEIGHT - PAD.top - PAD.bottom
    const sx = (x: number) => PAD.left + (xMax === xMin ? innerW / 2 : ((x - xMin) / (xMax - xMin)) * innerW)
    const sy = (y: number) => PAD.top + (yMax === yMin ? innerH / 2 : (1 - (y - yMin) / (yMax - yMin)) * innerH)
    const coords = sorted.map((p) => ({ cx: sx(time(p.x)), cy: sy(p.y) }))
    const xTickCount = Math.min(WIDTH < 420 ? 3 : 4, sorted.length)
    const xTicks = xMax === xMin ? [xMin] : Array.from({ length: xTickCount }, (_, i) => xMin + ((xMax - xMin) * i) / Math.max(1, xTickCount - 1))
    return { ticks, coords, sx, sy, xTicks }
  }, [sorted, WIDTH])

  function nearest(clientX: number): number | null {
    if (!geometry || !svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * WIDTH
    let best = 0
    geometry.coords.forEach((c, i) => { if (Math.abs(c.cx - x) < Math.abs(geometry.coords[best].cx - x)) best = i })
    return best
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (sorted.length === 0) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      setActive((current) => Math.max(0, Math.min(sorted.length - 1, (current ?? (step > 0 ? -1 : sorted.length)) + step)))
    } else if (event.key === 'Home') setActive(0)
    else if (event.key === 'End') setActive(sorted.length - 1)
    else if (event.key === 'Escape') setActive(null)
  }

  const last = sorted[sorted.length - 1]
  const activePoint = active === null ? null : sorted[active]
  const activeCoord = active === null || !geometry ? null : geometry.coords[active]
  const showMarkers = sorted.length <= 40

  return (
    <figure className="m-0" aria-label={`${title}の推移グラフ`}>
      <figcaption id={`${id}-title`} className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-gray-100">{title}<span className="ml-1 text-sm font-normal text-gray-300">({unit})</span></span>
        {last && <span className="text-sm text-gray-300">最新 <strong className="text-gray-100">{format(last.y)}</strong> {unit}（{formatX(last.x)}）</span>}
      </figcaption>
      {note && <p className="mb-2 text-xs text-gray-300">{note}</p>}

      {!geometry && <div className="rounded-lg bg-black/20 p-4 text-sm text-gray-300">{emptyText}</div>}

      {geometry && (
        <div ref={boxRef} className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full touch-none select-none rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            role="img"
            aria-label={`${title}の推移（${sorted.length}件）。左右の矢印キーで各値を確認できます`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerMove={(e) => setActive(nearest(e.clientX))}
            onPointerDown={(e) => setActive(nearest(e.clientX))}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
          >
            {geometry.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={geometry.sy(t)} y2={geometry.sy(t)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                <text x={PAD.left - 8} y={geometry.sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#d1d5db">{format(t)}</text>
              </g>
            ))}
            {geometry.xTicks.map((t, i) => (
              <text key={i} x={geometry.sx(t)} y={HEIGHT - 8} textAnchor={geometry.xTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === geometry.xTicks.length - 1 ? 'end' : 'middle'} fontSize={11} fill="#d1d5db">{shortDate(t)}</text>
            ))}
            {sorted.length > 1 && (
              <polyline
                points={geometry.coords.map((c) => `${c.cx},${c.cy}`).join(' ')}
                fill="none"
                stroke={SERIES}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {(showMarkers || sorted.length === 1) && geometry.coords.map((c, i) => (
              <circle key={i} cx={c.cx} cy={c.cy} r={4} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
            ))}
            {/* 最新値を線の右端に直接表示する */}
            <text
              x={geometry.coords[geometry.coords.length - 1].cx + 8}
              y={geometry.coords[geometry.coords.length - 1].cy}
              dy="0.32em"
              fontSize={12}
              fontWeight={600}
              fill="#f3f4f6"
            >
              {format(last.y)}
            </text>
            {activeCoord && (
              <g pointerEvents="none">
                <line x1={activeCoord.cx} x2={activeCoord.cx} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
                <circle cx={activeCoord.cx} cy={activeCoord.cy} r={5} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
              </g>
            )}
          </svg>
          {activePoint && activeCoord && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 z-10 rounded-md bg-gray-900/95 px-3 py-2 text-sm text-gray-100 shadow-lg ring-1 ring-white/20"
              style={activeCoord.cx / WIDTH > 0.6
                ? { right: `${(1 - activeCoord.cx / WIDTH) * 100}%`, marginRight: 8 }
                : { left: `${(activeCoord.cx / WIDTH) * 100}%`, marginLeft: 8 }}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-0.5 w-3" style={{ background: SERIES }} />
                <strong>{format(activePoint.y)} {unit}</strong>
              </div>
              <div className="text-xs text-gray-300">{formatX(activePoint.x)}</div>
            </div>
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <details className="mt-2 text-sm text-gray-200">
          <summary className="cursor-pointer text-indigo-300 hover:text-indigo-200">数値一覧を表示（{sorted.length}件）</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-lg ring-1 ring-white/10">
            <table className="min-w-full text-left">
              <caption className="sr-only">{title}の数値一覧</caption>
              <thead><tr className="bg-black/20 text-gray-300"><th scope="col" className="px-3 py-1">日付</th><th scope="col" className="px-3 py-1 text-right">{title}({unit})</th></tr></thead>
              <tbody>
                {[...sorted].reverse().map((p, i) => (
                  <tr key={i} className="border-t border-white/10"><td className="px-3 py-1">{formatX(p.x)}</td><td className="px-3 py-1 text-right tabular-nums">{format(p.y)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  )
}
