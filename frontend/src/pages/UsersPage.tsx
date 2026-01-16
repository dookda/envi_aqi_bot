/**
 * User Management Page
 * Manage users and their LINE notification settings
 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Icon, Button, Badge, Spinner } from '../components/atoms'
import { useLanguage, useTheme, useToast } from '../contexts'

interface User {
    id: number
    email: string
    username: string
    full_name: string | null
    role: string
    is_active: boolean
    line_user_id: string | null
    receive_notifications: boolean
    created_at: string | null
    last_login: string | null
}

interface UserFormData {
    email: string
    username: string
    full_name: string
    role: string
    is_active: boolean
    line_user_id: string
    receive_notifications: boolean
    password: string
}

const API_BASE = '/ebot/api'

export default function UsersPage(): React.ReactElement {
    const { lang } = useLanguage()
    const { isLight } = useTheme()
    const { toast } = useToast()

    // State
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState<string>('')
    const [lineFilter, setLineFilter] = useState<string>('')

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [formData, setFormData] = useState<UserFormData>({
        email: '',
        username: '',
        full_name: '',
        role: 'user',
        is_active: true,
        line_user_id: '',
        receive_notifications: true,
        password: ''
    })
    const [saving, setSaving] = useState(false)
    const [sendingTest, setSendingTest] = useState<number | null>(null)

    // Fetch users
    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append('search', search)
            if (roleFilter) params.append('role', roleFilter)
            if (lineFilter === 'with') params.append('has_line_id', 'true')
            if (lineFilter === 'without') params.append('has_line_id', 'false')

            const response = await fetch(`${API_BASE}/users?${params}`)
            if (!response.ok) throw new Error('Failed to fetch users')

            const data = await response.json()
            setUsers(data.users || [])
            setTotal(data.total || 0)
        } catch (error) {
            console.error('Error fetching users:', error)
            toast.error(lang === 'th' ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Error loading users')
        } finally {
            setLoading(false)
        }
    }, [search, roleFilter, lineFilter, lang, toast])

    useEffect(() => {
        fetchUsers()
    }, [fetchUsers])

    // Open modal for create/edit
    const openModal = (user?: User) => {
        if (user) {
            setEditingUser(user)
            setFormData({
                email: user.email,
                username: user.username,
                full_name: user.full_name || '',
                role: user.role,
                is_active: user.is_active,
                line_user_id: user.line_user_id || '',
                receive_notifications: user.receive_notifications,
                password: ''
            })
        } else {
            setEditingUser(null)
            setFormData({
                email: '',
                username: '',
                full_name: '',
                role: 'user',
                is_active: true,
                line_user_id: '',
                receive_notifications: true,
                password: ''
            })
        }
        setShowModal(true)
    }

    // Save user
    const handleSave = async () => {
        if (!formData.email || !formData.username) {
            toast.warning(lang === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all required fields')
            return
        }

        if (!editingUser && !formData.password) {
            toast.warning(lang === 'th' ? 'กรุณากรอกรหัสผ่าน' : 'Please enter a password')
            return
        }

        setSaving(true)
        try {
            const url = editingUser
                ? `${API_BASE}/users/${editingUser.id}`
                : `${API_BASE}/users`

            const body: Record<string, unknown> = { ...formData }
            if (!body.password) delete body.password
            if (!body.line_user_id) body.line_user_id = null

            const response = await fetch(url, {
                method: editingUser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Failed to save user')
            }

            toast.success(
                lang === 'th'
                    ? (editingUser ? 'อัปเดตผู้ใช้สำเร็จ' : 'เพิ่มผู้ใช้สำเร็จ')
                    : (editingUser ? 'User updated successfully' : 'User created successfully')
            )
            setShowModal(false)
            fetchUsers()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    // Delete user
    const handleDelete = async (user: User) => {
        if (!confirm(lang === 'th'
            ? `คุณต้องการลบผู้ใช้ "${user.username}" หรือไม่?`
            : `Are you sure you want to delete "${user.username}"?`
        )) return

        try {
            const response = await fetch(`${API_BASE}/users/${user.id}`, {
                method: 'DELETE'
            })

            if (!response.ok) throw new Error('Failed to delete user')

            toast.success(lang === 'th' ? 'ลบผู้ใช้สำเร็จ' : 'User deleted successfully')
            fetchUsers()
        } catch (error) {
            console.error('Error deleting user:', error)
            toast.error(lang === 'th' ? 'เกิดข้อผิดพลาดในการลบ' : 'Error deleting user')
        }
    }

    // Send test notification
    const handleTestNotification = async (user: User) => {
        if (!user.line_user_id) {
            toast.warning(lang === 'th' ? 'ผู้ใช้ไม่มี LINE User ID' : 'User has no LINE User ID')
            return
        }

        setSendingTest(user.id)
        try {
            const response = await fetch(`${API_BASE}/users/${user.id}/test-notification`, {
                method: 'POST'
            })

            if (!response.ok) throw new Error('Failed to send notification')

            toast.success(
                lang === 'th' ? 'ส่งการแจ้งเตือนทดสอบสำเร็จ' : 'Test notification sent successfully'
            )
        } catch (error) {
            console.error('Error sending test:', error)
            toast.error(lang === 'th' ? 'เกิดข้อผิดพลาด' : 'Error sending notification')
        } finally {
            setSendingTest(null)
        }
    }

    // Format date
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-gray-900'}`}>
            <main className="container mx-auto px-4 py-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className={`p-2 rounded-lg ${isLight ? 'bg-blue-100' : 'bg-blue-900/30'}`}>
                                <Icon name="group" size="md" className="text-blue-500" />
                            </div>
                            <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                {lang === 'th' ? 'จัดการผู้ใช้' : 'User Management'}
                            </h1>
                        </div>
                        <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                            {lang === 'th'
                                ? 'จัดการบัญชีผู้ใช้และ LINE User ID สำหรับการแจ้งเตือน'
                                : 'Manage user accounts and LINE User IDs for notifications'}
                        </p>
                    </div>
                    <Button onClick={() => openModal()} variant="primary">
                        <Icon name="add" size="sm" className="mr-2" />
                        {lang === 'th' ? 'เพิ่มผู้ใช้' : 'Add User'}
                    </Button>
                </div>

                {/* Filters */}
                <Card className="p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1">
                            <div className="relative">
                                <Icon
                                    name="search"
                                    size="sm"
                                    className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-gray-400' : 'text-dark-400'}`}
                                />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={lang === 'th' ? 'ค้นหาผู้ใช้...' : 'Search users...'}
                                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isLight
                                        ? 'bg-white border-gray-200 text-gray-900'
                                        : 'bg-dark-700 border-dark-600 text-white'
                                        } focus:outline-none focus:ring-2 focus:ring-primary-500`}
                                />
                            </div>
                        </div>

                        {/* Role Filter */}
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className={`px-4 py-2 rounded-lg border ${isLight
                                ? 'bg-white border-gray-200 text-gray-900'
                                : 'bg-dark-700 border-dark-600 text-white'
                                }`}
                        >
                            <option value="">{lang === 'th' ? 'ทุก Role' : 'All Roles'}</option>
                            <option value="admin">{lang === 'th' ? 'ผู้ดูแล' : 'Admin'}</option>
                            <option value="user">{lang === 'th' ? 'ผู้ใช้' : 'User'}</option>
                        </select>

                        {/* LINE Filter */}
                        <select
                            value={lineFilter}
                            onChange={(e) => setLineFilter(e.target.value)}
                            className={`px-4 py-2 rounded-lg border ${isLight
                                ? 'bg-white border-gray-200 text-gray-900'
                                : 'bg-dark-700 border-dark-600 text-white'
                                }`}
                        >
                            <option value="">{lang === 'th' ? 'LINE ID ทั้งหมด' : 'All LINE IDs'}</option>
                            <option value="with">{lang === 'th' ? 'มี LINE ID' : 'Has LINE ID'}</option>
                            <option value="without">{lang === 'th' ? 'ไม่มี LINE ID' : 'No LINE ID'}</option>
                        </select>
                    </div>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isLight ? 'bg-blue-100' : 'bg-blue-900/30'}`}>
                                <Icon name="people" className="text-blue-500" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {total}
                                </p>
                                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'ผู้ใช้ทั้งหมด' : 'Total Users'}
                                </p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isLight ? 'bg-green-100' : 'bg-green-900/30'}`}>
                                <Icon name="chat" className="text-green-500" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {users.filter(u => u.line_user_id).length}
                                </p>
                                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'เชื่อมต่อ LINE' : 'LINE Connected'}
                                </p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isLight ? 'bg-purple-100' : 'bg-purple-900/30'}`}>
                                <Icon name="admin_panel_settings" className="text-purple-500" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {users.filter(u => u.role === 'admin').length}
                                </p>
                                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'ผู้ดูแลระบบ' : 'Admins'}
                                </p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isLight ? 'bg-orange-100' : 'bg-orange-900/30'}`}>
                                <Icon name="notifications_active" className="text-orange-500" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {users.filter(u => u.receive_notifications && u.line_user_id).length}
                                </p>
                                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'รับการแจ้งเตือน' : 'Receiving Alerts'}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* User Table */}
                <Card className="overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <Spinner size="lg" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12">
                            <Icon name="person_off" size="xl" className={`mx-auto mb-4 ${isLight ? 'text-gray-300' : 'text-gray-600'}`} />
                            <p className={isLight ? 'text-gray-500' : 'text-gray-400'}>
                                {lang === 'th' ? 'ไม่พบผู้ใช้' : 'No users found'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className={isLight ? 'bg-gray-50' : 'bg-dark-800'}>
                                    <tr>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {lang === 'th' ? 'ผู้ใช้' : 'User'}
                                        </th>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            Role
                                        </th>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            LINE ID
                                        </th>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {lang === 'th' ? 'การแจ้งเตือน' : 'Notifications'}
                                        </th>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {lang === 'th' ? 'สร้างเมื่อ' : 'Created'}
                                        </th>
                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {lang === 'th' ? 'การดำเนินการ' : 'Actions'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-dark-700'}`}>
                                    {users.map((user) => (
                                        <tr key={user.id} className={isLight ? 'hover:bg-gray-50' : 'hover:bg-dark-800/50'}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'admin'
                                                        ? 'bg-purple-500'
                                                        : 'bg-blue-500'
                                                        }`}>
                                                        <span className="text-white font-semibold text-sm">
                                                            {user.username.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                                            {user.full_name || user.username}
                                                        </p>
                                                        <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    variant={user.role === 'admin' ? 'primary' : 'secondary'}
                                                    size="sm"
                                                >
                                                    {user.role === 'admin'
                                                        ? (lang === 'th' ? 'ผู้ดูแล' : 'Admin')
                                                        : (lang === 'th' ? 'ผู้ใช้' : 'User')
                                                    }
                                                </Badge>
                                                {!user.is_active && (
                                                    <Badge variant="danger" size="sm" className="ml-1">
                                                        {lang === 'th' ? 'ปิดใช้งาน' : 'Inactive'}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.line_user_id ? (
                                                    <div className="flex items-center gap-2">
                                                        <Icon name="chat" size="sm" className="text-green-500" />
                                                        <code className={`text-xs px-2 py-1 rounded ${isLight ? 'bg-gray-100' : 'bg-dark-700'}`}>
                                                            {user.line_user_id.substring(0, 10)}...
                                                        </code>
                                                    </div>
                                                ) : (
                                                    <span className={`text-sm ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {lang === 'th' ? 'ไม่ได้เชื่อมต่อ' : 'Not connected'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.line_user_id && user.receive_notifications ? (
                                                    <Badge variant="success" size="sm">
                                                        <Icon name="notifications_active" size="xs" className="mr-1" />
                                                        {lang === 'th' ? 'เปิด' : 'On'}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" size="sm">
                                                        <Icon name="notifications_off" size="xs" className="mr-1" />
                                                        {lang === 'th' ? 'ปิด' : 'Off'}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className={`px-4 py-3 text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {formatDate(user.created_at)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    {user.line_user_id && (
                                                        <button
                                                            onClick={() => handleTestNotification(user)}
                                                            disabled={sendingTest === user.id}
                                                            className={`p-2 rounded-lg transition-colors ${isLight
                                                                ? 'hover:bg-green-100 text-green-600'
                                                                : 'hover:bg-green-900/30 text-green-400'
                                                                }`}
                                                            title={lang === 'th' ? 'ทดสอบแจ้งเตือน' : 'Test notification'}
                                                        >
                                                            {sendingTest === user.id
                                                                ? <Spinner size="sm" />
                                                                : <Icon name="send" size="sm" />
                                                            }
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => openModal(user)}
                                                        className={`p-2 rounded-lg transition-colors ${isLight
                                                            ? 'hover:bg-blue-100 text-blue-600'
                                                            : 'hover:bg-blue-900/30 text-blue-400'
                                                            }`}
                                                        title={lang === 'th' ? 'แก้ไข' : 'Edit'}
                                                    >
                                                        <Icon name="edit" size="sm" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user)}
                                                        className={`p-2 rounded-lg transition-colors ${isLight
                                                            ? 'hover:bg-red-100 text-red-600'
                                                            : 'hover:bg-red-900/30 text-red-400'
                                                            }`}
                                                        title={lang === 'th' ? 'ลบ' : 'Delete'}
                                                    >
                                                        <Icon name="delete" size="sm" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className={`p-6 border-b ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                                <h2 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {editingUser
                                        ? (lang === 'th' ? 'แก้ไขผู้ใช้' : 'Edit User')
                                        : (lang === 'th' ? 'เพิ่มผู้ใช้ใหม่' : 'Add New User')
                                    }
                                </h2>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Username */}
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {lang === 'th' ? 'ชื่อผู้ใช้' : 'Username'} *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className={`w-full px-4 py-2 rounded-lg border ${isLight
                                            ? 'bg-white border-gray-200 text-gray-900'
                                            : 'bg-dark-700 border-dark-600 text-white'
                                            }`}
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {lang === 'th' ? 'อีเมล' : 'Email'} *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={`w-full px-4 py-2 rounded-lg border ${isLight
                                            ? 'bg-white border-gray-200 text-gray-900'
                                            : 'bg-dark-700 border-dark-600 text-white'
                                            }`}
                                    />
                                </div>

                                {/* Full Name */}
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {lang === 'th' ? 'ชื่อ-นามสกุล' : 'Full Name'}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        className={`w-full px-4 py-2 rounded-lg border ${isLight
                                            ? 'bg-white border-gray-200 text-gray-900'
                                            : 'bg-dark-700 border-dark-600 text-white'
                                            }`}
                                    />
                                </div>

                                {/* Password */}
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {lang === 'th' ? 'รหัสผ่าน' : 'Password'} {!editingUser && '*'}
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingUser ? (lang === 'th' ? 'เว้นว่างถ้าไม่เปลี่ยน' : 'Leave empty to keep current') : ''}
                                        className={`w-full px-4 py-2 rounded-lg border ${isLight
                                            ? 'bg-white border-gray-200 text-gray-900'
                                            : 'bg-dark-700 border-dark-600 text-white'
                                            }`}
                                    />
                                </div>

                                {/* Role */}
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        Role
                                    </label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className={`w-full px-4 py-2 rounded-lg border ${isLight
                                            ? 'bg-white border-gray-200 text-gray-900'
                                            : 'bg-dark-700 border-dark-600 text-white'
                                            }`}
                                    >
                                        <option value="user">{lang === 'th' ? 'ผู้ใช้' : 'User'}</option>
                                        <option value="admin">{lang === 'th' ? 'ผู้ดูแลระบบ' : 'Admin'}</option>
                                    </select>
                                </div>

                                {/* LINE User ID */}
                                <div className={`p-4 rounded-lg ${isLight ? 'bg-green-50 border border-green-200' : 'bg-green-900/20 border border-green-800'}`}>
                                    <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-green-800' : 'text-green-300'}`}>
                                        <Icon name="chat" size="sm" className="inline mr-1" />
                                        LINE User ID
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.line_user_id}
                                        onChange={(e) => setFormData({ ...formData, line_user_id: e.target.value })}
                                        placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                        className={`w-full px-4 py-2 rounded-lg border font-mono text-sm ${isLight
                                            ? 'bg-white border-green-200 text-gray-900'
                                            : 'bg-dark-700 border-green-800 text-white'
                                            }`}
                                    />
                                    <p className={`text-xs mt-1 ${isLight ? 'text-green-600' : 'text-green-400'}`}>
                                        {lang === 'th'
                                            ? 'รับ User ID จากการส่งข้อความหา Bot แล้วดูใน Log'
                                            : 'Get User ID by sending a message to the Bot and checking logs'}
                                    </p>
                                </div>

                                {/* Toggles */}
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {lang === 'th' ? 'รับการแจ้งเตือน' : 'Receive Notifications'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, receive_notifications: !formData.receive_notifications })}
                                        className={`relative w-14 h-7 rounded-full transition-colors ${formData.receive_notifications ? 'bg-green-500' : (isLight ? 'bg-gray-300' : 'bg-dark-600')
                                            }`}
                                    >
                                        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.receive_notifications ? 'left-8' : 'left-1'
                                            }`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {lang === 'th' ? 'เปิดใช้งาน' : 'Active'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                        className={`relative w-14 h-7 rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : (isLight ? 'bg-gray-300' : 'bg-dark-600')
                                            }`}
                                    >
                                        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.is_active ? 'left-8' : 'left-1'
                                            }`} />
                                    </button>
                                </div>
                            </div>

                            <div className={`p-6 border-t ${isLight ? 'border-gray-200' : 'border-dark-700'} flex justify-end gap-3`}>
                                <Button variant="ghost" onClick={() => setShowModal(false)}>
                                    {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                                </Button>
                                <Button variant="primary" onClick={handleSave} disabled={saving}>
                                    {saving ? <Spinner size="sm" /> : (
                                        <>
                                            <Icon name="save" size="sm" className="mr-2" />
                                            {lang === 'th' ? 'บันทึก' : 'Save'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    )
}
