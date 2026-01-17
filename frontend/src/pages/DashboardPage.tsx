/**
 * Dashboard Page - Premium Redesign
 * Modern air quality monitoring dashboard with full environmental data
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
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

// AQI Level configuration (Thailand Standard - ดัชนี AQI ประเทศไทย)
const AQI_LEVELS: Record<AQILevelKey, AQILevelConfig> = {
    excellent: { min: 0, max: 25, color: '#00bcd4', label: 'Excellent', labelTh: 'ดีมาก', icon: 'sentiment_very_satisfied' },
    good: { min: 26, max: 50, color: '#4caf50', label: 'Good', labelTh: 'ดี', icon: 'sentiment_satisfied' },
    moderate: { min: 51, max: 100, color: '#ffeb3b', label: 'Moderate', labelTh: 'ปานกลาง', icon: 'sentiment_neutral' },
    unhealthySensitive: { min: 101, max: 200, color: '#ff9800', label: 'Unhealthy', labelTh: 'เริ่มมีผลกระทบ', icon: 'sentiment_dissatisfied' },
    unhealthy: { min: 201, max: 500, color: '#f44336', label: 'Hazardous', labelTh: 'มีผลกระทบ', icon: 'sentiment_very_dissatisfied' },
}

const getAqiLevel = (value: number | undefined): AQILevelKey | null => {
    if (!value || value <= 0) return null
    if (value <= 25) return 'excellent'
    if (value <= 50) return 'good'
    if (value <= 100) return 'moderate'
    if (value <= 200) return 'unhealthySensitive'
    return 'unhealthy'
}

// Pollutant cards configuration (PM2.5 excluded - shown in main AQI card)
const POLLUTANT_CONFIG: Record<string, PollutantConfigItem> = {
    pm10: { label: 'PM10', unit: 'µg/m³', icon: 'grain', color: '#8b5cf6', gradient: 'from-purple-500 to-purple-600' },
    o3: { label: 'O₃', unit: 'ppb', icon: 'cloud', color: '#10b981', gradient: 'from-emerald-500 to-emerald-600' },
    co: { label: 'CO', unit: 'ppm', icon: 'local_fire_department', color: '#f59e0b', gradient: 'from-amber-500 to-amber-600' },
    no2: { label: 'NO₂', unit: 'ppb', icon: 'factory', color: '#ef4444', gradient: 'from-red-500 to-red-600' },
    so2: { label: 'SO₂', unit: 'ppb', icon: 'volcano', color: '#ec4899', gradient: 'from-pink-500 to-pink-600' },
    nox: { label: 'NOₓ', unit: 'ppb', icon: 'air_purifier', color: '#f97316', gradient: 'from-orange-500 to-orange-600' },
}

const WEATHER_CONFIG: Record<string, WeatherConfigItem> = {
    temp: { label: 'Temperature', unit: '°C', icon: 'thermostat', color: '#f97316' },
    rh: { label: 'Humidity', unit: '%', icon: 'water_drop', color: '#0ea5e9' },
    ws: { label: 'Wind Speed', unit: 'm/s', icon: 'air', color: '#06b6d4' },
    wd: { label: 'Wind Dir', unit: '°', icon: 'explore', color: '#14b8a6' },
    bp: { label: 'Pressure', unit: 'mmHg', icon: 'speed', color: '#6366f1' },
    rain: { label: 'Rainfall', unit: 'mm', icon: 'rainy', color: '#22c55e' },
}

const API_BASE = '/api'

// Time period options
const TIME_PERIODS: TimePeriodOption[] = [
    { value: 1, label: '24h' },
    { value: 3, label: '3d' },
    { value: 7, label: '7d' },
    { value: 14, label: '14d' },
    { value: 30, label: '30d' },
    { value: 365, label: '1y' }, // Add 1 year option
]

// ============== Components ==============

// AI Insights Panel Types
interface ChartAIInsight {
    status: string
    insight: string | null
    highlights: string[] | null
    health_advice: string | null
    trend_summary: string | null
    error: string | null
}

interface AIInsightsPanelProps {
    stationId: string
    stationName: string | null
    parameter: ParameterKey
    timePeriod: number
    statistics: Record<string, ParameterStatistics> | undefined
    dataPoints: number | undefined
    isLight: boolean
    lang: Language
}

// AI Insights Panel Component
const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
    stationId,
    stationName,
    parameter,
    timePeriod,
    statistics,
    dataPoints,
    isLight,
    lang
}) => {
    const [insight, setInsight] = useState<ChartAIInsight | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [isExpanded, setIsExpanded] = useState<boolean>(true)

    const fetchInsight = useCallback(async () => {
        if (!stationId || !statistics) return

        setLoading(true)
        try {
            const paramStats = statistics[parameter] || {}

            const response = await fetch(`${API_BASE}/chart/insight`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    station_id: stationId,
                    station_name: stationName,
                    parameter: parameter,
                    time_period_days: timePeriod,
                    statistics: paramStats,
                    data_points: dataPoints
                })
            })

            if (response.ok) {
                const data: ChartAIInsight = await response.json()
                setInsight(data)
            } else {
                setInsight({
                    status: 'error',
                    insight: null,
                    highlights: null,
                    health_advice: null,
                    trend_summary: null,
                    error: 'Failed to fetch insights'
                })
            }
        } catch (err) {
            console.error('Failed to fetch AI insight:', err)
            setInsight({
                status: 'error',
                insight: null,
                highlights: null,
                health_advice: null,
                trend_summary: null,
                error: 'Network error'
            })
        } finally {
            setLoading(false)
        }
    }, [stationId, stationName, parameter, timePeriod, statistics, dataPoints])

    // Fetch insight when dependencies change
    useEffect(() => {
        if (stationId && statistics && Object.keys(statistics).length > 0) {
            fetchInsight()
        }
    }, [stationId, parameter, timePeriod, fetchInsight])

    return (
        <Card className="p-0 overflow-hidden">
            {/* Header */}
            <div
                className={`px-4 py-3 flex items-center justify-between cursor-pointer border-b ${isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-dark-700 hover:bg-dark-700/50'}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Icon name="psychology" className="text-white" />
                    </div>
                    <div>
                        <h3 className={`font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                            {lang === 'th' ? '🤖 AI วิเคราะห์กราฟ' : '🤖 AI Chart Analysis'}
                        </h3>
                        {insight?.trend_summary && (
                            <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {insight.trend_summary}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            fetchInsight()
                        }}
                        disabled={loading}
                        className={`p-2 rounded-lg transition-all ${isLight ? 'hover:bg-gray-100' : 'hover:bg-dark-600'}`}
                    >
                        <Icon
                            name="refresh"
                            size="sm"
                            className={`${loading ? 'animate-spin' : ''} ${isLight ? 'text-gray-500' : 'text-dark-400'}`}
                        />
                    </button>
                    <Icon
                        name={isExpanded ? 'expand_less' : 'expand_more'}
                        className={isLight ? 'text-gray-500' : 'text-dark-400'}
                    />
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Spinner size="md" />
                            <span className={`ml-3 text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'กำลังวิเคราะห์...' : 'Analyzing...'}
                            </span>
                        </div>
                    ) : insight?.status === 'success' && insight.insight ? (
                        <div className="space-y-4">
                            {/* Main Insight */}
                            <div className={`prose prose-sm max-w-none ${isLight ? 'prose-gray' : 'prose-invert'}`}>
                                {insight.insight.split('\n\n').map((paragraph, idx) => (
                                    <p
                                        key={idx}
                                        className={`text-sm leading-relaxed ${isLight ? 'text-gray-700' : 'text-dark-200'}`}
                                        dangerouslySetInnerHTML={{
                                            __html: paragraph
                                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                .replace(/\n/g, '<br/>')
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Highlights */}
                            {insight.highlights && insight.highlights.length > 0 && (
                                <div className={`rounded-lg p-3 ${isLight ? 'bg-blue-50' : 'bg-dark-700/50'}`}>
                                    <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>
                                        <Icon name="stars" size="xs" />
                                        {lang === 'th' ? 'จุดสำคัญ' : 'Key Highlights'}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {insight.highlights.map((highlight, idx) => (
                                            <span
                                                key={idx}
                                                className={`text-xs px-2 py-1 rounded-full ${isLight ? 'bg-white text-gray-700 border border-gray-200' : 'bg-dark-600 text-dark-200'}`}
                                            >
                                                {highlight}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Health Advice */}
                            {insight.health_advice && (
                                <div className={`rounded-lg p-3 border-l-4 ${insight.health_advice.includes('🔴')
                                    ? isLight ? 'bg-red-50 border-red-500' : 'bg-red-900/20 border-red-500'
                                    : insight.health_advice.includes('🟠')
                                        ? isLight ? 'bg-orange-50 border-orange-500' : 'bg-orange-900/20 border-orange-500'
                                        : insight.health_advice.includes('⚠️')
                                            ? isLight ? 'bg-amber-50 border-amber-500' : 'bg-amber-900/20 border-amber-500'
                                            : isLight ? 'bg-emerald-50 border-emerald-500' : 'bg-emerald-900/20 border-emerald-500'
                                    }`}>
                                    <h4 className={`text-xs font-semibold mb-1 flex items-center gap-1 ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                        <Icon name="health_and_safety" size="xs" />
                                        {lang === 'th' ? 'คำแนะนำสุขภาพ' : 'Health Advice'}
                                    </h4>
                                    <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                        {insight.health_advice}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : insight?.status === 'error' ? (
                        <div className={`text-center py-6 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            <Icon name="error_outline" size="lg" className="mb-2" />
                            <p className="text-sm">{lang === 'th' ? 'ไม่สามารถโหลดข้อมูลได้' : 'Failed to load insights'}</p>
                            <button
                                onClick={fetchInsight}
                                className="mt-2 text-primary-500 text-sm hover:underline"
                            >
                                {lang === 'th' ? 'ลองใหม่' : 'Try again'}
                            </button>
                        </div>
                    ) : (
                        <div className={`text-center py-6 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            <Icon name="insights" size="lg" className="mb-2" />
                            <p className="text-sm">{lang === 'th' ? 'เลือกสถานีเพื่อดูการวิเคราะห์' : 'Select a station to see analysis'}</p>
                        </div>
                    )}
                </div>
            )}
        </Card>
    )
}

