/**
 * Card Atom Component
 * Container with glass morphism effect
 */

type CardPadding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: CardPadding
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = true,
  padding = 'md',
  ...props
}) => {
  const paddings: Record<CardPadding, string> = {
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

export default Card
