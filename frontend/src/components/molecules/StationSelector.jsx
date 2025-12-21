/**
 * StationSelector Molecule
 * Dropdown to select a monitoring station
 */
import PropTypes from 'prop-types'
import { Select } from '../atoms'

export default function StationSelector({
    stations = [],
    value,
    onChange,
    loading = false,
    className = '',
}) {
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

StationSelector.propTypes = {
    stations: PropTypes.arrayOf(
        PropTypes.shape({
            station_id: PropTypes.string.isRequired,
            name_th: PropTypes.string,
            name_en: PropTypes.string,
        })
    ),
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    className: PropTypes.string,
}