// Status filter type
type StatusFilter = 'all' | 'measured' | 'imputed' | 'missing' | 'negative'

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
    const [startDate, setStartDate] = useState<string>('')
    const [endDate, setEndDate] = useState<string>('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

    const currentStation = stations.find(s => s.station_id === selectedStation)

    // Filter data based on date range and status
    const filteredData = useMemo(() => {
        if (!data) return []

        return data.filter(row => {
            // Date range filter
            if (startDate || endDate) {
                const rowDate = new Date(row.datetime)
                if (startDate) {
                    const start = new Date(startDate)
                    start.setHours(0, 0, 0, 0)
                    if (rowDate < start) return false
                }
                if (endDate) {
                    const end = new Date(endDate)
                    end.setHours(23, 59, 59, 999)
                    if (rowDate > end) return false
                }
            }

            // Status filter
            const value = row[selectedParam as keyof AQIHourlyData] as number | null | undefined
            const isImputed = row.is_imputed || row[`${selectedParam}_imputed` as keyof AQIHourlyData]

            if (statusFilter === 'measured') {
                return value !== null && value !== undefined && !isImputed
            }
            if (statusFilter === 'imputed') {
                return isImputed
            }
            if (statusFilter === 'missing') {
                return value === null || value === undefined
            }
            if (statusFilter === 'negative') {
                return value !== null && value !== undefined && value < 0
            }

            return true
        })
    }, [data, startDate, endDate, statusFilter, selectedParam])

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

    // Count stats for filter badges
    const stats = useMemo(() => {
        if (!data) return { measured: 0, imputed: 0, missing: 0, negative: 0 }
        return data.reduce((acc, row) => {
            const value = row[selectedParam as keyof AQIHourlyData] as number | null | undefined
            const isImputed = row.is_imputed || row[`${selectedParam}_imputed` as keyof AQIHourlyData]
            if (value === null || value === undefined) {
                acc.missing++
            } else if (isImputed) {
                acc.imputed++
            } else {
                acc.measured++
            }
            // Count negative values separately
            if (value !== null && value !== undefined && value < 0) {
                acc.negative++
            }
            return acc
        }, { measured: 0, imputed: 0, missing: 0, negative: 0 })
    }, [data, selectedParam])

    return (
        <section>
            <Card className="p-0 overflow-hidden">
                {/* Table Header with Parameter Selection */}
                <div className={`p-4 border-b ${isLight ? 'border-gray-100' : 'border-dark-700'}`}>
                    <div className="flex flex-col gap-4">
                        {/* Top row: Title and Parameter selector */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <h3 className={`text-lg font-semibold flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                    <Icon name="table_chart" />
                                    {lang === 'th' ? 'ข้อมูลรายชั่วโมง' : 'Hourly Data'}
                                </h3>
                                <Badge variant="primary">
                                    {filteredData.length}/{totalRecords || data?.length || 0} {lang === 'th' ? 'รายการ' : 'records'}
                                </Badge>
                            </div>

                            {/* Parameter Selector */}
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
                                    <option value="nox">NOx</option>
                                    <option value="temp">Temperature</option>
                                    <option value="rh">Humidity</option>
                                    <option value="ws">Wind Speed</option>
                                    <option value="bp">Pressure</option>
                                </select>
                            </div>
                        </div>

                        {/* Bottom row: Date Range and Status Filters */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            {/* Date Range Filter */}
                            <div className="flex items-center gap-2">
                                <Icon
                                    name="calendar_today"
                                    size="sm"
                                    className={isLight ? 'text-gray-400' : 'text-dark-500'}
                                />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className={`px-2 py-1.5 rounded-lg border text-sm transition-all ${isLight
                                        ? 'bg-white border-gray-200 text-gray-800 focus:border-primary-400'
                                        : 'bg-dark-700 border-dark-600 text-white focus:border-primary-500'
                                        } focus:outline-none focus:ring-1 focus:ring-primary-500/30`}
                                />
                                <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                    {lang === 'th' ? 'ถึง' : 'to'}
                                </span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={`px-2 py-1.5 rounded-lg border text-sm transition-all ${isLight
                                        ? 'bg-white border-gray-200 text-gray-800 focus:border-primary-400'
                                        : 'bg-dark-700 border-dark-600 text-white focus:border-primary-500'
                                        } focus:outline-none focus:ring-1 focus:ring-primary-500/30`}
                                />
                                {(startDate || endDate) && (
                                    <button
                                        onClick={() => { setStartDate(''); setEndDate(''); }}
                                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-600`}
                                        title={lang === 'th' ? 'ล้างตัวกรอง' : 'Clear filter'}
                                    >
                                        <Icon name="close" size="xs" className={isLight ? 'text-gray-400' : 'text-dark-400'} />
                                    </button>
                                )}
                            </div>

                            {/* Status Filter Buttons */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-medium mr-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                    {lang === 'th' ? 'สถานะ:' : 'Status:'}
                                </span>
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${statusFilter === 'all'
                                        ? 'bg-primary-500 text-white'
                                        : isLight
                                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                        }`}
                                >
                                    {lang === 'th' ? 'ทั้งหมด' : 'All'}
                                </button>
                                <button
                                    onClick={() => setStatusFilter('measured')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${statusFilter === 'measured'
                                        ? 'bg-emerald-500 text-white'
                                        : isLight
                                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                            : 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
                                        }`}
                                >
                                    <Icon name="check_circle" size="xs" />
                                    {lang === 'th' ? 'วัดจริง' : 'Measured'} ({stats.measured})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('imputed')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${statusFilter === 'imputed'
                                        ? 'bg-amber-500 text-white'
                                        : isLight
                                            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                            : 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50'
                                        }`}
                                >
                                    <Icon name="auto_fix_high" size="xs" />
                                    {lang === 'th' ? 'เติมค่า' : 'Gap-Filled'} ({stats.imputed})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('missing')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${statusFilter === 'missing'
                                        ? 'bg-gray-500 text-white'
                                        : isLight
                                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                                        }`}
                                >
                                    <Icon name="help_outline" size="xs" />
                                    {lang === 'th' ? 'ขาดหาย' : 'Missing'} ({stats.missing})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('negative')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${statusFilter === 'negative'
                                        ? 'bg-red-600 text-white'
                                        : isLight
                                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                            : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                                        }`}
                                >
                                    <Icon name="remove_circle" size="xs" />
                                    {lang === 'th' ? 'ค่าติดลบ' : 'Negative'} ({stats.negative})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* DataTable */}
                <DataTable
                    columns={columns}
                    data={filteredData}
                    loading={loading}
                    emptyMessage={(startDate || endDate) || statusFilter !== 'all'
                        ? (lang === 'th' ? 'ไม่พบข้อมูลที่ตรงกับตัวกรอง' : 'No data matches the filter')
                        : (lang === 'th' ? 'ไม่พบข้อมูล' : 'No data available')
                    }
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
    const [activeTab, setActiveTab] = useState<TabId>('map')
    const [selectedParam, setSelectedParam] = useState<ParameterKey>('pm25')

    // Fetch full environmental data
    const fetchFullData = useCallback(async (): Promise<void> => {
        if (!selectedStation) return
        setFullDataLoading(true)
        try {
            const endDate = new Date().toISOString()
            const startDate = new Date(Date.now() - timePeriod * 24 * 60 * 60 * 1000).toISOString()
            const limit = timePeriod * 24

            const response = await fetch(
                `${API_BASE}/aqi/full/${selectedStation}?start=${startDate}&end=${endDate}&limit=${limit}`
            )

            if (response.ok) {
                const data: FullDataResponse = await response.json()
                setFullData(data)

                // If no data found for this period, check if there is ANY data for this station
                if ((!data.data || data.data.length === 0) && timePeriod <= 30) {
                    try {
                        const latestResp = await fetch(`${API_BASE}/aqi/${selectedStation}/latest`)
                        if (latestResp.ok) {
                            const latest = await latestResp.json()
                            const latestDate = new Date(latest.datetime)
                            console.log("No data in range, but found latest data at:", latestDate)
                            // We could optionally auto-switch or notify here. 
                            // For now, let's just log it. The 1y option will help find it.
                        }
                    } catch (e) {
                        // ignore
                    }
                }
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
                                            {currentPm25?.toFixed(2) || '—'}
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

                {/* Overview Section - Now always visible above tabs */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch">
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

                    {/* AQI Guide - Height matches map, no scroll */}
                    <Card className="p-4 h-[400px] flex flex-col">
                        <h3 className={`text-base font-semibold mb-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                            <Icon name="info" className="mr-2" size="sm" />
                            {lang === 'th' ? 'ระดับคุณภาพอากาศ' : 'AQI Levels'}
                        </h3>
                        <div className="flex-1 flex flex-col justify-between">
                            {(Object.entries(AQI_LEVELS) as [AQILevelKey, AQILevelConfig][]).map(([key, level]) => (
                                <div
                                    key={key}
                                    className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-dark-700/50'}`}
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: level.color }}
                                    >
                                        <Icon name={level.icon} className="text-white" size="sm" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium text-sm ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                            {lang === 'th' ? level.labelTh : level.label}
                                        </p>
                                        <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                            AQI: {level.min} - {level.max}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </section>

                {/* Tab Navigation - Now only Charts and Data */}
                <section className="mb-6">
                    <div className={`flex gap-2 p-1 rounded-xl ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                        {([
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

                {/* Tab Content - Charts tab is now the default */}

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

                        {/* AI Insights Panel */}
                        <AIInsightsPanel
                            stationId={selectedStation}
                            stationName={currentStation?.name_en || currentStation?.name_th || null}
                            parameter={selectedParam}
                            timePeriod={timePeriod}
                            statistics={fullData?.statistics}
                            dataPoints={fullData?.total_records}
                            isLight={isLight}
                            lang={lang}
                        />

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
