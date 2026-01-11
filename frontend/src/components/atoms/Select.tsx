/**
 * Select Atom Component
 * Dropdown select input
 */
import type { SelectOption } from '@/types'

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  options?: SelectOption[]
  value?: string | number
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const Select: React.FC<SelectProps> = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm text-gray-400 font-medium">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          px-4 py-2.5 rounded-lg
          bg-dark-800 border border-white/10
          text-white text-base
          cursor-pointer
          transition-all duration-300
          hover:border-primary-500/50
          focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
          focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-dark-800"
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default Select
