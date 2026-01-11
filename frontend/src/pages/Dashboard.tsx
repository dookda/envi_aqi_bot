/**
 * Dashboard Page - Premium Redesign
 * Modern air quality monitoring dashboard with full environmental data
 */
import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, Icon, Badge, Spinner } from '../components/atoms'
import { StationSelector, DataTable } from '../components/molecules'
import { StationMap, Navbar, MultiParameterChart } from '../components/organisms'
import { useStations, useChartData } from '../hooks'
import { useLanguage, useTheme } from '../contexts'
import type { Station, AQIHourlyData, ParameterStatistics, TableColumn, Language, ParameterKey, ChartDataResponse } from '../types'

// ============== Type Definitions ==============

interface AQILevelConfig {
    min: number
    max: number
    color: string
    label: string
    labelTh: string
    icon: string
}

interface ThresholdConfig {
    max: number
    color: string
    label: string
}

interface ParameterGaugeProps {
    label: string
    value: number | undefined
    unit: string
    icon: string
    thresholds: ThresholdConfig[]
    maxScale: number
    isLight: boolean
}

interface PollutantConfigItem {
    label: string
    unit: string
    icon: string
    color: string
    gradient: string
}

interface WeatherConfigItem {
    label: string
    unit: string
    icon: string
    color: string
}

interface TimePeriodOption {
    value: number
    label: string
}

interface FullDataResponse extends Partial<ChartDataResponse> {
    data?: AQIHourlyData[]
    statistics?: Record<string, ParameterStatistics>
    total_records?: number
}

interface DataTableViewProps {
    data: AQIHourlyData[] | undefined
    loading: boolean
    selectedParam: ParameterKey
    selectedStation: string
    stations: Station[]
    lang: Language
    isLight: boolean
    onParamChange: (param: ParameterKey) => void
    totalRecords: number | undefined
    latestUpdate?: string
}

type AQILevelKey = 'excellent' | 'good' | 'moderate' | 'unhealthySensitive' | 'unhealthy'
type TabId = 'overview' | 'charts' | 'map'

// ============== Constants ==============

// AQI Level configuration
const AQI_LEVELS: Record<AQILevelKey, AQILevelConfig> = {
    excellent: { min: 0, max: 25, color: '#009966', label: 'Excellent', labelTh: 'ดีมาก', icon: 'sentiment_very_satisfied' },
    good: { min: 26, max: 50, color: '#00e400', label: 'Good', labelTh: 'ดี', icon: 'sentiment_satisfied' },
    moderate: { min: 51, max: 100, color: '#ffff00', label: 'Moderate', labelTh: 'ปานกลาง', icon: 'sentiment_neutral' },
    unhealthySensitive: { min: 101, max: 200, color: '#ff7e00', label: 'Unhealthy (Sensitive)', labelTh: 'มีผลต่อสุขภาพ', icon: 'sentiment_dissatisfied' },
    unhealthy: { min: 201, max: 300, color: '#ff0000', label: 'Unhealthy', labelTh: 'มีผลต่อสุขภาพมาก', icon: 'sentiment_very_dissatisfied' },
}

const getAqiLevel = (value: number | undefined): AQILevelKey | null => {
    if (!value || value <= 0) return null
    if (value <= 25) return 'excellent'
    if (value <= 50) return 'good'
    if (value <= 100) return 'moderate'
    if (value <= 200) return 'unhealthySensitive'
    return 'unhealthy'
}

// Pollutant cards configuration
const POLLUTANT_CONFIG: Record<string, PollutantConfigItem> = {
    pm25: { label: 'PM2.5', unit: 'µg/m³', icon: 'blur_on', color: '#3b82f6', gradient: 'from-blue-500 to-blue-600' },
    pm10: { label: 'PM10', unit: 'µg/m³', icon: 'grain', color: '#8b5cf6', gradient: 'from-purple-500 to-purple-600' },
    o3: { label: 'O₃', unit: 'ppb', icon: 'cloud', color: '#10b981', gradient: 'from-emerald-500 to-emerald-600' },
    co: { label: 'CO', unit: 'ppm', icon: 'local_fire_department', color: '#f59e0b', gradient: 'from-amber-500 to-amber-600' },
    no2: { label: 'NO₂', unit: 'ppb', icon: 'factory', color: '#ef4444', gradient: 'from-red-500 to-red-600' },
    so2: { label: 'SO₂', unit: 'ppb', icon: 'volcano', color: '#ec4899', gradient: 'from-pink-500 to-pink-600' },
}

