import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, LoginResponse } from '../types/auth'
import api from '../services/api'

interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (username: string, password: string) => Promise<void>
    register: (data: any) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token')
            if (token) {
                // Add token to api headers (this is a simple way, better to use interceptors)
                // But api.ts doesn't have a global state for headers. 
                // We will pass header in each request or just use the token in fetchUser
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

    const register = async (data: any) => {
        await api.post('/auth/register', data)
        // Automatically login after register? Or ask to login.
        // For now just success, user needs to login.
    }

    const logout = () => {
        localStorage.removeItem('token')
        setUser(null)
        window.location.href = '/'
    }

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
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
