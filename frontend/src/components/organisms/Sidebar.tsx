/**
 * Sidebar Navigation Component
 * Clean, modern sidebar with collapse to icon-only mode
 * Support for collapsible menu groups
 */
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../atoms'
import { useLanguage, useTheme } from '../../contexts'

interface NavItem {
    id: string
    path: string
    icon: string
    labelEn: string
    labelTh: string
    badge?: string
    badgeColor?: string
}

interface NavGroup {
    id: string
    labelEn: string
    labelTh: string
    icon?: string
    items: NavItem[]
    defaultOpen?: boolean
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
            { id: 'executive-summary', path: '/executive-summary', icon: 'summarize', labelEn: 'Executive Summary', labelTh: 'สรุปผู้บริหาร' },
            { id: 'cctv', path: '/cctv', icon: 'videocam', labelEn: 'CCTV Monitor', labelTh: 'กล้อง CCTV' },
        ]
    },
    {
        id: 'ai',
        labelEn: 'AI Assistant',
        labelTh: 'ผู้ช่วย AI',
        icon: 'smart_toy',
        defaultOpen: true,
        items: [
            { id: 'chat', path: '/chat', icon: 'smart_toy', labelEn: 'Model A', labelTh: 'Model A', badge: 'Local' },
            { id: 'claude', path: '/chat/claude', icon: 'psychology', labelEn: 'Model B', labelTh: 'Model B', badge: 'Pro', badgeColor: 'purple' },
        ]
    },
    {
        id: 'analytics',
        labelEn: 'Analytics',
        labelTh: 'วิเคราะห์',
        icon: 'analytics',
        defaultOpen: true,
        items: [
            { id: 'models', path: '/models', icon: 'model_training', labelEn: 'Models', labelTh: 'โมเดล' },
        ]
    },
    {
        id: 'admin',
        labelEn: 'Settings',
        labelTh: 'ตั้งค่า',
        icon: 'settings',
        defaultOpen: false,
        items: [
            { id: 'prepare', path: '/prepare-data', icon: 'edit_note', labelEn: 'Data Preparation', labelTh: 'เตรียมข้อมูล' },
            { id: 'upload', path: '/upload', icon: 'cloud_upload', labelEn: 'Data Upload', labelTh: 'อัปโหลดข้อมูล' },
            { id: 'stations', path: '/stations', icon: 'location_on', labelEn: 'Stations', labelTh: 'จัดการสถานี' },
            { id: 'admin', path: '/admin', icon: 'admin_panel_settings', labelEn: 'Admin', labelTh: 'ผู้ดูแล' },
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
    const { lang } = useLanguage()
    const { isLight } = useTheme()

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
                ${isLight
                    ? 'bg-white border-r border-gray-200'
                    : 'bg-dark-900 border-r border-dark-700'
                }
            `}>
                {/* Logo / Brand */}
                <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-5'} border-b ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-600 flex-shrink-0`}>
                        <Icon name="air" size="sm" className="text-white" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <h1 className={`font-bold truncate ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                AQI Monitor
                            </h1>
                            <p className={`text-xs truncate ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ระบบตรวจวัดคุณภาพอากาศ' : 'Air Quality System'}
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

                {/* Navigation */}
                <nav className={`flex-1 overflow-y-auto py-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
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
                                                        onClick={onClose}
                                                        className={`
                                                            flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} 
                                                            ${isCollapsed ? 'px-2 py-2.5' : 'px-3 py-2.5 ml-2'} rounded-xl
                                                            transition-all duration-200 group
                                                            ${active
                                                                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                                                                : isLight
                                                                    ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                                                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                                                            }
                                                        `}
                                                        title={isCollapsed ? (lang === 'th' ? item.labelTh : item.labelEn) : undefined}
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
                                                                {item.badge && (
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

                {/* Footer */}
                <div className={`p-3 border-t ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                    {isCollapsed ? (
                        // Collapsed footer - just status indicator
                        <div className={`
                            flex justify-center items-center p-2 rounded-xl
                            ${isLight ? 'bg-gray-50' : 'bg-dark-800'}
                        `}>
                            <div className="relative">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isLight ? 'bg-primary-100' : 'bg-primary-900/30'}`}>
                                    <Icon name="eco" size="sm" className="text-primary-500" />
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-dark-800" />
                            </div>
                        </div>
                    ) : (
                        // Expanded footer
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-gray-50' : 'bg-dark-800'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-primary-100' : 'bg-primary-900/30'}`}>
                                <Icon name="eco" size="sm" className="text-primary-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium truncate ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                    {lang === 'th' ? 'สถานะระบบ' : 'System Status'}
                                </p>
                                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                                    {lang === 'th' ? 'ออนไลน์' : 'Online'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        </>
    )
}

export default Sidebar
