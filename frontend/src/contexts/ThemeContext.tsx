/**
 * Theme Context for Light/Dark mode switching
 */
import { createContext, useContext, useState, useEffect } from 'react'
import type { Theme, ThemeContextType } from '@/types'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem('app-theme') as Theme | null
    return saved || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('app-theme', theme)

    // Update document class for CSS variables
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme')
      document.documentElement.classList.remove('dark-theme')
    } else {
      document.documentElement.classList.add('dark-theme')
      document.documentElement.classList.remove('light-theme')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const isDark = theme === 'dark'
  const isLight = theme === 'light'

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark, isLight }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