const WEATHER_CONFIG: Record<string, WeatherConfigItem> = {
    temp: { label: 'Temperature', unit: '°C', icon: 'thermostat', color: '#f97316' },
    rh: { label: 'Humidity', unit: '%', icon: 'water_drop', color: '#0ea5e9' },
    ws: { label: 'Wind Speed', unit: 'm/s', icon: 'air', color: '#06b6d4' },
    wd: { label: 'Wind Dir', unit: '°', icon: 'explore', color: '#14b8a6' },
    bp: { label: 'Pressure', unit: 'mmHg', icon: 'speed', color: '#6366f1' },
    rain: { label: 'Rainfall', unit: 'mm', icon: 'rainy', color: '#22c55e' },
}

const API_BASE = '/ebot/api'

// Time period options
const TIME_PERIODS: TimePeriodOption[] = [
    { value: 1, label: '24h' },
    { value: 3, label: '3d' },
    { value: 7, label: '7d' },
    { value: 14, label: '14d' },
    { value: 30, label: '30d' },
]

// ============== Components ==============

// Parameter Gauge Component - Shows ratio of value vs health thresholds
const ParameterGauge: React.FC<ParameterGaugeProps> = ({
    label,
    value,
    unit,
    icon,
    thresholds,
    maxScale,
    isLight
}) => {
    const percentage = value ? Math.min((value / maxScale) * 100, 100) : 0

    // Find current threshold level
    const currentLevel = thresholds.find(t => value !== undefined && value <= t.max) || thresholds[thresholds.length - 1]

    return (
        <div className={`p-4 rounded-xl ${isLight ? 'bg-gray-50' : 'bg-dark-700/50'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: currentLevel?.color || '#64748b' }}
                    >
                        <Icon name={icon} className="text-white" size="sm" />
                    </div>
                    <div>
                        <span className={`font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                            {label}
                        </span>
                        <span className={`ml-2 text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            {unit}
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-2xl font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                        {value?.toFixed(1) || '—'}
                    </span>
                    <span
                        className="ml-2 text-sm font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${currentLevel?.color}20`, color: currentLevel?.color }}
                    >
                        {currentLevel?.label || '—'}
                    </span>
                </div>
            </div>

            {/* Progress bar with threshold segments */}
            <div className="relative h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-600">
                {/* Threshold gradient segments */}
                <div className="absolute inset-0 flex">
                    {thresholds.map((threshold, idx) => {
                        const prevMax = idx > 0 ? thresholds[idx - 1].max : 0
                        const width = ((threshold.max - prevMax) / maxScale) * 100
                        return (
                            <div
                                key={idx}
                                style={{ width: `${width}%`, backgroundColor: `${threshold.color}40` }}
                            />
                        )
                    })}
                </div>

                {/* Current value indicator */}
                <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                    style={{
                        width: `${percentage}%`,
                        background: `linear-gradient(90deg, ${currentLevel?.color}80, ${currentLevel?.color})`
                    }}
                />

                {/* Value marker */}
                {value && (
                    <div
                        className="absolute top-0 w-1 h-full bg-white shadow-md rounded"
                        style={{ left: `${Math.min(percentage, 99)}%` }}
                    />
                )}
            </div>

            {/* Scale labels */}
            <div className="flex justify-between mt-1">
                <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>0</span>
                <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>{maxScale}</span>
            </div>
        </div>
    )
}

