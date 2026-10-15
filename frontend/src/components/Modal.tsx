import React from 'react'

type Props = {
  open: boolean
  title?: string
  onClose?: () => void
  children?: React.ReactNode
}

export const Modal: React.FC<Props> = ({ open, title, onClose, children }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-w-lg w-full p-4 z-50 rounded-2xl bg-gray-800 text-gray-100 shadow-xl ring-1 ring-white/10">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium">{title}</h3>
          <button className="text-gray-200 hover:text-white" onClick={onClose} aria-label="close">✕</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}

export default Modal
