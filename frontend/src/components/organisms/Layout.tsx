/**
 * Main Layout Component
 * Provides consistent layout with sidebar navigation and top bar
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../atoms'
import Sidebar from './Sidebar'
import { useLanguage, useTheme, useAuth } from '../../contexts'

interface LayoutProps {
    children: React.ReactNode
    title?: string
    subtitle?: string
}

const Layout: React.FC<LayoutProps> = ({ children, title, subtitle }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { language, toggleLanguage, t } = useLanguage()
    const { toggleTheme, isLight } = useTheme()
    const { user } = useAuth()

    // Get sidebar collapsed state from localStorage
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed')
        return saved ? JSON.parse(saved) : false
    })

    // Listen for sidebar collapse changes
    useEffect(() => {
        const handleStorageChange = () => {
            const saved = localStorage.getItem('sidebarCollapsed')
            setSidebarCollapsed(saved ? JSON.parse(saved) : false)
        }

        // Check periodically for changes (localStorage doesn't have a reliable event across same-page updates)
        const interval = setInterval(handleStorageChange, 100)
        return () => clearInterval(interval)
    }, [])

    // Sidebar width based on collapsed state
    const sidebarWidth = sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'

    return (
        <div className={`min-h-screen ${isLight ? 'bg-slate-50' : 'bg-dark-950'}`}>
            {/* Sidebar - Fixed position */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Content Area - Offset by sidebar width */}
            <div className={`min-h-screen flex flex-col transition-all duration-300 ${sidebarWidth}`}>
                {/* Top Bar */}
                <header className={`
                    sticky top-0 z-30 h-16 flex items-center justify-between px-4 lg:px-6
                    border-b backdrop-blur-md
                    ${isLight
                        ? 'bg-white/80 border-gray-200'
                        : 'bg-dark-900/80 border-dark-700'
                    }
                `}>
                    {/* Left: Menu button + Title */}
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className={`
                                lg:hidden p-2 rounded-lg transition-colors
                                ${isLight
                                    ? 'hover:bg-gray-100 text-gray-600'
                                    : 'hover:bg-dark-800 text-dark-300'
                                }
                            `}
                        >
                            <Icon name="menu" size="md" />
                        </button>

                        {/* Page Title */}
                        {title && (
                            <div>
                                <h1 className={`text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                    {title}
                                </h1>
                                {subtitle && (
                                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Quick Actions */}
                    <div className="flex items-center gap-2">
                        {/* Auth Buttons */}
                        {user ? (
                            <Link
                                to="/profile"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${isLight
                                    ? 'hover:bg-gray-100 text-gray-700'
                                    : 'hover:bg-dark-700 text-gray-200'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isLight ? 'bg-primary-100 text-primary-600' : 'bg-primary-900/30 text-primary-400'}`}>
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="hidden sm:inline font-medium">{user.username}</span>
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className={`px-4 py-2 rounded-lg font-medium text-white shadow-lg shadow-primary-500/20 transition-all bg-gradient-to-r from-primary-500 to-secondary-500 hover:shadow-primary-500/40`}
                            >
                                Login
                            </Link>
                        )}

                        {/* Language Toggle */}
                        <button
                            onClick={toggleLanguage}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
                                ${isLight
                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    : 'bg-dark-700 hover:bg-dark-600 text-dark-300'
                                }
                            `}
                            title={t('nav.language')}
                        >
                            <Icon name="translate" size="sm" />
                            <span className="text-sm font-medium hidden sm:inline">
                                {language === 'th' ? 'ไทย' : 'EN'}
                            </span>
                        </button>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
                                ${isLight
                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    : 'bg-dark-700 hover:bg-dark-600 text-dark-300'
                                }
                            `}
                            title={t('nav.theme')}
                        >
                            <Icon name={isLight ? 'dark_mode' : 'light_mode'} size="sm" />
                            <span className="text-sm font-medium hidden sm:inline">
                                {isLight ? t('nav.dark') : t('nav.light')}
                            </span>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    )
}

export default Layout

