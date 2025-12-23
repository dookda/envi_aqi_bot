/**
 * StatCard Molecule
 * Displays a single statistic with label, value, and optional icon
 */
import PropTypes from 'prop-types'
import { Card, Icon } from '../atoms'

const colorVariants = {
    primary: 'text-primary-400',
    success: 'text-success-400',
    warning: 'text-warning-400',
    danger: 'text-danger-400',
    default: 'text-white',
}

// Map of icon names for common stat types
const iconMap = {
    completeness: 'trending_up',
    average: 'thermostat',
    imputed: 'auto_fix_high',
    missing: 'cancel',
    anomalies: 'warning',
    stations: 'location_on',
    models: 'psychology',
    ready: 'check_circle',
    coverage: 'bar_chart',
}

export default function StatCard({
    label,
    value,
    unit = '',
    icon,
    iconName,
    color = 'default',
    trend,
    className = '',
}) {
    // Determine icon to show - prioritize iconName (Material Icon), fallback to icon (legacy)
    const hasIcon = icon || iconName

    return (
        <Card className={`${className}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-dark-400 mb-1">{label}</p>
                    <p className={`text-3xl font-bold ${colorVariants[color]}`}>
                        {value}
                        {unit && <span className="text-lg font-normal ml-1">{unit}</span>}
                    </p>
                    {trend && (
                        <p className={`text-sm mt-1 flex items-center gap-1 ${trend > 0 ? 'text-danger-400' : 'text-success-400'}`}>
                            <Icon
                                name={trend > 0 ? 'arrow_upward' : 'arrow_downward'}
                                size="sm"
                            />
                            {Math.abs(trend)}% from last hour
                        </p>
                    )}
                </div>
                {hasIcon && (
                    <div className={`${colorVariants[color]}`}>
                        {iconName ? (
                            <Icon name={iconName} size="xl" />
                        ) : (
                            <span className="text-2xl">{icon}</span>
                        )}
                    </div>
                )}
            </div>
        </Card>
    )
}

StatCard.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    unit: PropTypes.string,
    /** Legacy emoji icon (deprecated, use iconName instead) */
    icon: PropTypes.node,
    /** Material Icon name (preferred) */
    iconName: PropTypes.string,
    color: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'default']),
    trend: PropTypes.number,
    className: PropTypes.string,
}
