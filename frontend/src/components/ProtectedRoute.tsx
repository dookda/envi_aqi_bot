/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from './atoms'

interface ProtectedRouteProps {
    children: React.ReactNode
    requireAdmin?: boolean
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
    const { isAuthenticated, isLoading, user } = useAuth()
    const location = useLocation()

    // Show loading spinner while checking auth status
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-900">
                <div className="text-center">
                    <Spinner size="xl" />
                    <p className="mt-4 text-dark-300">กำลังตรวจสอบสิทธิ์...</p>
                </div>
            </div>
        )
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        // Save the attempted URL for redirecting after login
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Check admin role if required
    if (requireAdmin && user?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-900">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                    <p className="text-dark-300 mb-4">คุณต้องเป็นผู้ดูแลระบบเพื่อเข้าถึงหน้านี้</p>
                    <p className="text-dark-400 text-sm">Access Denied - Admin privileges required</p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}

export default ProtectedRoute