// Data Table View Component
const DataTableView: React.FC<DataTableViewProps> = ({
    data,
    loading,
    selectedParam,
    selectedStation,
    stations,
    lang,
    isLight,
    onParamChange,
    totalRecords
}) => {
    const currentStation = stations.find(s => s.station_id === selectedStation)

    // Define columns dynamically based on language and selected parameter
    const columns: TableColumn<AQIHourlyData>[] = [
        {
            header: lang === 'th' ? 'สถานี' : 'Station',
            accessor: 'station_id',
            render: () => <span className="font-medium">{currentStation ? (currentStation.name_en || currentStation.name_th) : selectedStation}</span>,
            sortable: false
        },
        {
            header: lang === 'th' ? 'วัน-เวลา' : 'Date-Time',
            accessor: 'datetime',
            render: (row) => {
                const date = new Date(row.datetime)
                return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            }
        },
        {
            header: selectedParam.toUpperCase(),
            accessor: selectedParam,
            align: 'center',
            render: (row) => {
                const value = row[selectedParam as keyof AQIHourlyData] as number | undefined
                const isImputed = row.is_imputed || row[`${selectedParam}_imputed` as keyof AQIHourlyData]
                return (
                    <span className={`text-lg font-bold ${isImputed ? 'text-amber-500' : isLight ? 'text-gray-800' : 'text-white'}`}>
                        {value !== null && value !== undefined ? value.toFixed(2) : '—'}
                    </span>
                )
            }
        },
        {
            header: lang === 'th' ? 'สถานะ' : 'Status',
            accessor: 'status',
            align: 'center',
            render: (row) => {
                const value = row[selectedParam as keyof AQIHourlyData]
                const isImputed = row.is_imputed || row[`${selectedParam}_imputed` as keyof AQIHourlyData]
                if (value === null || value === undefined) {
                    return <span className={`text-xs px-2 py-1 rounded-full ${isLight ? 'bg-gray-100 text-gray-500' : 'bg-dark-700 text-dark-400'}`}>Missing</span>
                }
                if (isImputed) {
                    return (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center gap-1 w-fit mx-auto">
                            <Icon name="auto_fix_high" size="xs" />
                            Gap-Filled
                        </span>
                    )
                }
                return (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center gap-1 w-fit mx-auto">
                        <Icon name="check_circle" size="xs" />
                        Measured
                    </span>
                )
            }
        },
        {
            header: lang === 'th' ? 'หมายเหตุ' : 'Note',
            accessor: 'model_version',
            align: 'center',
            render: (row) => row.model_version ? `Model: ${row.model_version}` : '—'
        }
    ]

    return (
        <section>
            <Card className="p-0 overflow-hidden">
                {/* Table Header with Parameter Selection */}
                <div className={`p-4 border-b ${isLight ? 'border-gray-100' : 'border-dark-700'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className={`text-lg font-semibold flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                <Icon name="table_chart" />
                                {lang === 'th' ? 'ข้อมูลรายชั่วโมง' : 'Hourly Data'}
                            </h3>
                            <Badge variant="primary">
                                {totalRecords || data?.length || 0} {lang === 'th' ? 'รายการ' : 'records'}
                            </Badge>
                        </div>

                        {/* Parameter Selector in Table Header */}
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isLight ? 'text-gray-600' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'พารามิเตอร์:' : 'Parameter:'}
                            </span>
                            <select
                                value={selectedParam}
                                onChange={(e) => onParamChange(e.target.value as ParameterKey)}
                                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${isLight
                                    ? 'bg-white border-gray-200 text-gray-800 hover:border-primary-400'
                                    : 'bg-dark-700 border-dark-600 text-white hover:border-primary-500'
                                    }`}
                            >
                                <option value="pm25">PM2.5</option>
                                <option value="pm10">PM10</option>
                                <option value="o3">O3 (Ozone)</option>
                                <option value="co">CO</option>
                                <option value="no2">NO2</option>
                                <option value="so2">SO2</option>
                                <option value="temp">Temperature</option>
                                <option value="rh">Humidity</option>
                                <option value="ws">Wind Speed</option>
                                <option value="bp">Pressure</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* DataTable */}
                <DataTable
                    columns={columns}
                    data={data || []}
                    loading={loading}
                    emptyMessage={lang === 'th' ? 'ไม่พบข้อมูล' : 'No data available'}
                    pageSize={15}
                />
            </Card>
        </section>
    )
}

// ============== Main Dashboard Component ==============

export default function Dashboard(): React.ReactElement {
    const { stations, loading: stationsLoading } = useStations()
    const { data: chartData, fetchChartData } = useChartData()
    const { t, lang } = useLanguage()
    const { isLight } = useTheme()
    const [searchParams] = useSearchParams()

    const [selectedStation, setSelectedStation] = useState<string>('')
    const [timePeriod, setTimePeriod] = useState<number>(7)
    const [showAnomalies, setShowAnomalies] = useState<boolean>(true)
    const [fullData, setFullData] = useState<FullDataResponse | null>(null)
    const [fullDataLoading, setFullDataLoading] = useState<boolean>(false)
    const [activeTab, setActiveTab] = useState<TabId>('overview')
    const [selectedParam, setSelectedParam] = useState<ParameterKey>('pm25')

    // Fetch full environmental data
    const fetchFullData = useCallback(async (): Promise<void> => {
        if (!selectedStation) return
        setFullDataLoading(true)
        try {
            const endDate = new Date().toISOString()
            const startDate = new Date(Date.now() - timePeriod * 24 * 60 * 60 * 1000).toISOString()
            const response = await fetch(
                `${API_BASE}/aqi/full/${selectedStation}?start=${startDate}&end=${endDate}&limit=720`
            )
            if (response.ok) {
                const data: FullDataResponse = await response.json()
                setFullData(data)
            }
        } catch (err) {
            console.error('Failed to fetch full data:', err)
        } finally {
            setFullDataLoading(false)
        }
    }, [selectedStation, timePeriod])

    // Load chart data when station or period changes
    useEffect(() => {
        if (selectedStation) {
            fetchChartData(selectedStation, timePeriod)
            fetchFullData()
        }
    }, [selectedStation, timePeriod, fetchChartData, fetchFullData])

    // Auto-select station from URL parameter or first station
    useEffect(() => {
        if (stations.length > 0 && !selectedStation) {
            const stationFromUrl = searchParams.get('station')
            if (stationFromUrl && stations.find(s => s.station_id === stationFromUrl)) {
                setSelectedStation(stationFromUrl)
            } else {
                setSelectedStation(stations[0].station_id)
            }
        }
    }, [stations, selectedStation, searchParams])

    const stats = chartData?.statistics || {}
    const currentStation = stations.find(s => s.station_id === selectedStation)
    const latestData = fullData?.data?.[0] || {} as AQIHourlyData
    const currentPm25 = latestData.pm25 || (stats as any).mean
    const aqiLevel = getAqiLevel(currentPm25)
    const aqiConfig = aqiLevel ? AQI_LEVELS[aqiLevel] : null

    // Calculate wind direction arrow
    const getWindArrow = (degrees: number | undefined): string => {
        if (!degrees && degrees !== 0) return '—'
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
        const index = Math.round(degrees / 45) % 8
        return directions[index]
    }

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50' : 'gradient-dark'}`}>
            {/* Header */}
            <Navbar
                title={t('dashboard.title')}
                subtitle={currentStation ? (currentStation.name_en || currentStation.name_th) : t('dashboard.subtitle')}
            >
                <Link
                    to="/chat"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="smart_toy" size="sm" />
                    {t('dashboard.aiChat')}
                </Link>
                <Link
                    to="/models"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="psychology" size="sm" />
                    {t('dashboard.modelsStatus')}
                </Link>
                <Link
                    to="/admin"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="admin_panel_settings" size="sm" />
                    Admin
                </Link>
            </Navbar>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Hero Section - Current AQI Status */}
                <section className="mb-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main AQI Card */}
                        <Card className={`lg:col-span-1 relative overflow-hidden ${aqiConfig ? '' : ''}`}>
                            <div
                                className="absolute inset-0 opacity-20"
                                style={{ background: aqiConfig ? `linear-gradient(135deg, ${aqiConfig.color}40, ${aqiConfig.color}10)` : 'transparent' }}
                            />
                            <div className="relative z-10 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-lg font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                        {lang === 'th' ? 'คุณภาพอากาศ' : 'Air Quality'}
                                    </h2>
                                    {aqiConfig && (
                                        <Badge
                                            variant="primary"
                                            className="text-white"
                                            style={{ backgroundColor: aqiConfig.color }}
                                        >
                                            {lang === 'th' ? aqiConfig.labelTh : aqiConfig.label}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-24 h-24 rounded-2xl flex items-center justify-center"
                                        style={{ backgroundColor: aqiConfig?.color || '#64748b' }}
                                    >
                                        <span className="text-4xl font-bold text-white">
                                            {currentPm25?.toFixed(0) || '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className={`text-3xl font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                            PM2.5
                                        </p>
                                        <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                            µg/m³
                                        </p>
                                        {aqiConfig && (
                                            <div className="flex items-center gap-1 mt-2">
                                                <Icon name={aqiConfig.icon} style={{ color: aqiConfig.color }} />
                                                <span style={{ color: aqiConfig.color }} className="text-sm font-medium">
                                                    {lang === 'th' ? aqiConfig.labelTh : aqiConfig.label}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Station Selector */}
                                <div className="mt-6">
                                    <StationSelector
                                        stations={stations}
                                        value={selectedStation}
                                        onChange={setSelectedStation}
                                        loading={stationsLoading}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Weather Summary Card */}
                        <Card className="lg:col-span-2 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`text-lg font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                    <Icon name="cloud" className="mr-2" />
                                    {lang === 'th' ? 'สภาพอากาศ' : 'Weather Conditions'}
                                </h2>
                                <div className="flex gap-2">
                                    {TIME_PERIODS.map(p => (
                                        <button
                                            key={p.value}
                                            onClick={() => setTimePeriod(p.value)}
                                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${timePeriod === p.value
                                                ? 'bg-primary-500 text-white'
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

                            {fullDataLoading ? (
                                <div className="flex items-center justify-center h-32">
                                    <Spinner size="lg" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                    {Object.entries(WEATHER_CONFIG).map(([key, config]) => {
                                        const value = latestData[key as keyof AQIHourlyData] as number | undefined
                                        const displayValue = key === 'wd' ? getWindArrow(value) : value?.toFixed(1) || '—'

                                        return (
                                            <div
                                                key={key}
                                                className={`p-4 rounded-xl text-center ${isLight ? 'bg-gray-50' : 'bg-dark-700/50'}`}
                                            >
                                                <Icon
                                                    name={config.icon}
                                                    size="lg"
                                                    style={{ color: config.color }}
                                                />
                                                <p className={`text-2xl font-bold mt-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                                    {displayValue}
                                                </p>
                                                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                    {config.label}
                                                </p>
                                                <p className={`text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                                    {key === 'wd' ? `${value?.toFixed(0) || '—'}°` : config.unit}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </Card>
                    </div>
                </section>

                {/* Pollutant Cards */}
                <section className="mb-8">
                    <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                        <Icon name="science" />
                        {lang === 'th' ? 'มลพิษทางอากาศ' : 'Air Pollutants'}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {Object.entries(POLLUTANT_CONFIG).map(([key, config]) => {
                            const value = latestData[key as keyof AQIHourlyData] as number | undefined
                            const statistics = fullData?.statistics?.[key]

                            return (
                                <Card
                                    key={key}
                                    className={`relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer`}
                                >
                                    <div
                                        className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-10 group-hover:opacity-20 transition-opacity`}
                                    />
                                    <div className="relative z-10 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <Icon name={config.icon} style={{ color: config.color }} />
                                            <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                {config.unit}
                                            </span>
                                        </div>
                                        <p className={`text-2xl font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                            {value?.toFixed(1) || '—'}
                                        </p>
                                        <p className={`text-sm font-medium ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                                            {config.label}
                                        </p>
                                        {statistics && (
                                            <div className={`mt-2 text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                                <span>Avg: {statistics.avg?.toFixed(1)}</span>
                                                <span className="mx-1">|</span>
                                                <span>Max: {statistics.max?.toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </section>

                {/* Tab Navigation */}
                <section className="mb-6">
                    <div className={`flex gap-2 p-1 rounded-xl ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                        {([
                            { id: 'overview' as TabId, label: lang === 'th' ? 'ภาพรวม' : 'Overview', icon: 'dashboard' },
                            { id: 'charts' as TabId, label: lang === 'th' ? 'กราฟ' : 'Charts', icon: 'show_chart' },
                            { id: 'map' as TabId, label: lang === 'th' ? 'ข้อมูล' : 'Data', icon: 'table_chart' },
                        ]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-primary-500 text-white shadow-lg'
                                    : isLight
                                        ? 'text-gray-600 hover:bg-gray-200'
                                        : 'text-dark-400 hover:bg-dark-700'
                                    }`}
                            >
                                <Icon name={tab.icon} size="sm" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
                        {/* Map */}
                        <StationMap
                            stations={stations}
                            selectedStation={selectedStation}
                            onStationSelect={setSelectedStation}
                            loading={stationsLoading}
                            height={400}
                            showAnomalies={showAnomalies}
                            onShowAnomaliesChange={setShowAnomalies}
                        />

                        {/* AQI Guide */}
                        <Card className="p-6">
                            <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                <Icon name="info" className="mr-2" />
                                {lang === 'th' ? 'ระดับคุณภาพอากาศ' : 'AQI Levels'}
                            </h3>
                            <div className="space-y-3">
                                {(Object.entries(AQI_LEVELS) as [AQILevelKey, AQILevelConfig][]).map(([key, level]) => (
                                    <div
                                        key={key}
                                        className={`flex items-center gap-3 p-3 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-dark-700/50'}`}
                                    >
                                        <div
                                            className="w-12 h-12 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: level.color }}
                                        >
                                            <Icon name={level.icon} className="text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                                {lang === 'th' ? level.labelTh : level.label}
                                            </p>
                                            <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                {level.min} - {level.max} µg/m³
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </section>
                )}

                {activeTab === 'charts' && (
                    <section className="space-y-6">
                        {/* Multi-Parameter Chart with Gap-Fill & Spike Detection */}
                        <MultiParameterChart
                            stationId={selectedStation}
                            timePeriod={timePeriod}
                            height={500}
                            selectedParam={selectedParam}
                            onParamChange={setSelectedParam}
                            externalData={fullData as ChartDataResponse | null}
                            loading={fullDataLoading}
                        />

                        {/* Parameter Ratio Gauges - Quick Reference */}
                        <Card className="p-6">
                            <h3 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                <Icon name="speed" />
                                {lang === 'th' ? 'ระดับมลพิษตามมาตรฐาน' : 'Pollutant Levels vs Standards'}
                            </h3>

                            <div className="space-y-5">
                                {/* PM2.5 Gauge */}
                                <ParameterGauge
                                    label="PM2.5"
                                    value={latestData.pm25}
                                    unit="µg/m³"
                                    icon="blur_on"
                                    thresholds={[
                                        { max: 25, color: '#009966', label: lang === 'th' ? 'ดีมาก' : 'Excellent' },
                                        { max: 50, color: '#00e400', label: lang === 'th' ? 'ดี' : 'Good' },
                                        { max: 100, color: '#ffff00', label: lang === 'th' ? 'ปานกลาง' : 'Moderate' },
                                        { max: 200, color: '#ff7e00', label: lang === 'th' ? 'มีผลต่อสุขภาพ' : 'Unhealthy' },
                                        { max: 300, color: '#ff0000', label: lang === 'th' ? 'อันตราย' : 'Hazardous' },
                                    ]}
                                    maxScale={300}
                                    isLight={isLight}
                                />

                                {/* PM10 Gauge */}
                                <ParameterGauge
                                    label="PM10"
                                    value={latestData.pm10}
                                    unit="µg/m³"
                                    icon="grain"
                                    thresholds={[
                                        { max: 50, color: '#009966', label: lang === 'th' ? 'ดีมาก' : 'Excellent' },
                                        { max: 80, color: '#00e400', label: lang === 'th' ? 'ดี' : 'Good' },
                                        { max: 120, color: '#ffff00', label: lang === 'th' ? 'ปานกลาง' : 'Moderate' },
                                        { max: 180, color: '#ff7e00', label: lang === 'th' ? 'มีผลต่อสุขภาพ' : 'Unhealthy' },
                                        { max: 250, color: '#ff0000', label: lang === 'th' ? 'อันตราย' : 'Hazardous' },
                                    ]}
                                    maxScale={250}
                                    isLight={isLight}
                                />

                                {/* O3 Gauge */}
                                <ParameterGauge
                                    label="O₃"
                                    value={latestData.o3}
                                    unit="ppb"
                                    icon="cloud"
                                    thresholds={[
                                        { max: 35, color: '#009966', label: lang === 'th' ? 'ดีมาก' : 'Excellent' },
                                        { max: 70, color: '#00e400', label: lang === 'th' ? 'ดี' : 'Good' },
                                        { max: 120, color: '#ffff00', label: lang === 'th' ? 'ปานกลาง' : 'Moderate' },
                                        { max: 200, color: '#ff7e00', label: lang === 'th' ? 'มีผลต่อสุขภาพ' : 'Unhealthy' },
                                        { max: 300, color: '#ff0000', label: lang === 'th' ? 'อันตราย' : 'Hazardous' },
                                    ]}
                                    maxScale={300}
                                    isLight={isLight}
                                />

                                {/* CO Gauge */}
                                <ParameterGauge
                                    label="CO"
                                    value={latestData.co}
                                    unit="ppm"
                                    icon="local_fire_department"
                                    thresholds={[
                                        { max: 4.4, color: '#009966', label: lang === 'th' ? 'ดีมาก' : 'Excellent' },
                                        { max: 6.4, color: '#00e400', label: lang === 'th' ? 'ดี' : 'Good' },
                                        { max: 9.0, color: '#ffff00', label: lang === 'th' ? 'ปานกลาง' : 'Moderate' },
                                        { max: 15, color: '#ff7e00', label: lang === 'th' ? 'มีผลต่อสุขภาพ' : 'Unhealthy' },
                                        { max: 30, color: '#ff0000', label: lang === 'th' ? 'อันตราย' : 'Hazardous' },
                                    ]}
                                    maxScale={30}
                                    isLight={isLight}
                                />

                                {/* NO2 Gauge */}
                                <ParameterGauge
                                    label="NO₂"
                                    value={latestData.no2}
                                    unit="ppb"
                                    icon="factory"
                                    thresholds={[
                                        { max: 60, color: '#009966', label: lang === 'th' ? 'ดีมาก' : 'Excellent' },
                                        { max: 106, color: '#00e400', label: lang === 'th' ? 'ดี' : 'Good' },
                                        { max: 170, color: '#ffff00', label: lang === 'th' ? 'ปานกลาง' : 'Moderate' },
                                        { max: 340, color: '#ff7e00', label: lang === 'th' ? 'มีผลต่อสุขภาพ' : 'Unhealthy' },
                                        { max: 500, color: '#ff0000', label: lang === 'th' ? 'อันตราย' : 'Hazardous' },
                                    ]}
                                    maxScale={500}
                                    isLight={isLight}
                                />

                                {/* SO2 Gauge */}
                                <ParameterGauge
                                    label="SO₂"
                                    value={latestData.so2}
                                    unit="ppb"
                                    icon="volcano"
                                    thresholds={[
                                        { max: 100, color: '#009966', label: lang === 'th' ? 'ดีมาก' : 'Excellent' },
                                        { max: 200, color: '#00e400', label: lang === 'th' ? 'ดี' : 'Good' },
                                        { max: 350, color: '#ffff00', label: lang === 'th' ? 'ปานกลาง' : 'Moderate' },
                                        { max: 500, color: '#ff7e00', label: lang === 'th' ? 'มีผลต่อสุขภาพ' : 'Unhealthy' },
                                        { max: 700, color: '#ff0000', label: lang === 'th' ? 'อันตราย' : 'Hazardous' },
                                    ]}
                                    maxScale={700}
                                    isLight={isLight}
                                />
                            </div>
                        </Card>
                    </section>
                )}

                {activeTab === 'map' && ( // "map" is the ID for "Data" tab now
                    <DataTableView
                        data={fullData?.data}
                        loading={fullDataLoading}
                        selectedParam={selectedParam}
                        selectedStation={selectedStation}
                        stations={stations}
                        lang={lang}
                        isLight={isLight}
                        onParamChange={setSelectedParam}
                        totalRecords={fullData?.total_records}
                        latestUpdate={fullData?.data?.[0]?.datetime}
                    />
                )}

                {/* Data Source Info */}
                <section className="mt-8">
                    <Card className="p-4">
                        <div className={`flex flex-wrap items-center gap-4 text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            <div className="flex items-center gap-2">
                                <Icon name="verified" size="sm" color="success" />
                                <span>{lang === 'th' ? 'แหล่งข้อมูล: Air4Thai API' : 'Data Source: Air4Thai API'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Icon name="schedule" size="sm" />
                                <span>{lang === 'th' ? 'อัพเดทรายชั่วโมง' : 'Hourly Updates'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Icon name="science" size="sm" />
                                <span>{fullData?.total_records || 0} {lang === 'th' ? 'จุดข้อมูล' : 'data points'}</span>
                            </div>
                            {fullData?.data?.[0]?.datetime && (
                                <div className="flex items-center gap-2">
                                    <Icon name="update" size="sm" />
                                    <span>{lang === 'th' ? 'ล่าสุด:' : 'Latest:'} {new Date(fullData.data[0].datetime).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </Card>
                </section>
            </main>
        </div>
    )
}
