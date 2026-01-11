/**
 * Badge Atom Component
 * Display status, labels, or AQI levels
 */

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'aqi-excellent'
  | 'aqi-good'
  | 'aqi-moderate'
  | 'aqi-unhealthy-sensitive'
  | 'aqi-unhealthy'
  | 'aqi-very-unhealthy'
  | 'aqi-hazardous'

type BadgeSize = 'sm' | 'md' | 'lg'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-dark-600 text-white',
  primary: 'bg-primary-500/20 text-primary-400 border border-primary-500/30',
  secondary: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  success: 'bg-success-500/20 text-success-400 border border-success-500/30',
  warning: 'bg-warning-500/20 text-warning-400 border border-warning-500/30',
  danger: 'bg-danger-500/20 text-danger-400 border border-danger-500/30',
  info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  // AQI specific variants
  'aqi-excellent': 'aqi-excellent',
  'aqi-good': 'aqi-good',
  'aqi-moderate': 'aqi-moderate',
  'aqi-unhealthy-sensitive': 'aqi-unhealthy-sensitive',
  'aqi-unhealthy': 'aqi-unhealthy',
  'aqi-very-unhealthy': 'aqi-very-unhealthy',
  'aqi-hazardous': 'aqi-hazardous',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <span
      className={`
        inline-flex items-center justify-center
        font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  )
}

export default Badge

// Helper to get AQI badge variant from PM2.5 value
export function getAqiBadgeVariant(pm25: number): BadgeVariant {
  if (pm25 <= 25) return 'aqi-excellent'
  if (pm25 <= 50) return 'aqi-good'
  if (pm25 <= 100) return 'aqi-moderate'
  if (pm25 <= 200) return 'aqi-unhealthy-sensitive'
  if (pm25 <= 300) return 'aqi-unhealthy'
  return 'aqi-very-unhealthy'
}

export function getAqiLabel(pm25: number): string {
  if (pm25 <= 25) return 'Excellent'
  if (pm25 <= 50) return 'Good'
  if (pm25 <= 100) return 'Moderate'
  if (pm25 <= 200) return 'Unhealthy (Sensitive)'
  if (pm25 <= 300) return 'Unhealthy'
  return 'Very Unhealthy'
}
