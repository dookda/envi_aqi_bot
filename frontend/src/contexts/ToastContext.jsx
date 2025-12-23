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
import { ToastContainer } from '../components/atoms/Toast'

const ToastContext = createContext()

let toastId = 0

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((message, variant = 'info', duration = 4000) => {
        const id = ++toastId
        setToasts(prev => [...prev, { id, message, variant, duration }])
        return id
    }, [])

    const toast = {
        success: (message, duration) => addToast(message, 'success', duration),
        error: (message, duration) => addToast(message, 'error', duration),
        warning: (message, duration) => addToast(message, 'warning', duration),
        info: (message, duration) => addToast(message, 'info', duration),
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

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}
