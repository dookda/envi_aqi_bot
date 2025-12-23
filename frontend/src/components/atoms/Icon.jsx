/**
 * Icon Atom Component
 * Material Symbols icon wrapper for consistent icon styling
 * @see https://fonts.google.com/icons
 */
import PropTypes from 'prop-types'

// Icon size mappings
const sizes = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
    '2xl': 'text-4xl',
}

// Color variants
const colors = {
    primary: 'text-primary-400',
    success: 'text-success-400',
    warning: 'text-warning-400',
    danger: 'text-danger-400',
    info: 'text-blue-400',
    default: 'text-current',
    white: 'text-white',
    muted: 'text-dark-400',
}

/**
 * Material Symbols Icon Component
 * 
 * @example
 * <Icon name="trending_up" size="lg" color="success" />
 * <Icon name="warning" filled />
 * <Icon name="location_on" color="primary" />
 */
export default function Icon({
    name,
    size = 'md',
    color = 'default',
    filled = false,
    className = '',
    ...props
}) {
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

Icon.propTypes = {
    /** Material Symbols icon name (e.g., 'trending_up', 'warning', 'location_on') */
    name: PropTypes.string.isRequired,
    /** Size of the icon */
    size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl']),
    /** Color variant */
    color: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'info', 'default', 'white', 'muted']),
    /** Whether to use filled variant */
    filled: PropTypes.bool,
    /** Additional CSS classes */
    className: PropTypes.string,
}
