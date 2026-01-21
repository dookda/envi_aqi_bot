import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useTheme, useLanguage } from '../contexts'
import { Card, Icon, Spinner } from '../components/atoms'

const ProfilePage: React.FC = () => {
    const { user, logout, updateProfile, updateNotificationPreference } = useAuth()
    const { isLight } = useTheme()
    const { lang } = useLanguage()
    const navigate = useNavigate()

    // Form state
    const [isEditing, setIsEditing] = useState(false)
    const [fullName, setFullName] = useState(user?.full_name || '')
    const [email, setEmail] = useState(user?.email || '')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isNotificationLoading, setIsNotificationLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    if (!user) {
        navigate('/login')
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        // Validate passwords if changing
        if (newPassword || confirmPassword) {
            if (newPassword !== confirmPassword) {
                setError(lang === 'th' ? 'รหัสผ่านใหม่ไม่ตรงกัน' : 'New passwords do not match')
                return
            }
            if (newPassword.length < 6) {
                setError(lang === 'th' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Password must be at least 6 characters')
                return
            }
        }

        setIsLoading(true)
        try {
            const updateData: { full_name?: string; email?: string; password?: string } = {}

            if (fullName !== user.full_name) {
                updateData.full_name = fullName
            }
            if (email !== user.email) {
                updateData.email = email
            }
            if (newPassword) {
                updateData.password = newPassword
            }

            if (Object.keys(updateData).length === 0) {
                setError(lang === 'th' ? 'ไม่มีการเปลี่ยนแปลง' : 'No changes to save')
                setIsLoading(false)
                return
            }

            await updateProfile(updateData)
            setSuccess(lang === 'th' ? 'บันทึกข้อมูลสำเร็จ' : 'Profile updated successfully')
            setIsEditing(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            setError(err instanceof Error ? err.message : (lang === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'))
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = () => {
        setIsEditing(false)
        setFullName(user.full_name || '')
        setEmail(user.email || '')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setError(null)
        setSuccess(null)
    }

    const handleNotificationToggle = async () => {
        setIsNotificationLoading(true)
        setError(null)
        try {
            await updateNotificationPreference(!user.receive_notifications)
            setSuccess(lang === 'th'
                ? (user.receive_notifications ? 'ปิดการแจ้งเตือนแล้ว' : 'เปิดการแจ้งเตือนแล้ว')
                : (user.receive_notifications ? 'Notifications disabled' : 'Notifications enabled')
            )
        } catch (err) {
            setError(err instanceof Error ? err.message : (lang === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'))
        } finally {
            setIsNotificationLoading(false)
        }
    }

    const inputClass = `w-full px-4 py-2.5 rounded-lg border text-sm transition-all ${isLight
        ? 'bg-white border-gray-200 text-gray-800 focus:border-primary-400'
        : 'bg-dark-700 border-dark-600 text-white focus:border-primary-500'
        } focus:outline-none focus:ring-2 focus:ring-primary-500/20`

    const labelClass = `block text-sm font-medium mb-1.5 ${isLight ? 'text-gray-700' : 'text-gray-300'}`

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className={`text-3xl font-bold mb-8 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                {lang === 'th' ? 'โปรไฟล์ผู้ใช้' : 'User Profile'}
            </h1>

            <div className="max-w-2xl space-y-6">
                {/* Profile Header Card */}
                <Card className="p-6">
                    <div className="flex items-center gap-6">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold ${isLight ? 'bg-primary-100 text-primary-600' : 'bg-primary-900/30 text-primary-400'
                            }`}>
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h2 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                {user.full_name || user.username}
                            </h2>
                            <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                @{user.username}
                            </p>
                            <div className={`inline-flex items-center gap-1 mt-2 px-3 py-1 text-xs rounded-full ${user.role === 'admin'
                                    ? isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-900/30 text-amber-400'
                                    : isLight ? 'bg-gray-100 text-gray-600' : 'bg-dark-700 text-gray-300'
                                }`}>
                                <Icon name={user.role === 'admin' ? 'admin_panel_settings' : 'person'} size="xs" />
                                {user.role === 'admin' ? (lang === 'th' ? 'ผู้ดูแลระบบ' : 'Administrator') : (lang === 'th' ? 'ผู้ใช้งาน' : 'User')}
                            </div>
                        </div>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isLight
                                    ? 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                                    : 'bg-primary-900/30 text-primary-400 hover:bg-primary-900/50'
                                    }`}
                            >
                                <Icon name="edit" size="sm" />
                                {lang === 'th' ? 'แก้ไข' : 'Edit'}
                            </button>
                        )}
                    </div>
                </Card>

                {/* Profile Form Card */}
                <Card className="p-6">
                    <h3 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="person" size="sm" className="text-primary-500" />
                        {lang === 'th' ? 'ข้อมูลส่วนตัว' : 'Personal Information'}
                    </h3>

                    {/* Success/Error Messages */}
                    {success && (
                        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isLight ? 'bg-green-50 text-green-700' : 'bg-green-900/20 text-green-400'}`}>
                            <Icon name="check_circle" size="sm" />
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isLight ? 'bg-red-50 text-red-700' : 'bg-red-900/20 text-red-400'}`}>
                            <Icon name="error" size="sm" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username (read-only) */}
                        <div>
                            <label className={labelClass}>
                                {lang === 'th' ? 'ชื่อผู้ใช้' : 'Username'}
                            </label>
                            <input
                                type="text"
                                value={user.username}
                                disabled
                                className={`${inputClass} opacity-60 cursor-not-allowed`}
                            />
                            <p className={`text-xs mt-1 ${isLight ? 'text-gray-400' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ชื่อผู้ใช้ไม่สามารถเปลี่ยนได้' : 'Username cannot be changed'}
                            </p>
                        </div>

                        {/* Full Name */}
                        <div>
                            <label className={labelClass}>
                                {lang === 'th' ? 'ชื่อ-นามสกุล' : 'Full Name'}
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                disabled={!isEditing}
                                placeholder={lang === 'th' ? 'กรอกชื่อ-นามสกุล' : 'Enter your full name'}
                                className={`${inputClass} ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className={labelClass}>
                                {lang === 'th' ? 'อีเมล' : 'Email'}
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={!isEditing}
                                placeholder={lang === 'th' ? 'กรอกอีเมล' : 'Enter your email'}
                                className={`${inputClass} ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                        </div>

                        {/* Password Change Section (only shown when editing) */}
                        {isEditing && (
                            <div className={`pt-5 border-t ${isLight ? 'border-gray-100' : 'border-dark-700'}`}>
                                <h4 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    <Icon name="lock" size="sm" />
                                    {lang === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
                                    <span className={`text-xs font-normal ${isLight ? 'text-gray-400' : 'text-dark-400'}`}>
                                        ({lang === 'th' ? 'ไม่จำเป็น' : 'optional'})
                                    </span>
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>
                                            {lang === 'th' ? 'รหัสผ่านใหม่' : 'New Password'}
                                        </label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder={lang === 'th' ? 'กรอกรหัสผ่านใหม่' : 'Enter new password'}
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            {lang === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm New Password'}
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder={lang === 'th' ? 'กรอกรหัสผ่านใหม่อีกครั้ง' : 'Confirm new password'}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {isEditing && (
                            <div className="flex items-center gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <>
                                            <Spinner size="sm" />
                                            {lang === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="save" size="sm" />
                                            {lang === 'th' ? 'บันทึกการเปลี่ยนแปลง' : 'Save Changes'}
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={isLoading}
                                    className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${isLight
                                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                                        }`}
                                >
                                    {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                                </button>
                            </div>
                        )}
                    </form>
                </Card>

                {/* LINE Notifications Card */}
                {user.line_user_id && (
                    <Card className="p-6">
                        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#00B900" className="flex-shrink-0">
                                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                            </svg>
                            {lang === 'th' ? 'การแจ้งเตือน LINE' : 'LINE Notifications'}
                        </h3>

                        <div className={`flex items-center justify-between p-4 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-dark-700'}`}>
                            <div className="flex-1">
                                <p className={`font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                    {lang === 'th' ? 'รับการแจ้งเตือนคุณภาพอากาศ' : 'Receive Air Quality Alerts'}
                                </p>
                                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {lang === 'th'
                                        ? 'รับการแจ้งเตือนผ่าน LINE เมื่อคุณภาพอากาศมีการเปลี่ยนแปลง'
                                        : 'Get notified via LINE when air quality changes'
                                    }
                                </p>
                            </div>
                            <button
                                onClick={handleNotificationToggle}
                                disabled={isNotificationLoading}
                                className={`relative w-14 h-8 rounded-full transition-colors ${user.receive_notifications
                                    ? 'bg-[#00B900]'
                                    : isLight ? 'bg-gray-300' : 'bg-dark-500'
                                    } ${isNotificationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span
                                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${user.receive_notifications ? 'translate-x-7' : 'translate-x-1'
                                        }`}
                                />
                                {isNotificationLoading && (
                                    <span className="absolute inset-0 flex items-center justify-center">
                                        <Spinner size="sm" />
                                    </span>
                                )}
                            </button>
                        </div>

                        <p className={`text-xs mt-3 ${isLight ? 'text-gray-400' : 'text-dark-400'}`}>
                            <Icon name="info" size="xs" className="mr-1" />
                            {lang === 'th'
                                ? 'เชื่อมต่อบัญชี LINE แล้ว: ' + user.line_user_id.substring(0, 10) + '...'
                                : 'LINE account connected: ' + user.line_user_id.substring(0, 10) + '...'
                            }
                        </p>
                    </Card>
                )}

                {/* Account Actions Card */}
                <Card className="p-6">
                    <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="settings" size="sm" className="text-primary-500" />
                        {lang === 'th' ? 'การตั้งค่าบัญชี' : 'Account Settings'}
                    </h3>

                    <div className="space-y-3">
                        <button
                            onClick={logout}
                            className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Icon name="logout" size="sm" />
                            {lang === 'th' ? 'ออกจากระบบ' : 'Logout'}
                        </button>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default ProfilePage
