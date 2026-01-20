/**
 * SearchFilterPanel - Consolidated search and filter controls
 * Contains station selector, time period presets, and datetime range filter
 */
import { Card, Icon, Badge } from '../atoms'
import type { Station, Language, ParameterKey } from '@/types'

/**
 * Format date to dd-MM-yyyy HH:mm (24hr format)
 */
const formatDateTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear()
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${day}-${month}-${year} ${hours}:${minutes}`
}

interface TimePeriodOption {
    value: number
    label: string
}

const TIME_PERIODS: TimePeriodOption[] = [
    { value: 1, label: '24h' },
    { value: 3, label: '3d' },
    { value: 7, label: '7d' },
    { value: 14, label: '14d' },
    { value: 30, label: '30d' },
    { value: 365, label: '1y' },
]

interface SearchFilterPanelProps {
    // Station selection
    stations: Station[]
    selectedStation: string
    onStationChange: (stationId: string) => void
    stationsLoading?: boolean

    // Time period
    timePeriod: number
    onTimePeriodChange: (period: number) => void

    // Date-time range filter
    startDate: string
    endDate: string
    onStartDateChange: (date: string) => void
    onEndDateChange: (date: string) => void

    // Parameter selection (optional)
    selectedParam?: ParameterKey
    onParamChange?: (param: ParameterKey) => void

    // Theme & language
    isLight: boolean
    lang: Language

    // Additional
    latestDataTime?: string
    totalRecords?: number
    className?: string
}

const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({
    stations,
    selectedStation,
    onStationChange,
    stationsLoading = false,
    timePeriod,
    onTimePeriodChange,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    selectedParam,
    onParamChange,
    isLight,
    lang,
    latestDataTime,
    totalRecords,
    className = ''
}) => {
    const currentStation = stations.find(s => s.station_id === selectedStation)

    const clearDateFilter = () => {
        onStartDateChange('')
        onEndDateChange('')
    }

    return (
        <Card className={`p-4 ${className}`}>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-gray-700' : 'text-white'}`}>
                        <Icon name="filter_list" size="sm" className="text-primary-500" />
                        {lang === 'th' ? 'ตัวกรองข้อมูล' : 'Data Filters'}
                    </h3>
                    {(startDate || endDate) && (
                        <Badge variant="info" size="sm">
                            <Icon name="date_range" size="xs" />
                            {lang === 'th' ? 'กำหนดช่วงเวลาเอง' : 'Custom Range'}
                        </Badge>
                    )}
                </div>

                {/* Main Filter Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Station Selector */}
                    <div className="md:col-span-4">
                        <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            <Icon name="location_on" size="xs" className="mr-1" />
                            {lang === 'th' ? 'สถานี' : 'Station'}
                        </label>
                        <select
                            value={selectedStation}
                            onChange={(e) => onStationChange(e.target.value)}
                            disabled={stationsLoading}
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all ${isLight
                                ? 'bg-white border-gray-200 text-gray-800 hover:border-primary-400 focus:border-primary-500'
                                : 'bg-dark-700 border-dark-600 text-white hover:border-primary-500 focus:border-primary-500'
                                } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
                        >
                            {stationsLoading ? (
                                <option>{lang === 'th' ? 'กำลังโหลด...' : 'Loading...'}</option>
                            ) : (
                                stations.map(station => (
                                    <option key={station.station_id} value={station.station_id}>
                                        {station.station_id} - {station.name_en || station.name_th || 'Unknown'}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* Time Period Presets */}
                    <div className="md:col-span-4">
                        <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            <Icon name="schedule" size="xs" className="mr-1" />
                            {lang === 'th' ? 'ช่วงเวลา' : 'Time Period'}
                        </label>
                        <div className="flex gap-1">
                            {TIME_PERIODS.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => {
                                        onTimePeriodChange(p.value)
                                        // Clear custom date range when selecting preset
                                        clearDateFilter()
                                    }}
                                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all ${timePeriod === p.value && !startDate && !endDate
                                        ? 'bg-primary-500 text-white shadow-sm'
                                        : isLight
                                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Parameter Selector (optional) */}
                    {selectedParam && onParamChange && (
                        <div className="md:col-span-4">
                            <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                <Icon name="science" size="xs" className="mr-1" />
                                {lang === 'th' ? 'พารามิเตอร์' : 'Parameter'}
                            </label>
                            <select
                                value={selectedParam}
                                onChange={(e) => onParamChange(e.target.value as ParameterKey)}
                                className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all ${isLight
                                    ? 'bg-white border-gray-200 text-gray-800 hover:border-primary-400 focus:border-primary-500'
                                    : 'bg-dark-700 border-dark-600 text-white hover:border-primary-500 focus:border-primary-500'
                                    } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
                            >
                                <option value="pm25">PM2.5</option>
                                <option value="pm10">PM10</option>
                                <option value="o3">O3 (Ozone)</option>
                                <option value="co">CO</option>
                                <option value="no2">NO2</option>
                                <option value="so2">SO2</option>
                                <option value="nox">NOx</option>
                                <option value="temp">Temperature</option>
                                <option value="rh">Humidity</option>
                                <option value="ws">Wind Speed</option>
                                <option value="bp">Pressure</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Date-Time Range Filter Row */}
                <div className={`pt-3 border-t ${isLight ? 'border-gray-100' : 'border-dark-700'}`}>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className={`text-xs font-medium flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            <Icon name="calendar_today" size="xs" />
                            {lang === 'th' ? 'กำหนดเอง:' : 'Custom Range:'}
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                                className={`px-2.5 py-1.5 rounded-lg border text-sm transition-all ${isLight
                                    ? 'bg-white border-gray-200 text-gray-800 focus:border-primary-400'
                                    : 'bg-dark-700 border-dark-600 text-white focus:border-primary-500'
                                    } focus:outline-none focus:ring-1 focus:ring-primary-500/30`}
                                title={lang === 'th' ? 'วันเวลาเริ่มต้น' : 'Start date-time'}
                            />
                            <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                {lang === 'th' ? 'ถึง' : 'to'}
                            </span>
                            <input
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => onEndDateChange(e.target.value)}
                                className={`px-2.5 py-1.5 rounded-lg border text-sm transition-all ${isLight
                                    ? 'bg-white border-gray-200 text-gray-800 focus:border-primary-400'
                                    : 'bg-dark-700 border-dark-600 text-white focus:border-primary-500'
                                    } focus:outline-none focus:ring-1 focus:ring-primary-500/30`}
                                title={lang === 'th' ? 'วันเวลาสิ้นสุด' : 'End date-time'}
                            />
                            {(startDate || endDate) && (
                                <button
                                    onClick={clearDateFilter}
                                    className={`p-1.5 rounded-lg transition-colors ${isLight
                                        ? 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                                        : 'hover:bg-dark-600 text-dark-400 hover:text-dark-200'
                                        }`}
                                    title={lang === 'th' ? 'ล้างตัวกรอง' : 'Clear filter'}
                                >
                                    <Icon name="close" size="sm" />
                                </button>
                            )}
                        </div>

                        {/* Info badges */}
                        <div className="flex items-center gap-2 ml-auto">
                            {totalRecords !== undefined && (
                                <Badge variant="default" size="sm">
                                    <Icon name="table_rows" size="xs" />
                                    {totalRecords.toLocaleString()} {lang === 'th' ? 'รายการ' : 'records'}
                                </Badge>
                            )}
                            {latestDataTime && (
                                <Badge variant="success" size="sm">
                                    <Icon name="update" size="xs" />
                                    {formatDateTime(latestDataTime)}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}

export default SearchFilterPanel
