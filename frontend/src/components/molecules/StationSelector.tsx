/**
 * StationSelector Molecule
 * Dropdown to select a monitoring station
 */
import type { Station } from '@/types'
import { Select } from '../atoms'

interface StationSelectorProps {
  stations?: Station[]
  value?: string
  onChange: (value: string) => void
  loading?: boolean
  className?: string
}

const StationSelector: React.FC<StationSelectorProps> = ({
  stations = [],
  value,
  onChange,
  loading = false,
  className = '',
}) => {
  const options = stations.map(station => ({
    value: station.station_id,
    label: `${station.station_id} - ${station.name_en || station.name_th || 'Unknown'}`,
  }))

  return (
    <Select
      label="Station"
      options={options}
      value={value}
      onChange={onChange}
      placeholder={loading ? 'Loading stations...' : 'Select a station'}
      disabled={loading}
      className={className}
    />
  )
}

export default StationSelector
