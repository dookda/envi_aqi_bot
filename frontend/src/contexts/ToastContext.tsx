/**
 * Toast Context for global toast notifications
 *
 * Usage:
 *   const { toast } = useToast()
 *   toast.success('Operation completed!')
 *   toast.error('Something went wrong')
 *   toast.warning('Please check your input')
 *   toast.info('New data available')
 */
import { createContext, useContext, useState, useCallback } from 'react'
import type { Toast, ToastContextType, Variant } from '@/types'
import { ToastContainer } from '../components/atoms/Toast'

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let toastId = 0

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, variant: Variant = 'info', duration = 4000): number => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, variant, duration }])
    return id
  }, [])

  const toast: ToastContextType['toast'] = {
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    error: (message: string, duration?: number) => addToast(message, 'danger', duration),
    warning: (message: string, duration?: number) => addToast(message, 'warning', duration),
    info: (message: string, duration?: number) => addToast(message, 'info', duration),
    // Generic method
    show: addToast,
    // Remove a specific toast
    dismiss: removeToast,
    // Clear all toasts
    clear: () => setToasts([]),
  }

  return (
    <ToastContext.Provider value={{ toast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
