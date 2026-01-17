/**
 * Dashboard Page - Premium Redesign
 * Modern air quality monitoring dashboard with full environmental data
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as echarts from 'echarts'
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

    // Calculate summary statistics for the current parameter
    const summaryStats = useMemo(() => {
        if (!data || data.length === 0) {
            return { max: null, min: null, avg: null, collected: 0, total: 0, completeness: 0 }
        }

        const values = data
            .map(row => row[selectedParam as keyof AQIHourlyData] as number | null | undefined)
            .filter((v): v is number => v !== null && v !== undefined)

        const total = data.length
        const collected = values.length
        const completeness = total > 0 ? (collected / total) * 100 : 0

        if (values.length === 0) {
            return { max: null, min: null, avg: null, collected: 0, total, completeness: 0 }
        }

        const max = Math.max(...values)
        const min = Math.min(...values)
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length

        return { max, min, avg, collected, total, completeness }
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
                                {stats.negative > 0 && (
                                    <Badge variant="danger" className="flex items-center gap-1">
                                        <Icon name="remove_circle" size="xs" />
                                        {stats.negative} {lang === 'th' ? 'ค่าติดลบ' : 'Negative'}
                                    </Badge>
                                )}
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
                            {/* Date-Time Range Filter */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Icon
                                    name="calendar_today"
                                    size="sm"
                                    className={isLight ? 'text-gray-400' : 'text-dark-500'}
                                />
                                <input
                                    type="datetime-local"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className={`px-2 py-1.5 rounded-lg border text-sm transition-all ${isLight
                                        ? 'bg-white border-gray-200 text-gray-800 focus:border-primary-400'
                                        : 'bg-dark-700 border-dark-600 text-white focus:border-primary-500'
                                        } focus:outline-none focus:ring-1 focus:ring-primary-500/30`}
                                    title={lang === 'th' ? 'วันเวลาเริ่มต้น' : 'Start date-time'}
                                />
                                <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                    {lang === 'th' ? 'ถึง' : 'to'}
                                </span>
                                <input
                                    type="datetime-local"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={`px-2 py-1.5 rounded-lg border text-sm transition-all ${isLight
                                        ? 'bg-white border-gray-200 text-gray-800 focus:border-primary-400'
                                        : 'bg-dark-700 border-dark-600 text-white focus:border-primary-500'
                                        } focus:outline-none focus:ring-1 focus:ring-primary-500/30`}
                                    title={lang === 'th' ? 'วันเวลาสิ้นสุด' : 'End date-time'}
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

                {/* Summary Statistics - moved below table */}
                <div className={`grid grid-cols-2 md:grid-cols-6 gap-3 p-4 border-t ${isLight ? 'border-gray-100 bg-gray-50/50' : 'border-dark-700 bg-dark-800/50'}`}>
                    {/* Maximum */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
                            <Icon name="arrow_upward" style={{ color: '#ef4444' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ค่าสูงสุด' : 'Maximum'}
                            </p>
                            <p className={`text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                {summaryStats.max !== null ? summaryStats.max.toFixed(2) : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Minimum */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
                            <Icon name="arrow_downward" style={{ color: '#3b82f6' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ค่าน้อยสุด' : 'Minimum'}
                            </p>
                            <p className={`text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                {summaryStats.min !== null ? summaryStats.min.toFixed(2) : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Average */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100">
                            <Icon name="functions" style={{ color: '#8b5cf6' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ค่าเฉลี่ย' : 'Average'}
                            </p>
                            <p className={`text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                {summaryStats.avg !== null ? summaryStats.avg.toFixed(2) : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Collected Count */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-100">
                            <Icon name="check_circle" style={{ color: '#10b981' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'จำนวนที่เก็บค่าได้' : 'Collected'}
                            </p>
                            <p className={`text-lg font-bold text-emerald-500`}>
                                {summaryStats.collected}
                            </p>
                        </div>
                    </div>

                    {/* Total Hours */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100">
                            <Icon name="schedule" style={{ color: '#f59e0b' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'จำนวนชั่วโมงทั้งหมด' : 'Total Hours'}
                            </p>
                            <p className={`text-lg font-bold text-amber-500`}>
                                {summaryStats.total}
                            </p>
                        </div>
                    </div>

                    {/* Completeness */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyan-100">
                            <Icon name="pie_chart" style={{ color: '#06b6d4' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'เปอร์เซ็นต์การเก็บค่าได้' : 'Completeness'}
                            </p>
                            <p className={`text-lg font-bold text-cyan-500`}>
                                {summaryStats.completeness.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            </Card>
        </section>
    )
}

// ============== Calendar Heatmap Component ==============

interface CalendarHeatmapProps {
    data: Array<{ date: string; displayDate: string; count: number; percentage: number }>
    overall: number
    loading: boolean
    isLight: boolean
    lang: Language
}

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
    data,
    overall,
    loading,
    isLight,
    lang
}) => {
    const chartRef = useRef<HTMLDivElement>(null)
    const chartInstance = useRef<echarts.ECharts | null>(null)

    useEffect(() => {
        if (!chartRef.current || data.length === 0) return

        // Initialize or get existing chart instance
        if (!chartInstance.current) {
            chartInstance.current = echarts.init(chartRef.current)
        }

        const textColor = isLight ? '#374151' : '#f1f5f9'
        const subTextColor = isLight ? '#6b7280' : '#94a3b8'

        // Get date range for calendar
        const dates = data.map(d => d.date).sort()
        const startDate = dates[0]
        const endDate = dates[dates.length - 1]

        // Determine the year range
        const startYear = new Date(startDate).getFullYear()
        const endYear = new Date(endDate).getFullYear()
        const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)

        // Format data for ECharts calendar heatmap: [date, value]
        const heatmapData = data.map(d => [d.date, d.percentage])

        // Calculate chart height for calendars
        const calendarHeight = 140  // Height per year calendar
        const calendarSpacing = 30  // Space between calendars
        const topPadding = 20       // Top padding for chart
        const totalHeight = topPadding + years.length * (calendarHeight + calendarSpacing)

        // Create calendar and series for each year - with partial year ranges
        const calendars: echarts.EChartsOption['calendar'] = years.map((year, idx) => {
            // Determine the date range for this particular year
            let yearStart: string
            let yearEnd: string

            if (year === startYear && year === endYear) {
                // Same year - use exact data range
                yearStart = startDate
                yearEnd = endDate
            } else if (year === startYear) {
                // First year in multi-year range
                yearStart = startDate
                yearEnd = `${year}-12-31`
            } else if (year === endYear) {
                // Last year in multi-year range
                yearStart = `${year}-01-01`
                yearEnd = endDate
            } else {
                // Middle year - show full year
                yearStart = `${year}-01-01`
                yearEnd = `${year}-12-31`
            }

            return {
                top: topPadding + idx * (calendarHeight + calendarSpacing),
                left: 80,
                right: 30,
                cellSize: ['auto', 15],
                range: [yearStart, yearEnd],
                itemStyle: {
                    borderWidth: 2,
                    borderColor: isLight ? '#fff' : '#1e293b',
                },
                yearLabel: {
                    show: true,
                    position: 'left',
                    color: textColor,
                    fontSize: 14,
                    fontWeight: 'bold',
                    formatter: () => year.toString(),
                },
                monthLabel: {
                    show: true,
                    color: subTextColor,
                    fontSize: 11,
                    nameMap: lang === 'th'
                        ? ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
                        : undefined,  // Use default English names
                },
                dayLabel: {
                    show: true,
                    firstDay: 0,
                    color: subTextColor,
                    fontSize: 9,
                    nameMap: lang === 'th'
                        ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
                        : ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: isLight ? '#e5e7eb' : '#334155',
                        width: 1,
                    },
                },
            }
        })

        const series: echarts.SeriesOption[] = years.map((year, idx) => ({
            type: 'heatmap',
            coordinateSystem: 'calendar',
            calendarIndex: idx,
            data: heatmapData.filter(d => (d[0] as string).startsWith(year.toString())),
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.3)',
                },
            },
        }))

        const option: echarts.EChartsOption = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                backgroundColor: isLight ? '#fff' : '#1e293b',
                borderColor: isLight ? '#e5e7eb' : '#334155',
                textStyle: { color: textColor },
                formatter: (params: any) => {
                    const date = params.data[0]
                    const value = params.data[1]
                    const dayData = data.find(d => d.date === date)
                    const formattedDate = new Date(date).toLocaleDateString(
                        lang === 'th' ? 'th-TH' : 'en-US',
                        { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
                    )
                    return `
                        <div style="padding: 4px;">
                            <strong>${formattedDate}</strong><br/>
                            ${lang === 'th' ? 'ข้อมูล' : 'Data'}: ${dayData?.count || 0}/24 ${lang === 'th' ? 'ชม.' : 'hrs'}<br/>
                            <span style="color: ${value >= 90 ? '#10b981' : value >= 70 ? '#f59e0b' : value >= 50 ? '#f97316' : '#ef4444'}; font-weight: bold;">
                                ${value.toFixed(1)}%
                            </span>
                        </div>
                    `
                },
            },
            // Hidden visualMap - just for color mapping
            visualMap: {
                show: false,
                min: 0,
                max: 100,
                inRange: {
                    color: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981'],
                },
            },
            calendar: calendars,
            series: series,
        }

        chartInstance.current.setOption(option, true)
        chartInstance.current.resize()

        const handleResize = () => chartInstance.current?.resize()
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [data, isLight, lang])

    // Cleanup
    useEffect(() => {
        return () => {
            chartInstance.current?.dispose()
            chartInstance.current = null
        }
    }, [])

    // Calculate chart height based on years (matching constants from useEffect)
    const calendarHeight = 140
    const calendarSpacing = 30
    const topPadding = 20
    const years = data.length > 0
        ? Array.from(new Set(data.map(d => new Date(d.date).getFullYear()))).length
        : 1
    const chartHeight = Math.max(200, topPadding + years * (calendarHeight + calendarSpacing) + 20)

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className={`p-3 border-b ${isLight ? 'border-gray-100' : 'border-dark-700'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
                            <Icon name="calendar_month" className="text-white" size="sm" />
                        </div>
                        <div>
                            <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                {lang === 'th' ? 'ความสมบูรณ์ข้อมูลรายวัน' : 'Daily Data Completeness'}
                            </h3>
                        </div>
                    </div>
                    <Badge
                        variant={overall >= 90 ? 'success' : overall >= 70 ? 'warning' : 'danger'}
                        size="sm"
                    >
                        {overall.toFixed(1)}%
                    </Badge>
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 p-2 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Spinner size="lg" />
                    </div>
                ) : data.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center h-full ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                        <Icon name="event_busy" size="xl" className="mb-2" />
                        <p>{lang === 'th' ? 'ไม่มีข้อมูล' : 'No data available'}</p>
                    </div>
                ) : (
                    <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
                )}
            </div>

            {/* Legend - Compact */}
            {!loading && data.length > 0 && (
                <div className={`px-3 pb-2 flex flex-wrap items-center justify-center gap-2 text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded" style={{ backgroundColor: '#10b981' }} />
                        <span>≥90%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded" style={{ backgroundColor: '#84cc16' }} />
                        <span>≥80%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded" style={{ backgroundColor: '#f59e0b' }} />
                        <span>≥70%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded" style={{ backgroundColor: '#f97316' }} />
                        <span>≥50%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded" style={{ backgroundColor: '#ef4444' }} />
                        <span>&lt;50%</span>
                    </div>
                </div>
            )}
        </div>
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
    const [latestStationData, setLatestStationData] = useState<AQIHourlyData | null>(null)

    // Pollutant threshold configuration with localStorage persistence
    const [showThresholdSettings, setShowThresholdSettings] = useState<boolean>(false)
    const [pollutantThresholds, setPollutantThresholds] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('pollutantThresholds')
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {
                return {}
            }
        }
        return {
            co: -0.3,      // ppm
            so2: -3,       // ppb
            o3: -3,        // ppb
            nox: -3,       // ppb
            no2: -3,       // ppb
            no: -3,        // ppb
            pm10: -3,      // µg/m³
        }
    })

    // Save thresholds to localStorage when changed
    useEffect(() => {
        localStorage.setItem('pollutantThresholds', JSON.stringify(pollutantThresholds))
    }, [pollutantThresholds])

    // Spike detection multiplier (value X times higher than previous = spike)
    const [spikeMultiplier, setSpikeMultiplier] = useState<number>(() => {
        const saved = localStorage.getItem('spikeMultiplier')
        return saved ? parseFloat(saved) : 5
    })

    // Save spike multiplier to localStorage when changed
    useEffect(() => {
        localStorage.setItem('spikeMultiplier', spikeMultiplier.toString())
    }, [spikeMultiplier])

    // Calculate spike detection (compare latest with previous data point)
    const previousData = useMemo(() => {
        if (!fullData?.data?.length || fullData.data.length < 2) return null
        const sorted = [...fullData.data].sort((a, b) =>
            new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
        )
        return sorted[1] // Second most recent
    }, [fullData?.data])

    // Fetch the latest data point for the station (always most recent)
    const fetchLatestData = useCallback(async (): Promise<void> => {
        if (!selectedStation) return
        try {
            const response = await fetch(`${API_BASE}/aqi/${selectedStation}/latest`)
            if (response.ok) {
                const data: AQIHourlyData = await response.json()
                setLatestStationData(data)
            }
        } catch (err) {
            console.error('Failed to fetch latest data:', err)
        }
    }, [selectedStation])

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
            fetchLatestData()  // Always fetch latest data point
        }
    }, [selectedStation, timePeriod, fetchChartData, fetchFullData, fetchLatestData])

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

    // Get the latest data point (prefer dedicated /latest endpoint, fallback to fullData)
    const latestData = useMemo(() => {
        // Prefer the dedicated latest data from /latest endpoint
        if (latestStationData) return latestStationData

        // Fallback to most recent from fullData
        if (!fullData?.data?.length) return {} as AQIHourlyData
        // Sort by datetime descending and get the first (latest) entry
        const sorted = [...fullData.data].sort((a, b) =>
            new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
        )
        return sorted[0]
    }, [latestStationData, fullData?.data])

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

    // Calculate daily data completeness for weather panel
    const dailyCompleteness = useMemo(() => {
        if (!fullData?.data?.length) return { days: [], overall: 0 }

        // Group data by date
        const dayMap = new Map<string, { count: number; date: Date }>()
        fullData.data.forEach(row => {
            const date = new Date(row.datetime)
            const dateKey = date.toISOString().split('T')[0]
            const existing = dayMap.get(dateKey)
            if (existing) {
                existing.count++
            } else {
                dayMap.set(dateKey, { count: 1, date })
            }
        })

        // Convert to array and calculate percentages (24 hours = 100%)
        const days = Array.from(dayMap.entries())
            .map(([dateKey, { count, date }]) => ({
                date: dateKey,
                displayDate: date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric' }),
                count,
                percentage: Math.min(100, (count / 24) * 100)
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

        // Calculate overall completeness
        const totalExpected = days.length * 24
        const totalActual = days.reduce((sum, d) => sum + d.count, 0)
        const overall = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0

        return { days, overall }
    }, [fullData?.data, lang])

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

                        {/* Environmental & Weather Summary Card */}
                        <Card className="lg:col-span-2 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`text-lg font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                    <Icon name="eco" className="mr-2" />
                                    {lang === 'th' ? 'สภาพอากาศและมลพิษ' : 'Weather & Air Quality'}
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
                                <div className="space-y-4">
                                    {/* Air Pollutants Section */}
                                    <div>
                                        <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                                            <Icon name="science" size="sm" />
                                            {lang === 'th' ? 'มลพิษทางอากาศ' : 'Air Pollutants'}
                                        </h3>
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                            {Object.entries(POLLUTANT_CONFIG).map(([key, config]) => {
                                                const value = latestData[key as keyof AQIHourlyData] as number | undefined
                                                const prevValue = previousData?.[key as keyof AQIHourlyData] as number | undefined

                                                // Use fallback: if current value is missing, use previous value
                                                const hasCurrentValue = value !== undefined && value !== null
                                                const displayValue = hasCurrentValue ? value : prevValue
                                                const usingFallback = !hasCurrentValue && prevValue !== undefined && prevValue !== null

                                                // Check for invalid negative values based on configurable thresholds
                                                const negativeThreshold = pollutantThresholds[key] ?? (key === 'co' ? -0.3 : -3)
                                                const isInvalidNegative = displayValue !== undefined && displayValue !== null && displayValue < negativeThreshold
                                                const isNegative = displayValue !== undefined && displayValue !== null && displayValue < 0

                                                // Check for spike (value X times higher than previous)
                                                const isSpike = hasCurrentValue && value !== null &&
                                                    prevValue !== undefined && prevValue !== null && prevValue > 0 &&
                                                    value >= prevValue * spikeMultiplier

                                                return (
                                                    <div
                                                        key={key}
                                                        className={`p-3 rounded-xl text-center relative ${isSpike
                                                            ? isLight ? 'bg-purple-50 border-2 border-purple-400' : 'bg-purple-900/30 border-2 border-purple-500'
                                                            : isInvalidNegative
                                                                ? isLight ? 'bg-red-50 border-2 border-red-300' : 'bg-red-900/30 border-2 border-red-500'
                                                                : isNegative
                                                                    ? isLight ? 'bg-amber-50 border border-amber-300' : 'bg-amber-900/20 border border-amber-500'
                                                                    : usingFallback
                                                                        ? isLight ? 'bg-cyan-50 border border-cyan-300' : 'bg-cyan-900/20 border border-cyan-500'
                                                                        : isLight ? 'bg-gray-50' : 'bg-dark-700/50'
                                                            }`}
                                                    >
                                                        {/* Spike flag */}
                                                        {isSpike && (
                                                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center" title={lang === 'th' ? `ค่าพุ่งสูง (${spikeMultiplier}x)` : `Spike detected (${spikeMultiplier}x)`}>
                                                                <Icon name="trending_up" size="xs" className="text-white" />
                                                            </div>
                                                        )}
                                                        {/* Fallback indicator */}
                                                        {!isSpike && usingFallback && (
                                                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center" title={lang === 'th' ? 'ใช้ค่าก่อนหน้า' : 'Using previous value'}>
                                                                <Icon name="history" size="xs" className="text-white" />
                                                            </div>
                                                        )}
                                                        {/* Invalid negative flag */}
                                                        {!isSpike && !usingFallback && isInvalidNegative && (
                                                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center" title={lang === 'th' ? 'ค่าไม่ถูกต้อง' : 'Invalid value'}>
                                                                <Icon name="error" size="xs" className="text-white" />
                                                            </div>
                                                        )}
                                                        {/* Warning for slight negative (but within tolerance) */}
                                                        {!isSpike && !usingFallback && !isInvalidNegative && isNegative && (
                                                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center" title={lang === 'th' ? 'ค่าติดลบ' : 'Negative value'}>
                                                                <Icon name="warning" size="xs" className="text-white" />
                                                            </div>
                                                        )}
                                                        <Icon
                                                            name={config.icon}
                                                            size="md"
                                                            style={{ color: isSpike ? '#a855f7' : isInvalidNegative ? '#ef4444' : usingFallback ? '#06b6d4' : config.color }}
                                                        />
                                                        <p className={`text-xl font-bold mt-1 ${isSpike
                                                            ? 'text-purple-500'
                                                            : isInvalidNegative
                                                                ? 'text-red-500'
                                                                : isNegative
                                                                    ? 'text-amber-500'
                                                                    : usingFallback
                                                                        ? 'text-cyan-600'
                                                                        : isLight ? 'text-gray-800' : 'text-white'
                                                            }`}>
                                                            {displayValue?.toFixed(1) || '—'}
                                                        </p>
                                                        <p className={`text-xs font-medium ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                                                            {config.label}
                                                        </p>
                                                        <p className={`text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                                            {config.unit}
                                                        </p>
                                                        {/* Fallback label */}
                                                        {usingFallback && (
                                                            <p className="text-xs text-cyan-500 font-medium mt-1">
                                                                {lang === 'th' ? 'ใช้ค่าก่อนหน้า' : 'Previous'}
                                                            </p>
                                                        )}
                                                        {/* Previous value (only show if we have current and different prev) */}
                                                        {hasCurrentValue && prevValue !== undefined && prevValue !== null && (
                                                            <p className={`text-xs mt-1 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                                                {lang === 'th' ? 'ก่อนหน้า' : 'Prev'}: {prevValue.toFixed(1)}
                                                            </p>
                                                        )}
                                                        {/* Spike label */}
                                                        {isSpike && (
                                                            <p className="text-xs text-purple-500 font-medium mt-1">
                                                                {lang === 'th' ? 'ค่าพุ่งสูง' : 'Spike'}
                                                            </p>
                                                        )}
                                                        {/* Invalid label */}
                                                        {!isSpike && !usingFallback && isInvalidNegative && (
                                                            <p className="text-xs text-red-500 font-medium mt-1">
                                                                {lang === 'th' ? 'ค่าไม่ถูกต้อง' : 'Invalid'}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Weather Conditions Section */}
                                    <div>
                                        <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                                            <Icon name="cloud" size="sm" />
                                            {lang === 'th' ? 'สภาพอากาศ' : 'Weather Conditions'}
                                        </h3>
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                            {Object.entries(WEATHER_CONFIG).map(([key, config]) => {
                                                const value = latestData[key as keyof AQIHourlyData] as number | undefined
                                                const prevValue = previousData?.[key as keyof AQIHourlyData] as number | undefined

                                                // Use fallback: if current value is missing, use previous value
                                                const hasCurrentValue = value !== undefined && value !== null
                                                const effectiveValue = hasCurrentValue ? value : prevValue
                                                const usingFallback = !hasCurrentValue && prevValue !== undefined && prevValue !== null

                                                const displayValue = key === 'wd' ? getWindArrow(effectiveValue) : effectiveValue?.toFixed(1) || '—'

                                                return (
                                                    <div
                                                        key={key}
                                                        className={`p-3 rounded-xl text-center relative ${usingFallback
                                                            ? isLight ? 'bg-cyan-50 border border-cyan-300' : 'bg-cyan-900/20 border border-cyan-500'
                                                            : isLight ? 'bg-gray-50' : 'bg-dark-700/50'
                                                            }`}
                                                    >
                                                        {/* Fallback indicator */}
                                                        {usingFallback && (
                                                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center" title={lang === 'th' ? 'ใช้ค่าก่อนหน้า' : 'Using previous value'}>
                                                                <Icon name="history" size="xs" className="text-white" />
                                                            </div>
                                                        )}
                                                        <Icon
                                                            name={config.icon}
                                                            size="md"
                                                            style={{ color: usingFallback ? '#06b6d4' : config.color }}
                                                        />
                                                        <p className={`text-xl font-bold mt-1 ${usingFallback ? 'text-cyan-600' : isLight ? 'text-gray-800' : 'text-white'}`}>
                                                            {displayValue}
                                                        </p>
                                                        <p className={`text-xs font-medium ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                                                            {config.label}
                                                        </p>
                                                        <p className={`text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                                            {key === 'wd' ? `${effectiveValue?.toFixed(0) || '—'}°` : config.unit}
                                                        </p>
                                                        {/* Fallback label */}
                                                        {usingFallback && (
                                                            <p className="text-xs text-cyan-500 font-medium mt-1">
                                                                {lang === 'th' ? 'ใช้ค่าก่อนหน้า' : 'Previous'}
                                                            </p>
                                                        )}
                                                        {/* Previous value (only show if we have current) */}
                                                        {hasCurrentValue && prevValue !== undefined && prevValue !== null && (
                                                            <p className={`text-xs mt-1 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                                                {lang === 'th' ? 'ก่อนหน้า' : 'Prev'}: {key === 'wd' ? `${prevValue.toFixed(0)}°` : prevValue.toFixed(1)}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                </section>

                {/* Overview Section - Map, AQI Levels, and Calendar Heatmap in one row */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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

                    {/* Daily Data Completeness Calendar Heatmap */}
                    <Card className="h-[400px] overflow-auto">
                        <CalendarHeatmap
                            data={dailyCompleteness.days}
                            overall={dailyCompleteness.overall}
                            loading={fullDataLoading}
                            isLight={isLight}
                            lang={lang}
                        />
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
                            onSettingsClick={() => setShowThresholdSettings(true)}
                            spikeMultiplier={spikeMultiplier}
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
                        latestUpdate={latestData?.datetime}
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
                            {latestData?.datetime && (
                                <div className="flex items-center gap-2">
                                    <Icon name="update" size="sm" />
                                    <span>{lang === 'th' ? 'ล่าสุด:' : 'Latest:'} {new Date(latestData.datetime).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </Card>
                </section>
            </main>

            {/* Threshold Settings Modal */}
            {showThresholdSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowThresholdSettings(false)}>
                    <div
                        className={`w-full max-w-md rounded-2xl shadow-xl ${isLight ? 'bg-white' : 'bg-dark-800'} p-6`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-lg font-semibold flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                <Icon name="settings" />
                                {lang === 'th' ? 'ตั้งค่าคุณภาพข้อมูล' : 'Data Quality Settings'}
                            </h3>
                            <button
                                onClick={() => setShowThresholdSettings(false)}
                                className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-dark-700 text-dark-400'}`}
                            >
                                <Icon name="close" />
                            </button>
                        </div>

                        <p className={`text-sm mb-4 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            {lang === 'th'
                                ? 'กำหนดเกณฑ์สำหรับตรวจจับข้อมูลที่ผิดปกติ'
                                : 'Configure thresholds for detecting abnormal data'
                            }
                        </p>

                        {/* Negative Value Thresholds Section */}
                        <h4 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isLight ? 'text-red-600' : 'text-red-400'}`}>
                            <Icon name="error" size="sm" />
                            {lang === 'th' ? 'เกณฑ์ค่าติดลบ' : 'Negative Value Thresholds'}
                        </h4>
                        <div className="space-y-3">
                            {Object.entries(POLLUTANT_CONFIG).map(([key, config]) => (
                                <div key={key} className={`flex items-center gap-3 p-3 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-dark-700/50'}`}>
                                    <Icon name={config.icon} style={{ color: config.color }} />
                                    <div className="flex-1">
                                        <p className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                            {config.label}
                                        </p>
                                        <p className={`text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                            {config.unit}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>&lt;</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={pollutantThresholds[key] ?? (key === 'co' ? -0.3 : -3)}
                                            onChange={(e) => setPollutantThresholds(prev => ({
                                                ...prev,
                                                [key]: parseFloat(e.target.value) || 0
                                            }))}
                                            className={`w-20 px-2 py-1 text-sm rounded-lg border text-center ${isLight
                                                ? 'bg-white border-gray-200 text-gray-800 focus:border-primary-500'
                                                : 'bg-dark-600 border-dark-500 text-white focus:border-primary-500'
                                                } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Spike Detection Section */}
                        <div className={`mt-4 p-4 rounded-lg ${isLight ? 'bg-purple-50' : 'bg-purple-900/20'}`}>
                            <h4 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>
                                <Icon name="trending_up" size="sm" />
                                {lang === 'th' ? 'ตรวจจับค่าพุ่งสูง (Spike)' : 'Spike Detection'}
                            </h4>
                            <p className={`text-xs mb-3 ${isLight ? 'text-purple-600' : 'text-purple-400'}`}>
                                {lang === 'th'
                                    ? 'ค่าที่สูงกว่าค่าก่อนหน้า X เท่า จะถูกแสดงเป็นสีม่วง'
                                    : 'Values X times higher than previous will be shown in purple'
                                }
                            </p>
                            <div className="flex items-center gap-3">
                                <span className={`text-sm ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>
                                    {lang === 'th' ? 'ค่าปัจจุบัน ≥ ค่าก่อนหน้า ×' : 'Current ≥ Previous ×'}
                                </span>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="1.5"
                                    value={spikeMultiplier}
                                    onChange={(e) => setSpikeMultiplier(parseFloat(e.target.value) || 5)}
                                    className={`w-20 px-2 py-1 text-sm rounded-lg border text-center ${isLight
                                        ? 'bg-white border-purple-200 text-purple-800 focus:border-purple-500'
                                        : 'bg-dark-600 border-purple-500 text-white focus:border-purple-400'
                                        } focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setPollutantThresholds({
                                        co: -0.3,
                                        so2: -3,
                                        o3: -3,
                                        nox: -3,
                                        no2: -3,
                                        no: -3,
                                        pm10: -3,
                                    })
                                    setSpikeMultiplier(5)
                                }}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${isLight
                                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                                    }`}
                            >
                                {lang === 'th' ? 'รีเซ็ตค่าเริ่มต้น' : 'Reset to Default'}
                            </button>
                            <button
                                onClick={() => setShowThresholdSettings(false)}
                                className="flex-1 px-4 py-2 rounded-lg font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                            >
                                {lang === 'th' ? 'บันทึก' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
