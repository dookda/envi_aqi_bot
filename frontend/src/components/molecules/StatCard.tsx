/**
 * StatCard Molecule
 * Displays a single statistic with label, value, and optional icon
 */
import { Card, Icon } from '../atoms'

type StatColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default'

const colorVariants: Record<StatColor, string> = {
  primary: 'text-primary-400',
  secondary: 'text-gray-400',
  success: 'text-success-400',
  warning: 'text-warning-400',
  danger: 'text-danger-400',
  default: 'text-white',
}

// Map of icon names for common stat types
const iconMap: Record<string, string> = {
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

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  /** Legacy emoji icon (deprecated, use iconName instead) */
  icon?: React.ReactNode
  /** Material Icon name (preferred) */
  iconName?: string
  color?: StatColor
  trend?: number
  className?: string
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit = '',
  icon,
  iconName,
  color = 'default',
  trend,
  className = '',
}) => {
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
          {trend !== undefined && (
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

export default StatCard
