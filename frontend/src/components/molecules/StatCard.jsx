/**
 * StatCard Molecule
 * Displays a single statistic with label and value
 */
import PropTypes from 'prop-types'
import { Card } from '../atoms'

const colorVariants = {
    primary: 'text-primary-400',
    success: 'text-success-400',
    warning: 'text-warning-400',
    danger: 'text-danger-400',
    default: 'text-white',
}

export default function StatCard({
    label,
    value,
    unit = '',
    icon,
    color = 'default',
    trend,
    className = '',
}) {
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
                        <p className={`text-sm mt-1 ${trend > 0 ? 'text-danger-400' : 'text-success-400'}`}>
                            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last hour
                        </p>
                    )}
                </div>
                {icon && (
                    <div className={`text-2xl ${colorVariants[color]}`}>
                        {icon}
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
    icon: PropTypes.node,
    color: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'default']),
    trend: PropTypes.number,
    className: PropTypes.string,
}
