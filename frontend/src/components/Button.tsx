import React from 'react'
import { ui } from '../styles/ui'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export const Button: React.FC<Props> = ({ variant = 'primary', className = '', children, ...rest }) => {
  const variantCls = variant === 'primary' ? ui.btnPrimary : ui.btnSecondary
  return (
    <button className={`${variantCls} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export default Button