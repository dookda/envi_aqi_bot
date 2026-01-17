import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth, useTheme, useLanguage } from '../contexts'
import { Navbar } from '../components/organisms'

const LoginPage: React.FC = () => {
    const { login, isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const { isLight } = useTheme()
    const { t } = useLanguage()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Get the redirect path from location state, or default to '/'
    const from = (location.state as any)?.from?.pathname || '/'

    // If already authenticated, redirect immediately
    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true })
        }
    }, [isAuthenticated, navigate, from])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)
        try {
            await login(username, password)
            // Redirect to the saved location or home
            navigate(from, { replace: true })
        } catch (err: any) {
            setError(err.message || 'Failed to login')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-dark-900'} transition-colors duration-300`}>
            <Navbar title="AQI Pipeline" subtitle="Login" />

            <main className="container mx-auto px-4 py-8 flex justify-center items-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
                <div className={`w-full max-w-md p-8 rounded-xl shadow-lg ${isLight ? 'bg-white' : 'bg-dark-800'}`}>
                    <h2 className={`text-2xl font-bold mb-6 text-center ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        Welcome Back
                    </h2>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                Username
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
                                placeholder="Enter your username"
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                Password
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
                                placeholder="Enter your password"
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
                            {isLoading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>
                            Don't have an account?{' '}
                        </span>
                        <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium">
                            Register here
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default LoginPage
