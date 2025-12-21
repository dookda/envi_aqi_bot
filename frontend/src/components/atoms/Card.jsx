/**
 * Card Atom Component
 * Container with glass morphism effect
 */
import PropTypes from 'prop-types'

export default function Card({
    children,
    className = '',
    hover = true,
    padding = 'md',
    ...props
}) {
    const paddings = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
    }

    return (
        <div
            className={`
        glass rounded-xl
        ${paddings[padding]}
        ${hover ? 'hover:border-primary-500/50 hover:shadow-lg' : ''}
        transition-all duration-300
        ${className}
      `}
            {...props}
        >
            {children}
        </div>
    )
}

Card.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    hover: PropTypes.bool,
    padding: PropTypes.oneOf(['none', 'sm', 'md', 'lg']),
}
