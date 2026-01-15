import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useTheme } from '../contexts'

const ProfilePage: React.FC = () => {
    const { user, logout } = useAuth()
    const { isLight } = useTheme()
    const navigate = useNavigate()

    if (!user) {
        navigate('/login')
        return null
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className={`text-3xl font-bold mb-8 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                User Profile
            </h1>

            <div className={`max-w-2xl p-8 rounded-xl shadow-lg border ${isLight ? 'bg-white border-gray-100' : 'bg-dark-800 border-dark-700'
                }`}>
                <div className="flex items-center gap-6 mb-8">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold ${isLight ? 'bg-primary-100 text-primary-600' : 'bg-primary-900/30 text-primary-400'
                        }`}>
                        {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            {user.full_name || user.username}
                        </h2>
                        <p className={isLight ? 'text-gray-500' : 'text-gray-400'}>
                            {user.email}
                        </p>
                        <div className={`inline-block mt-2 px-3 py-1 text-xs rounded-full ${isLight ? 'bg-gray-100 text-gray-600' : 'bg-dark-700 text-gray-300'
                            }`}>
                            Role: {user.role}
                        </div>
                    </div>
                </div>

                <div className={`border-t pt-6 ${isLight ? 'border-gray-100' : 'border-dark-700'}`}>
                    <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        Account Settings
                    </h3>

                    <div className="space-y-4">
                        <button
                            onClick={logout}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ProfilePage
