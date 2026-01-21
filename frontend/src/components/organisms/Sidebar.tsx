/**
 * Sidebar Navigation Component
 * Clean, modern sidebar with collapse to icon-only mode
 * Support for collapsible menu groups
 * Protected routes show lock icon for unauthenticated users
 */
import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../atoms'
import { useLanguage, useTheme, useAuth } from '../../contexts'

interface NavItem {
    id: string
    path: string
    icon: string
    labelEn: string
    labelTh: string
    badge?: string
    badgeColor?: string
    requiresAuth?: boolean
    requiresAdmin?: boolean
}

interface NavGroup {
    id: string
    labelEn: string
    labelTh: string
    icon?: string
    items: NavItem[]
    defaultOpen?: boolean
    requiresAuth?: boolean
}

// Navigation structure - grouped for clarity
const NAV_GROUPS: NavGroup[] = [
    {
        id: 'main',
        labelEn: 'Main',
        labelTh: 'หน้าหลัก',
        icon: 'home',
        defaultOpen: true,
        items: [
            { id: 'dashboard', path: '/', icon: 'dashboard', labelEn: 'Dashboard', labelTh: 'แดชบอร์ด' },
            { id: 'executive-summary', path: '/executive-summary', icon: 'summarize', labelEn: 'Executive Summary', labelTh: 'สรุปผู้บริหาร', requiresAuth: true },
            { id: 'cctv', path: '/cctv', icon: 'videocam', labelEn: 'CCTV Monitor', labelTh: 'กล้อง CCTV' },
        ]
    },
    {
        id: 'ai',
        labelEn: 'AI Chatbot',
        labelTh: 'AI Chatbot',
        icon: 'smart_toy',
        defaultOpen: true,
        requiresAuth: true,
        items: [
            { id: 'chat', path: '/chat', icon: 'smart_toy', labelEn: 'Model A', labelTh: 'Model A', badge: 'Local', requiresAuth: true },
            { id: 'claude', path: '/chat/claude', icon: 'psychology', labelEn: 'Model B', labelTh: 'Model B', badge: 'Pro', badgeColor: 'purple', requiresAuth: true },
        ]
    },
    {
        id: 'analytics',
        labelEn: 'Analytics',
        labelTh: 'วิเคราะห์',
        icon: 'analytics',
        defaultOpen: true,
        requiresAuth: true,
        items: [
            { id: 'models', path: '/models', icon: 'model_training', labelEn: 'Models', labelTh: 'โมเดล', requiresAuth: true },
        ]
    },
    {
        id: 'admin',
        labelEn: 'Settings',
        labelTh: 'ตั้งค่า',
        icon: 'settings',
        defaultOpen: false,
        requiresAuth: true,
        items: [
            { id: 'prepare', path: '/prepare-data', icon: 'edit_note', labelEn: 'Data Preparation', labelTh: 'เตรียมข้อมูล', requiresAuth: true },
            { id: 'upload', path: '/upload', icon: 'cloud_upload', labelEn: 'Data Upload', labelTh: 'อัปโหลดข้อมูล', requiresAuth: true },
            { id: 'stations', path: '/stations', icon: 'location_on', labelEn: 'Stations', labelTh: 'จัดการสถานี', requiresAuth: true },
            { id: 'users', path: '/users', icon: 'group', labelEn: 'Users & LINE', labelTh: 'ผู้ใช้และ LINE', requiresAuth: true, requiresAdmin: true },
            { id: 'admin', path: '/admin', icon: 'admin_panel_settings', labelEn: 'Admin', labelTh: 'ผู้ดูแล', requiresAuth: true, requiresAdmin: true },
        ]
    },
    {
        id: 'guide',
        labelEn: 'Guide',
        labelTh: 'คู่มือ',
        icon: 'help',
        defaultOpen: false,
        items: [
            { id: 'info', path: '/info', icon: 'menu_book', labelEn: 'Methods & Statistics', labelTh: 'วิธีการและสถิติ' },
        ]
    }
]

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const { lang } = useLanguage()
    const { isLight } = useTheme()
    const { isAuthenticated, user } = useAuth()

    // Collapsed state - persisted in localStorage
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed')
        return saved ? JSON.parse(saved) : false
    })

    // Expanded groups state - persisted in localStorage
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('sidebarExpandedGroups')
        if (saved) {
            return JSON.parse(saved)
        }
        // Default open state from NAV_GROUPS
        const defaults: Record<string, boolean> = {}
        NAV_GROUPS.forEach(group => {
            defaults[group.id] = group.defaultOpen ?? true
        })
        return defaults
    })

    // Hovered item for tooltip in collapsed mode
    const [hoveredItem, setHoveredItem] = useState<string | null>(null)
    const [hoveredGroup, setHoveredGroup] = useState<string | null>(null)

    // Save collapsed state to localStorage
    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed))
    }, [isCollapsed])

    // Save expanded groups state to localStorage
    useEffect(() => {
        localStorage.setItem('sidebarExpandedGroups', JSON.stringify(expandedGroups))
    }, [expandedGroups])

    // Auto-expand group if current path is in it
    useEffect(() => {
        NAV_GROUPS.forEach(group => {
            const hasActiveItem = group.items.some(item => isActive(item.path))
            if (hasActiveItem && !expandedGroups[group.id]) {
                setExpandedGroups(prev => ({ ...prev, [group.id]: true }))
            }
        })
    }, [location.pathname])

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/'
        return location.pathname.startsWith(path)
    }

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed)
    }

    const toggleGroup = (groupId: string) => {
        if (isCollapsed) return // Don't toggle when sidebar is collapsed
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }))
    }

    // Check if any item in group is active
    const isGroupActive = (group: NavGroup) => {
        return group.items.some(item => isActive(item.path))
    }

    // Check if user can access a protected route
    const canAccess = (item: NavItem | NavGroup) => {
        if (!item.requiresAuth) return true
        if (!isAuthenticated) return false
        if ('requiresAdmin' in item && item.requiresAdmin && user?.role !== 'admin') return false
        return true
    }

    // Handle click on protected item
    const handleProtectedClick = (e: React.MouseEvent, item: NavItem) => {
        if (!canAccess(item)) {
            e.preventDefault()
            navigate('/login', { state: { from: { pathname: item.path } } })
        }
    }

    // Sidebar width based on collapsed state
    const sidebarWidth = isCollapsed ? 'w-20' : 'w-64'

    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 z-40 h-screen ${sidebarWidth}
                transform transition-all duration-300 ease-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
                flex flex-col
                ${isLight
                    ? 'bg-white border-r border-gray-200'
                    : 'bg-dark-900 border-r border-dark-700'
                }
            `}>
                {/* Logo / Brand */}
                <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-5'} border-b ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0`}>
                        <img
                            src="/app_logo.png"
                            alt="Envir AI Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <h1 className={`font-bold truncate ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                Envir AI
                            </h1>
                            <p className={`text-xs truncate ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ระบบจัดการข้อมูลคุณภาพอากาศ' : 'Air Quality Data Management System'}
                            </p>
                        </div>
                    )}
                    {/* Close button for mobile */}
                    {!isCollapsed && (
                        <button
                            onClick={onClose}
                            className={`lg:hidden p-2 rounded-lg flex-shrink-0 ${isLight ? 'hover:bg-gray-100' : 'hover:bg-dark-800'}`}
                        >
                            <Icon name="close" size="sm" />
                        </button>
                    )}
                </div>

                {/* Navigation - Scrollable */}
                <nav className={`
                    flex-1 min-h-0 overflow-y-auto py-4 scrollbar-thin
                    ${isCollapsed ? 'px-2' : 'px-3'}
                `}>
                    {NAV_GROUPS.map((group) => {
                        const isExpanded = expandedGroups[group.id] ?? true
                        const groupActive = isGroupActive(group)

                        return (
                            <div key={group.id} className="mb-2">
                                {/* Group Header - Collapsible */}
                                {!isCollapsed ? (
                                    <button
                                        onClick={() => toggleGroup(group.id)}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-2 mb-1 rounded-lg
                                            transition-all duration-200 group
                                            ${groupActive
                                                ? isLight
                                                    ? 'bg-primary-50 text-primary-700'
                                                    : 'bg-primary-900/20 text-primary-400'
                                                : isLight
                                                    ? 'hover:bg-gray-100 text-gray-600'
                                                    : 'hover:bg-dark-800 text-dark-400'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            {group.icon && (
                                                <Icon
                                                    name={group.icon}
                                                    size="sm"
                                                    className={groupActive ? '' : isLight ? 'text-gray-400' : 'text-dark-500'}
                                                />
                                            )}
                                            <span className={`text-xs font-semibold uppercase tracking-wider`}>
                                                {lang === 'th' ? group.labelTh : group.labelEn}
                                            </span>
                                            {/* Lock icon for protected groups */}
                                            {group.requiresAuth && !isAuthenticated && (
                                                <Icon
                                                    name="lock"
                                                    size="xs"
                                                    className={isLight ? 'text-gray-400' : 'text-dark-500'}
                                                />
                                            )}
                                        </div>
                                        <Icon
                                            name={isExpanded ? 'expand_less' : 'expand_more'}
                                            size="sm"
                                            className={`transition-transform duration-200 ${isLight ? 'text-gray-400' : 'text-dark-500'
                                                }`}
                                        />
                                    </button>
                                ) : (
                                    /* Divider when collapsed */
                                    group.id !== 'main' && (
                                        <div className={`h-px mx-2 mb-3 ${isLight ? 'bg-gray-200' : 'bg-dark-700'}`} />
                                    )
                                )}

                                {/* Navigation Items - Animated collapse */}
                                <div className={`
                                    overflow-hidden transition-all duration-300 ease-in-out
                                    ${isCollapsed || isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                                `}>
                                    <ul className="space-y-1">
                                        {group.items.map((item) => {
                                            const active = isActive(item.path)
                                            return (
                                                <li
                                                    key={item.id}
                                                    className="relative"
                                                    onMouseEnter={() => isCollapsed && setHoveredItem(item.id)}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                >
                                                    <Link
                                                        to={item.path}
                                                        onClick={(e) => {
                                                            handleProtectedClick(e, item)
                                                            if (canAccess(item)) onClose()
                                                        }}
                                                        className={`
                                                            flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} 
                                                            ${isCollapsed ? 'px-2 py-2.5' : 'px-3 py-2.5 ml-2'} rounded-xl
                                                            transition-all duration-200 group
                                                            ${active
                                                                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                                                                : !canAccess(item)
                                                                    ? isLight
                                                                        ? 'text-gray-400 hover:bg-gray-100'
                                                                        : 'text-dark-500 hover:bg-dark-800'
                                                                    : isLight
                                                                        ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                                                        : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                                                            }
                                                        `}
                                                        title={isCollapsed
                                                            ? `${lang === 'th' ? item.labelTh : item.labelEn}${!canAccess(item) ? ' 🔒' : ''}`
                                                            : undefined
                                                        }
                                                    >
                                                        <div className={`
                                                            ${isCollapsed ? 'w-10 h-10' : 'w-8 h-8'} rounded-lg flex items-center justify-center
                                                            transition-colors duration-200 flex-shrink-0
                                                            ${active
                                                                ? 'bg-white/20 text-white'
                                                                : isLight
                                                                    ? 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                                                                    : 'bg-dark-700 text-dark-400 group-hover:bg-dark-600'
                                                            }
                                                        `}>
                                                            <Icon name={item.icon} size={isCollapsed ? 'md' : 'sm'} />
                                                        </div>
                                                        {!isCollapsed && (
                                                            <>
                                                                <span className="flex-1 font-medium text-sm truncate">
                                                                    {lang === 'th' ? item.labelTh : item.labelEn}
                                                                </span>
                                                                {/* Lock icon for protected routes */}
                                                                {!canAccess(item) && (
                                                                    <Icon
                                                                        name="lock"
                                                                        size="xs"
                                                                        className={isLight ? 'text-gray-400' : 'text-dark-500'}
                                                                    />
                                                                )}
                                                                {item.badge && canAccess(item) && (
                                                                    <span className={`
                                                                        text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0
                                                                        ${active
                                                                            ? 'bg-white/20 text-white'
                                                                            : item.badgeColor === 'purple'
                                                                                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                                                                : 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                                                                        }
                                                                    `}>
                                                                        {item.badge}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </Link>

                                                    {/* Tooltip for collapsed mode */}
                                                    {isCollapsed && hoveredItem === item.id && (
                                                        <div className={`
                                                            absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
                                                            px-3 py-2 rounded-lg shadow-lg whitespace-nowrap
                                                            ${isLight ? 'bg-gray-800 text-white' : 'bg-dark-700 text-white'}
                                                            animate-fadeIn
                                                        `}>
                                                            <div className={`
                                                                absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1
                                                                w-2 h-2 rotate-45
                                                                ${isLight ? 'bg-gray-800' : 'bg-dark-700'}
                                                            `} />
                                                            <span className="text-sm font-medium">
                                                                {lang === 'th' ? item.labelTh : item.labelEn}
                                                            </span>
                                                            {item.badge && (
                                                                <span className={`
                                                                    ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                                                                    ${item.badgeColor === 'purple'
                                                                        ? 'bg-purple-500/30 text-purple-300'
                                                                        : 'bg-primary-500/30 text-primary-300'
                                                                    }
                                                                `}>
                                                                    {item.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            </div>
                        )
                    })}
                </nav>

                {/* Collapse Toggle Button */}
                <div className={`hidden lg:flex ${isCollapsed ? 'justify-center' : 'justify-end'} px-3 py-2`}>
                    <button
                        onClick={toggleCollapse}
                        className={`
                            p-2 rounded-lg transition-all duration-200
                            ${isLight
                                ? 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                                : 'hover:bg-dark-800 text-dark-400 hover:text-white'
                            }
                        `}
                        title={isCollapsed
                            ? (lang === 'th' ? 'ขยายเมนู' : 'Expand sidebar')
                            : (lang === 'th' ? 'ย่อเมนู' : 'Collapse sidebar')
                        }
                    >
                        <Icon
                            name={isCollapsed ? 'chevron_right' : 'chevron_left'}
                            size="sm"
                        />
                    </button>
                </div>

                {/* Footer - User Status */}
                <div className={`p-3 border-t ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                    {isAuthenticated && user ? (
                        // Logged in user
                        isCollapsed ? (
                            // Collapsed - avatar only
                            <div
                                className={`
                                    flex justify-center items-center p-2 rounded-xl cursor-pointer
                                    ${isLight ? 'bg-gray-50 hover:bg-gray-100' : 'bg-dark-800 hover:bg-dark-700'}
                                `}
                                onClick={() => navigate('/profile')}
                                title={user.username}
                            >
                                <div className="relative">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isLight ? 'bg-primary-100' : 'bg-primary-900/30'}`}>
                                        <span className="text-primary-500 font-semibold text-sm">
                                            {user.username?.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-dark-800" />
                                </div>
                            </div>
                        ) : (
                            // Expanded - full user info
                            <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-gray-50' : 'bg-dark-800'}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-primary-100' : 'bg-primary-900/30'}`}>
                                    <span className="text-primary-500 font-semibold">
                                        {user.username?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                        {user.full_name || user.username}
                                    </p>
                                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1 ${user.role === 'admin'
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300'
                                            }`}>
                                            {user.role === 'admin' ? '👑 Admin' : 'User'}
                                        </span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        localStorage.removeItem('token')
                                        window.location.href = '/'
                                    }}
                                    className={`p-2 rounded-lg ${isLight ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-dark-700 text-dark-400'}`}
                                    title={lang === 'th' ? 'ออกจากระบบ' : 'Logout'}
                                >
                                    <Icon name="logout" size="sm" />
                                </button>
                            </div>
                        )
                    ) : (
                        // Not logged in - show login button
                        isCollapsed ? (
                            <Link
                                to="/login"
                                className={`
                                    flex justify-center items-center p-2 rounded-xl
                                    ${isLight ? 'bg-gray-50 hover:bg-gray-100' : 'bg-dark-800 hover:bg-dark-700'}
                                `}
                                title={lang === 'th' ? 'เข้าสู่ระบบ' : 'Login'}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isLight ? 'bg-gray-200' : 'bg-dark-700'}`}>
                                    <Icon name="login" size="sm" className={isLight ? 'text-gray-500' : 'text-dark-400'} />
                                </div>
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-gray-50 hover:bg-gray-100' : 'bg-dark-800 hover:bg-dark-700'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-gray-200' : 'bg-dark-700'}`}>
                                    <Icon name="login" size="sm" className={isLight ? 'text-gray-500' : 'text-dark-400'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                        {lang === 'th' ? 'เข้าสู่ระบบ' : 'Login'}
                                    </p>
                                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                        {lang === 'th' ? 'เพื่อเข้าถึงฟีเจอร์ทั้งหมด' : 'Access all features'}
                                    </p>
                                </div>
                                <Icon name="arrow_forward" size="sm" className={isLight ? 'text-gray-400' : 'text-dark-500'} />
                            </Link>
                        )
                    )}
                </div>
            </aside>
        </>
    )
}

export default Sidebar
