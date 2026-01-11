/**
 * Icon Atom Component
 * Material Symbols icon wrapper for consistent icon styling
 * @see https://fonts.google.com/icons
 */
import type { Size } from '@/types'

// Icon size mappings
const sizes: Record<Size, string> = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
  '2xl': 'text-4xl',
}

type IconColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default' | 'white' | 'muted'

// Color variants
const colors: Record<IconColor, string> = {
  primary: 'text-primary-400',
  success: 'text-success-400',
  warning: 'text-warning-400',
  danger: 'text-danger-400',
  info: 'text-blue-400',
  default: 'text-current',
  white: 'text-white',
  muted: 'text-dark-400',
}

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Material Symbols icon name (e.g., 'trending_up', 'warning', 'location_on') */
  name: string
  /** Size of the icon */
  size?: Size
  /** Color variant */
  color?: IconColor
  /** Whether to use filled variant */
  filled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Material Symbols Icon Component
 *
 * @example
 * <Icon name="trending_up" size="lg" color="success" />
 * <Icon name="warning" filled />
 * <Icon name="location_on" color="primary" />
 */
const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color = 'default',
  filled = false,
  className = '',
  ...props
}) => {
  return (
    <span
      className={`
        material-symbols-outlined
        ${sizes[size]}
        ${colors[color]}
        ${className}
      `}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
      {...props}
    >
      {name}
    </span>
  )
}

export default Icon
