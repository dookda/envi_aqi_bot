import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import liff from '@line/liff'
import { useAuth, useTheme, useLanguage } from '../contexts'
import { Navbar } from '../components/organisms'
import { Icon, Spinner } from '../components/atoms'

const LIFF_ID = import.meta.env.VITE_LIFF_ID || ''

const LoginPage: React.FC = () => {
    const { login, loginWithLine, isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const { isLight } = useTheme()
    const { lang } = useLanguage()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isLineLoading, setIsLineLoading] = useState(false)
    const [liffInitialized, setLiffInitialized] = useState(false)
    const [showPasswordLogin, setShowPasswordLogin] = useState(false)

    // Get the redirect path from location state, or default to '/'
    const from = (location.state as any)?.from?.pathname || '/'

    // Initialize LIFF
    useEffect(() => {
        if (LIFF_ID) {
            liff.init({ liffId: LIFF_ID })
                .then(() => {
                    setLiffInitialized(true)
                    // Check if user is already logged in via LINE
                    if (liff.isLoggedIn()) {
                        handleLineLoginCallback()
                    }
                })
                .catch((err) => {
                    console.error('LIFF init error:', err)
                    setLiffInitialized(false)
                })
        }
    }, [])

    // If already authenticated, redirect immediately
    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true })
        }
    }, [isAuthenticated, navigate, from])

    const handleLineLoginCallback = async () => {
        try {
            setIsLineLoading(true)
            const accessToken = liff.getAccessToken()
            if (accessToken) {
                await loginWithLine(accessToken)
                navigate(from, { replace: true })
            }
        } catch (err: any) {
            console.error('LINE Login callback error:', err)
            setError(err.message || (lang === 'th' ? 'เข้าสู่ระบบด้วย LINE ล้มเหลว' : 'LINE Login failed'))
        } finally {
            setIsLineLoading(false)
        }
    }

    const handleLineLogin = () => {
        if (!liffInitialized) {
            setError(lang === 'th' ? 'ระบบ LINE Login ยังไม่พร้อม' : 'LINE Login not ready')
            return
        }

        setError('')
        setIsLineLoading(true)

        if (!liff.isLoggedIn()) {
            // Redirect to LINE Login
            liff.login({ redirectUri: window.location.href })
        } else {
            // Already logged in, get token
            handleLineLoginCallback()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)
        try {
            await login(username, password)
            navigate(from, { replace: true })
        } catch (err: any) {
            setError(err.message || (lang === 'th' ? 'เข้าสู่ระบบล้มเหลว' : 'Failed to login'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-dark-900'} transition-colors duration-300`}>
            <Navbar title="AQI Pipeline" subtitle={lang === 'th' ? 'เข้าสู่ระบบ' : 'Login'} />

            <main className="container mx-auto px-4 py-8 flex justify-center items-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
                <div className={`w-full max-w-md p-8 rounded-xl shadow-lg ${isLight ? 'bg-white' : 'bg-dark-800'}`}>
                    <h2 className={`text-2xl font-bold mb-2 text-center ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {lang === 'th' ? 'ยินดีต้อนรับ' : 'Welcome Back'}
                    </h2>
                    <p className={`text-sm mb-6 text-center ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                        {lang === 'th' ? 'เข้าสู่ระบบเพื่อรับการแจ้งเตือนคุณภาพอากาศ' : 'Login to receive air quality alerts'}
                    </p>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                            <Icon name="error" size="sm" />
                            {error}
                        </div>
                    )}

                    {/* LINE Login Button */}
                    {LIFF_ID && (
                        <div className="mb-6">
                            <button
                                type="button"
                                onClick={handleLineLogin}
                                disabled={isLineLoading || !liffInitialized}
                                className="w-full py-3 px-4 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-3 bg-[#00B900] hover:bg-[#00A000] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLineLoading ? (
                                    <>
                                        <Spinner size="sm" />
                                        {lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Logging in...'}
                                    </>
                                ) : (
                                    <>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                                        </svg>
                                        {lang === 'th' ? 'เข้าสู่ระบบด้วย LINE' : 'Login with LINE'}
                                    </>
                                )}
                            </button>
                            <p className={`text-xs mt-2 text-center ${isLight ? 'text-gray-400' : 'text-dark-400'}`}>
                                {lang === 'th'
                                    ? 'เข้าสู่ระบบด้วย LINE เพื่อรับการแจ้งเตือนผ่าน LINE OA'
                                    : 'Login with LINE to receive alerts via LINE OA'
                                }
                            </p>
                        </div>
                    )}

                    {/* Divider */}
                    {LIFF_ID && (
                        <div className="relative mb-6">
                            <div className={`absolute inset-0 flex items-center`}>
                                <div className={`w-full border-t ${isLight ? 'border-gray-200' : 'border-dark-600'}`}></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                                    className={`px-3 ${isLight ? 'bg-white text-gray-500' : 'bg-dark-800 text-gray-400'}`}
                                >
                                    {showPasswordLogin
                                        ? (lang === 'th' ? 'ซ่อน' : 'Hide')
                                        : (lang === 'th' ? 'เข้าสู่ระบบด้วยรหัสผ่าน' : 'Login with password')
                                    }
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Password Login Form */}
                    {(showPasswordLogin || !LIFF_ID) && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    {lang === 'th' ? 'ชื่อผู้ใช้' : 'Username'}
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${isLight
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-dark-700 border-dark-600 text-white'
                                        }`}
                                    placeholder={lang === 'th' ? 'กรอกชื่อผู้ใช้' : 'Enter your username'}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    {lang === 'th' ? 'รหัสผ่าน' : 'Password'}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${isLight
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-dark-700 border-dark-600 text-white'
                                        }`}
                                    placeholder={lang === 'th' ? 'กรอกรหัสผ่าน' : 'Enter your password'}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full py-2 px-4 rounded-lg font-medium text-white transition-colors ${isLoading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-primary-600 hover:bg-primary-700'
                                    }`}
                            >
                                {isLoading
                                    ? (lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Logging in...')
                                    : (lang === 'th' ? 'เข้าสู่ระบบ' : 'Login')
                                }
                            </button>
                        </form>
                    )}

                    {(showPasswordLogin || !LIFF_ID) && (
                        <div className="mt-6 text-center text-sm">
                            <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>
                                {lang === 'th' ? 'ยังไม่มีบัญชี? ' : "Don't have an account? "}
                            </span>
                            <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium">
                                {lang === 'th' ? 'สมัครสมาชิก' : 'Register here'}
                            </Link>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

export default LoginPage
