import React from 'react'
import { ui } from '../styles/ui'

type Props = {
  label: string
  className?: string
  children?: React.ReactNode
}

export const FormField: React.FC<Props> = ({ label, children, className = '' }) => {
  return (
    <label className={`block mb-4 ${className}`}>
      <div className={ui.label}>{label}</div>
      <div>{children}</div>
    </label>
  )
}

export default FormField