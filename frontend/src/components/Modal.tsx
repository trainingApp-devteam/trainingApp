import React, { useEffect, useId } from 'react'

type Props = {
  open: boolean
  title?: string
  onClose?: () => void
  children?: React.ReactNode
}

export const Modal: React.FC<Props> = ({ open, title, onClose, children }) => {
  const titleId = useId()

  // Escキーで閉じる
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-50 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-gray-800 p-4 text-gray-100 shadow-xl ring-1 ring-white/10"
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 id={titleId} className="text-lg font-medium">{title}</h3>
          <button type="button" className="text-gray-200 hover:text-white" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export default Modal
