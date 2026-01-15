import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, useTheme } from '../contexts'
import { Navbar } from '../components/organisms'

const RegisterPage: React.FC = () => {
    const { register } = useAuth()
    const navigate = useNavigate()
    const { isLight } = useTheme()

    const [formData, setFormData] = useState({
        email: '',
        username: '',
        full_name: '',
        password: '',
        confirmPassword: ''
    })
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords don't match")
            return
        }

        setError('')
        setIsLoading(true)
        try {
            await register({
                email: formData.email,
                username: formData.username,
                full_name: formData.full_name,
                password: formData.password
            })
            // Navigate to login or home
            navigate('/login')
        } catch (err: any) {
            setError(err.message || 'Failed to register')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-dark-900'} transition-colors duration-300`}>
            <Navbar title="AQI Pipeline" subtitle="Register" />

            <main className="container mx-auto px-4 py-8 flex justify-center items-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
                <div className={`w-full max-w-md p-8 rounded-xl shadow-lg ${isLight ? 'bg-white' : 'bg-dark-800'}`}>
                    <h2 className={`text-2xl font-bold mb-6 text-center ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        Create Account
                    </h2>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${isLight
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-dark-700 border-dark-600 text-white'
                                    }`}
                                placeholder="john@example.com"
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                Username
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${isLight
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-dark-700 border-dark-600 text-white'
                                    }`}
                                placeholder="johndoe"
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                Full Name
                            </label>
                            <input
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${isLight
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-dark-700 border-dark-600 text-white'
                                    }`}
                                placeholder="John Doe"
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${isLight
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-dark-700 border-dark-600 text-white'
                                    }`}
                                placeholder="Minimum 6 characters"
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${isLight
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-dark-700 border-dark-600 text-white'
                                    }`}
                                placeholder="Re-enter password"
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
                            {isLoading ? 'Creating Account...' : 'Register'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>
                            Already have an account?{' '}
                        </span>
                        <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">
                            Login here
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default RegisterPage
