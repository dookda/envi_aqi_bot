/**
 * Toast Component
 * A lightweight notification toast that auto-dismisses
 */
import { useEffect, useState } from 'react'
import type { Toast as ToastType, Variant } from '@/types'
import { useTheme } from '../../contexts'
import Icon from './Icon'

interface VariantConfig {
  icon: string
  bgLight: string
  bgDark: string
  iconColor: string
  textLight: string
  textDark: string
}

const VARIANTS: Record<Variant, VariantConfig> = {
  success: {
    icon: 'check_circle',
    bgLight: 'bg-emerald-50 border-emerald-200',
    bgDark: 'bg-emerald-900/30 border-emerald-500/30',
    iconColor: 'text-emerald-500',
    textLight: 'text-emerald-800',
    textDark: 'text-emerald-200',
  },
  danger: {
    icon: 'error',
    bgLight: 'bg-red-50 border-red-200',
    bgDark: 'bg-red-900/30 border-red-500/30',
    iconColor: 'text-red-500',
    textLight: 'text-red-800',
    textDark: 'text-red-200',
  },
  warning: {
    icon: 'warning',
    bgLight: 'bg-amber-50 border-amber-200',
    bgDark: 'bg-amber-900/30 border-amber-500/30',
    iconColor: 'text-amber-500',
    textLight: 'text-amber-800',
    textDark: 'text-amber-200',
  },
  info: {
    icon: 'info',
    bgLight: 'bg-blue-50 border-blue-200',
    bgDark: 'bg-blue-900/30 border-blue-500/30',
    iconColor: 'text-blue-500',
    textLight: 'text-blue-800',
    textDark: 'text-blue-200',
  },
  primary: {
    icon: 'info',
    bgLight: 'bg-blue-50 border-blue-200',
    bgDark: 'bg-blue-900/30 border-blue-500/30',
    iconColor: 'text-blue-500',
    textLight: 'text-blue-800',
    textDark: 'text-blue-200',
  },
  secondary: {
    icon: 'info',
    bgLight: 'bg-gray-50 border-gray-200',
    bgDark: 'bg-gray-900/30 border-gray-500/30',
    iconColor: 'text-gray-500',
    textLight: 'text-gray-800',
    textDark: 'text-gray-200',
  },
  light: {
    icon: 'info',
    bgLight: 'bg-gray-50 border-gray-200',
    bgDark: 'bg-gray-900/30 border-gray-500/30',
    iconColor: 'text-gray-500',
    textLight: 'text-gray-800',
    textDark: 'text-gray-200',
  },
  dark: {
    icon: 'info',
    bgLight: 'bg-gray-800 border-gray-700',
    bgDark: 'bg-gray-900/30 border-gray-500/30',
    iconColor: 'text-gray-300',
    textLight: 'text-gray-100',
    textDark: 'text-gray-200',
  },
  ghost: {
    icon: 'info',
    bgLight: 'bg-transparent border-gray-200',
    bgDark: 'bg-transparent border-gray-500/30',
    iconColor: 'text-gray-500',
    textLight: 'text-gray-800',
    textDark: 'text-gray-200',
  },
}

interface ToastProps {
  id: number
  message: string
  variant?: Variant
  duration?: number
  onClose?: (id: number) => void
}

const Toast: React.FC<ToastProps> = ({
  id,
  message,
  variant = 'info',
  duration = 4000,
  onClose,
}) => {
  const { isLight } = useTheme()
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const config = VARIANTS[variant] || VARIANTS.info

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })

    // Auto-dismiss
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => {
      onClose?.(id)
    }, 300) // Match animation duration
  }

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm
        transform transition-all duration-300 ease-out
        ${isLight ? config.bgLight : config.bgDark}
        ${isVisible && !isLeaving
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'}
      `}
      role="alert"
    >
      <Icon
        name={config.icon}
        size="md"
        className={config.iconColor}
      />
      <p className={`flex-1 text-sm font-medium ${isLight ? config.textLight : config.textDark}`}>
        {message}
      </p>
      <button
        onClick={handleClose}
        className={`
          p-1 rounded-lg transition-colors
          ${isLight
            ? 'hover:bg-black/5 text-gray-500'
            : 'hover:bg-white/10 text-gray-400'}
        `}
        aria-label="Close notification"
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  )
}

export default Toast

/**
 * Toast Container - renders all active toasts
 */
interface ToastContainerProps {
  toasts: ToastType[]
  onClose: (id: number) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onClose={onClose} />
        </div>
      ))}
    </div>
  )
}
