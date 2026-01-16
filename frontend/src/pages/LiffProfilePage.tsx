/**
 * LINE LIFF Profile Page
 * Allows users to register/bind their LINE account for receiving notifications
 * This page is designed to be opened inside LINE app via LIFF
 */
import { useState, useEffect, useCallback } from 'react'
import liff from '@line/liff'

interface LiffProfile {
    userId: string
    displayName: string
    pictureUrl?: string
    statusMessage?: string
}

interface UserData {
    id: number
    line_user_id: string
    display_name: string
    email: string | null
    receive_notifications: boolean
    created_at: string | null
    is_new: boolean
}

const API_BASE = '/ebot/api'

// Get LIFF ID from environment or use a placeholder
const LIFF_ID = import.meta.env.VITE_LIFF_ID || ''

export default function LiffProfilePage(): React.ReactElement {
    // State
    const [liffInitialized, setLiffInitialized] = useState(false)
    const [liffError, setLiffError] = useState<string | null>(null)
    const [profile, setProfile] = useState<LiffProfile | null>(null)
    const [userData, setUserData] = useState<UserData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [notifications, setNotifications] = useState(true)
    const [registered, setRegistered] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

    // Initialize LIFF
    useEffect(() => {
        const initLiff = async () => {
            try {
                if (!LIFF_ID) {
                    // Demo mode without LIFF
                    setLiffError('LIFF ID not configured. Running in demo mode.')
                    setLiffInitialized(false)
                    setLoading(false)
                    return
                }

                await liff.init({ liffId: LIFF_ID })
                setLiffInitialized(true)

                if (!liff.isLoggedIn()) {
                    // Redirect to LINE login
                    liff.login()
                    return
                }

                // Get user profile
                const lineProfile = await liff.getProfile()
                setProfile({
                    userId: lineProfile.userId,
                    displayName: lineProfile.displayName,
                    pictureUrl: lineProfile.pictureUrl,
                    statusMessage: lineProfile.statusMessage
                })

            } catch (error) {
                console.error('LIFF init error:', error)
                setLiffError(error instanceof Error ? error.message : 'Failed to initialize LIFF')
            } finally {
                setLoading(false)
            }
        }

        initLiff()
    }, [])

    // Check if user is already registered
    const checkRegistration = useCallback(async () => {
        if (!profile?.userId) return

        try {
            const response = await fetch(`${API_BASE}/liff/user/${profile.userId}`)

            if (response.ok) {
                const data = await response.json()
                setUserData(data)
                setNotifications(data.receive_notifications)
                setRegistered(true)
            } else if (response.status === 404) {
                setRegistered(false)
            }
        } catch (error) {
            console.error('Error checking registration:', error)
        }
    }, [profile?.userId])

    useEffect(() => {
        if (profile) {
            checkRegistration()
        }
    }, [profile, checkRegistration])

    // Register user
    const handleRegister = async () => {
        if (!profile) return

        setSaving(true)
        setMessage(null)

        try {
            const response = await fetch(`${API_BASE}/liff/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_user_id: profile.userId,
                    display_name: profile.displayName,
                    picture_url: profile.pictureUrl,
                    receive_notifications: notifications
                })
            })

            if (!response.ok) {
                throw new Error('Registration failed')
            }

            const data = await response.json()
            setUserData(data)
            setRegistered(true)
            setMessage({
                type: 'success',
                text: data.is_new
                    ? 'ลงทะเบียนสำเร็จ! คุณจะได้รับการแจ้งเตือนผ่าน LINE'
                    : 'อัปเดตข้อมูลสำเร็จ!'
            })

        } catch (error) {
            console.error('Registration error:', error)
            setMessage({
                type: 'error',
                text: 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง'
            })
        } finally {
            setSaving(false)
        }
    }

    // Update notification settings
    const handleUpdateNotifications = async () => {
        if (!profile?.userId) return

        setSaving(true)
        setMessage(null)

        try {
            const response = await fetch(`${API_BASE}/liff/user/${profile.userId}/notifications`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receive_notifications: notifications })
            })

            if (!response.ok) {
                throw new Error('Update failed')
            }

            const data = await response.json()
            setUserData(data)
            setMessage({
                type: 'success',
                text: notifications
                    ? 'เปิดรับการแจ้งเตือนแล้ว'
                    : 'ปิดการแจ้งเตือนแล้ว'
            })

        } catch (error) {
            console.error('Update error:', error)
            setMessage({
                type: 'error',
                text: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
            })
        } finally {
            setSaving(false)
        }
    }

    // Unregister
    const handleUnregister = async () => {
        if (!profile?.userId) return

        if (!confirm('คุณต้องการยกเลิกการลงทะเบียนหรือไม่?\nคุณจะไม่ได้รับการแจ้งเตือนอีกต่อไป')) {
            return
        }

        setSaving(true)
        setMessage(null)

        try {
            const response = await fetch(`${API_BASE}/liff/user/${profile.userId}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error('Unregister failed')
            }

            setRegistered(false)
            setUserData(null)
            setMessage({
                type: 'info',
                text: 'ยกเลิกการลงทะเบียนแล้ว'
            })

        } catch (error) {
            console.error('Unregister error:', error)
            setMessage({
                type: 'error',
                text: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
            })
        } finally {
            setSaving(false)
        }
    }

    // Close LIFF window
    const handleClose = () => {
        if (liff.isInClient()) {
            liff.closeWindow()
        } else {
            window.close()
        }
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <p className="text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        )
    }

    // Error state or demo mode
    if (liffError && !profile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold text-gray-800 mb-2">AQI Bot Notifications</h1>
                    <p className="text-gray-500 mb-6">ระบบการแจ้งเตือนคุณภาพอากาศ</p>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <p className="text-yellow-700 text-sm">
                            <strong>Demo Mode:</strong> {liffError}
                        </p>
                        <p className="text-yellow-600 text-xs mt-1">
                            กรุณาเปิดหน้านี้ใน LINE app หรือกำหนดค่า LIFF ID
                        </p>
                    </div>

                    <div className="space-y-3 text-left bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-700">วิธีการตั้งค่า LIFF:</h3>
                        <ol className="text-sm text-gray-600 space-y-2">
                            <li>1. สร้าง LIFF App ใน LINE Developers Console</li>
                            <li>2. ตั้งค่า Endpoint URL เป็น URL ของหน้านี้</li>
                            <li>3. เพิ่ม VITE_LIFF_ID ใน environment variables</li>
                            <li>4. เปิด LIFF URL ใน LINE app</li>
                        </ol>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
                {/* Header with LINE branding */}
                <div className="text-center mb-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                        {profile?.pictureUrl ? (
                            <img
                                src={profile.pictureUrl}
                                alt={profile.displayName}
                                className="w-20 h-20 rounded-full object-cover"
                            />
                        ) : (
                            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {profile?.displayName || 'LINE User'}
                    </h1>
                    {profile?.statusMessage && (
                        <p className="text-gray-500 text-sm mt-1">{profile.statusMessage}</p>
                    )}
                </div>

                {/* App Title */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 mb-6 text-center text-white">
                    <h2 className="font-bold text-lg">🌍 AQI Bot</h2>
                    <p className="text-blue-100 text-sm">ระบบแจ้งเตือนคุณภาพอากาศ</p>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : message.type === 'error'
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Registration Status */}
                {registered ? (
                    <div className="space-y-4">
                        {/* Status */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-green-700">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">ลงทะเบียนแล้ว</span>
                            </div>
                            {userData?.created_at && (
                                <p className="text-green-600 text-sm mt-1">
                                    เมื่อ {new Date(userData.created_at).toLocaleDateString('th-TH', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            )}
                        </div>

                        {/* Notification Toggle */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-800">รับการแจ้งเตือน</p>
                                    <p className="text-gray-500 text-sm">เมื่อพบข้อมูลคุณภาพอากาศผิดปกติ</p>
                                </div>
                                <button
                                    onClick={() => setNotifications(!notifications)}
                                    className={`relative w-14 h-7 rounded-full transition-colors ${notifications ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                >
                                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifications ? 'left-8' : 'left-1'
                                        }`} />
                                </button>
                            </div>

                            {notifications !== userData?.receive_notifications && (
                                <button
                                    onClick={handleUpdateNotifications}
                                    disabled={saving}
                                    className="w-full mt-3 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                >
                                    {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                                </button>
                            )}
                        </div>

                        {/* Unregister */}
                        <button
                            onClick={handleUnregister}
                            disabled={saving}
                            className="w-full py-2 text-red-500 border border-red-200 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                            ยกเลิกการลงทะเบียน
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Benefits */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-medium text-gray-800 mb-3">สิ่งที่คุณจะได้รับ:</h3>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    แจ้งเตือนเมื่อพบค่าฝุ่นผิดปกติ
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    แจ้งเตือนเมื่อพบข้อมูลขาดหาย
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    สรุปคุณภาพอากาศรายวัน
                                </li>
                            </ul>
                        </div>

                        {/* Notification Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-800">รับการแจ้งเตือน</p>
                            </div>
                            <button
                                onClick={() => setNotifications(!notifications)}
                                className={`relative w-14 h-7 rounded-full transition-colors ${notifications ? 'bg-green-500' : 'bg-gray-300'
                                    }`}
                            >
                                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifications ? 'left-8' : 'left-1'
                                    }`} />
                            </button>
                        </div>

                        {/* Register Button */}
                        <button
                            onClick={handleRegister}
                            disabled={saving}
                            className="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 disabled:opacity-50 transition-colors shadow-lg"
                        >
                            {saving ? 'กำลังลงทะเบียน...' : '🔔 ลงทะเบียนรับการแจ้งเตือน'}
                        </button>
                    </div>
                )}

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="w-full mt-4 py-2 text-gray-500 font-medium hover:text-gray-700 transition-colors"
                >
                    ปิดหน้านี้
                </button>

                {/* Footer */}
                <p className="text-center text-gray-400 text-xs mt-4">
                    Powered by AQI Bot • กรมควบคุมมลพิษ
                </p>
            </div>
        </div>
    )
}
