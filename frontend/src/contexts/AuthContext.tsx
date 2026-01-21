import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, LoginResponse } from '../types/auth'
import api from '../services/api'

interface UpdateProfileData {
    full_name?: string
    email?: string
    password?: string
    receive_notifications?: boolean
}

interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (username: string, password: string) => Promise<void>
    loginWithLine: (accessToken: string) => Promise<void>
    register: (data: any) => Promise<void>
    logout: () => void
    updateProfile: (data: UpdateProfileData) => Promise<void>
    updateNotificationPreference: (receive: boolean) => Promise<void>
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token')
            if (token) {
                const response = await fetch(`${import.meta.env.BASE_URL}api/auth/me`.replace(/\/+/g, '/'), {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                if (response.ok) {
                    const userData = await response.json()
                    setUser(userData)
                } else {
                    localStorage.removeItem('token')
                    setUser(null)
                }
            }
        } catch (error) {
            console.error('Failed to fetch user', error)
            localStorage.removeItem('token')
            setUser(null)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchUser()
    }, [])

    const login = async (username: string, password: string) => {
        const formData = new URLSearchParams()
        formData.append('username', username)
        formData.append('password', password)

        const response = await fetch(`${import.meta.env.BASE_URL}api/auth/login`.replace(/\/+/g, '/'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Login failed')
        }

        const data: LoginResponse = await response.json()
        localStorage.setItem('token', data.access_token)
        await fetchUser()
    }

    const loginWithLine = async (accessToken: string) => {
        const response = await fetch(`${import.meta.env.BASE_URL}api/auth/line-login`.replace(/\/+/g, '/'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ access_token: accessToken }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'LINE Login failed')
        }

        const data: LoginResponse = await response.json()
        localStorage.setItem('token', data.access_token)
        await fetchUser()
    }

    const register = async (data: any) => {
        await api.post('/auth/register', data)
    }

    const logout = () => {
        localStorage.removeItem('token')
        setUser(null)
        window.location.href = '/'
    }

    const updateProfile = async (data: UpdateProfileData) => {
        if (!user) throw new Error('Not authenticated')

        const token = localStorage.getItem('token')
        if (!token) throw new Error('No token found')

        const response = await fetch(`${import.meta.env.BASE_URL}api/users/${user.id}`.replace(/\/+/g, '/'), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to update profile')
        }

        await fetchUser()
    }

    const updateNotificationPreference = async (receive: boolean) => {
        if (!user) throw new Error('Not authenticated')

        const token = localStorage.getItem('token')
        if (!token) throw new Error('No token found')

        const response = await fetch(`${import.meta.env.BASE_URL}api/users/${user.id}`.replace(/\/+/g, '/'), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ receive_notifications: receive })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to update notification preference')
        }

        await fetchUser()
    }

    const refreshUser = async () => {
        await fetchUser()
    }

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            loginWithLine,
            register,
            logout,
            updateProfile,
            updateNotificationPreference,
            refreshUser
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
