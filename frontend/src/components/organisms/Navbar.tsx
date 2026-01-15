/**
 * Navbar Component with Language and Theme toggles
 * A shared navbar component for all pages
 */
import { Link } from 'react-router-dom'
import { Icon } from '../atoms'
import { useLanguage, useTheme, useAuth } from '../../contexts'

interface NavbarProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

const Navbar: React.FC<NavbarProps> = ({ title, subtitle, children }) => {
  const { language, toggleLanguage, t } = useLanguage()
  const { toggleTheme, isLight } = useTheme()
  const { user } = useAuth()

  return (
    <header className={`glass border-b sticky top-0 z-50 transition-all duration-300 ${isLight
      ? 'border-gray-200 bg-white/80'
      : 'border-white/10'
      }`}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Title Section */}
          <div className="flex-shrink-0">
            <h1 className={`text-2xl font-bold ${isLight ? 'text-gradient-light' : 'text-gradient'}`}>
              {title}
            </h1>
            {subtitle && (
              <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-dark-400'}`}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Right Section - Navigation and Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Custom children (additional nav items) */}
            {children}

            {/* Auth Buttons */}
            {user ? (
              <Link
                to="/profile"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${isLight
                    ? 'hover:bg-gray-100 text-gray-700'
                    : 'hover:bg-dark-700 text-gray-200'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isLight ? 'bg-primary-100 text-primary-600' : 'bg-primary-900/30 text-primary-400'
                  }`}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-medium">{user.username}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className={`px-4 py-2 rounded-lg font-medium text-white shadow-lg shadow-primary-500/20 transition-all ${'bg-gradient-to-r from-primary-500 to-secondary-500 hover:shadow-primary-500/40'
                  }`}
              >
                Login
              </Link>
            )}

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${isLight
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-dark-700 hover:bg-dark-600 text-dark-300'
                }`}
              title={t('nav.language')}
            >
              <Icon name="translate" size="sm" />
              <span className="text-sm font-medium hidden sm:inline">
                {language === 'th' ? 'ไทย' : 'EN'}
              </span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${isLight
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-dark-700 hover:bg-dark-600 text-dark-300'
                }`}
              title={t('nav.theme')}
            >
              <Icon name={isLight ? 'dark_mode' : 'light_mode'} size="sm" />
              <span className="text-sm font-medium hidden sm:inline">
                {isLight ? t('nav.dark') : t('nav.light')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar
