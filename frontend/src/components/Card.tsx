import React from 'react'
import { ui } from '../styles/ui'

type Props = {
  className?: string
  children?: React.ReactNode
}

export const Card: React.FC<Props> = ({ children, className = '' }) => {
  return <div className={`${ui.card} ${className}`}>{children}</div>
}

export default Card