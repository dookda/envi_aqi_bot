/**
 * Executive Summary Page
 * High-level overview of air quality status for executives and decision makers
 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Icon, Badge, Spinner } from '../components/atoms'
import { useStations } from '../hooks'
import { useLanguage, useTheme } from '../contexts'
import { aqiService } from '../services/api'
import type { Station, AQIHourlyData } from '../types'

// Extended station with latest data
interface StationWithLatest extends Station {
    latestData?: AQIHourlyData | null
    latestAqi?: number
    latestPm25?: number
}

// Summary statistics interface
interface SummaryStats {
    totalStations: number
    activeStations: number
    avgAqi: number
    maxAqi: number
    minAqi: number
    alertCount: number
}

// AQI status configuration
interface AQIStatus {
    level: string
    levelTh: string
    color: string
    bgColor: string
    icon: string
}

// Calculate AQI from PM2.5 using Thailand standard
const calculateAqiFromPm25 = (pm25: number | undefined): number => {
    if (!pm25 || pm25 <= 0) return 0
    if (pm25 <= 25) return Math.round((pm25 / 25) * 25)
    if (pm25 <= 37) return Math.round(25 + ((pm25 - 25) / 12) * 25)
    if (pm25 <= 50) return Math.round(50 + ((pm25 - 37) / 13) * 50)
    if (pm25 <= 90) return Math.round(100 + ((pm25 - 50) / 40) * 100)
    return Math.round(200 + ((pm25 - 90) / 90) * 100)
}

const getAqiStatus = (value: number, isLight: boolean): AQIStatus => {
    if (value <= 25) return {
        level: 'Excellent',
        levelTh: 'ดีมาก',
        color: 'text-green-600',
        bgColor: isLight ? 'bg-green-50 border-green-200' : 'bg-green-900/20 border-green-800',
        icon: 'sentiment_very_satisfied'
    }
    if (value <= 50) return {
        level: 'Good',
        levelTh: 'ดี',
        color: 'text-green-500',
        bgColor: isLight ? 'bg-green-50 border-green-200' : 'bg-green-900/20 border-green-800',
        icon: 'sentiment_satisfied'
    }
    if (value <= 100) return {
        level: 'Moderate',
        levelTh: 'ปานกลาง',
        color: 'text-yellow-600',
        bgColor: isLight ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-900/20 border-yellow-800',
        icon: 'sentiment_neutral'
    }
    if (value <= 200) return {
        level: 'Unhealthy',
        levelTh: 'มีผลต่อสุขภาพ',
        color: 'text-orange-600',
        bgColor: isLight ? 'bg-orange-50 border-orange-200' : 'bg-orange-900/20 border-orange-800',
        icon: 'sentiment_dissatisfied'
    }
    return {
        level: 'Very Unhealthy',
        levelTh: 'อันตราย',
        color: 'text-red-600',
        bgColor: isLight ? 'bg-red-50 border-red-200' : 'bg-red-900/20 border-red-800',
        icon: 'sentiment_very_dissatisfied'
    }
}

// Key Metric Card Component
interface MetricCardProps {
    icon: string
    label: string
    labelTh: string
    value: string | number
    subValue?: string
    trend?: 'up' | 'down' | 'stable'
    trendValue?: string
    color: string
}

const MetricCard: React.FC<MetricCardProps> = ({
    icon, label, labelTh, value, subValue, trend, trendValue, color
}) => {
    const { lang } = useLanguage()
    const { isLight } = useTheme()

    const trendColors = {
        up: 'text-red-500',
        down: 'text-green-500',
        stable: 'text-gray-500'
    }

    const trendIcons = {
        up: 'trending_up',
        down: 'trending_down',
        stable: 'trending_flat'
    }

    return (
        <Card className="p-6">
            <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon name={icon} size="lg" className="text-white" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 ${trendColors[trend]}`}>
                        <Icon name={trendIcons[trend]} size="sm" />
                        {trendValue && <span className="text-sm font-medium">{trendValue}</span>}
                    </div>
                )}
            </div>
            <div className="mt-4">
                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                    {lang === 'th' ? labelTh : label}
                </p>
                <p className={`text-3xl font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    {value}
                </p>
                {subValue && (
                    <p className={`text-sm mt-1 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                        {subValue}
                    </p>
                )}
            </div>
        </Card>
    )
}

// Status Distribution Bar
interface StatusBarProps {
    excellent: number
    good: number
    moderate: number
    unhealthy: number
    veryUnhealthy: number
    total: number
}

const StatusBar: React.FC<StatusBarProps> = ({
    excellent, good, moderate, unhealthy, veryUnhealthy, total
}) => {
    const { lang } = useLanguage()
    const { isLight } = useTheme()

    if (total === 0) return null

    const getWidth = (count: number) => `${(count / total) * 100}%`

    const segments = [
        { count: excellent, color: 'bg-green-500', label: lang === 'th' ? 'ดีมาก' : 'Excellent' },
        { count: good, color: 'bg-green-400', label: lang === 'th' ? 'ดี' : 'Good' },
        { count: moderate, color: 'bg-yellow-400', label: lang === 'th' ? 'ปานกลาง' : 'Moderate' },
        { count: unhealthy, color: 'bg-orange-500', label: lang === 'th' ? 'มีผลต่อสุขภาพ' : 'Unhealthy' },
        { count: veryUnhealthy, color: 'bg-red-500', label: lang === 'th' ? 'อันตราย' : 'Very Unhealthy' },
    ]

    return (
        <div>
            <div className="flex h-4 rounded-full overflow-hidden">
                {segments.map((seg, idx) => seg.count > 0 && (
                    <div
                        key={idx}
                        className={`${seg.color} transition-all`}
                        style={{ width: getWidth(seg.count) }}
                        title={`${seg.label}: ${seg.count}`}
                    />
                ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
                {segments.map((seg, idx) => seg.count > 0 && (
                    <div key={idx} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${seg.color}`} />
                        <span className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                            {seg.label}: {seg.count}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Main Executive Summary Page Component
const ExecutiveSummaryPage: React.FC = () => {
    const { lang } = useLanguage()
    const { isLight } = useTheme()
    const { stations, loading: stationsLoading } = useStations()
    const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null)
    const [stationsWithData, setStationsWithData] = useState<StationWithLatest[]>([])
    const [loading, setLoading] = useState(true)
    const [statusDistribution, setStatusDistribution] = useState({
        excellent: 0,
        good: 0,
        moderate: 0,
        unhealthy: 0,
        veryUnhealthy: 0
    })

    // Fetch latest data for all stations
    const fetchAllLatestData = useCallback(async () => {
        if (!stations || stations.length === 0) return

        setLoading(true)
        const stationsData: StationWithLatest[] = []

        // Fetch latest data for each station (limit to first 20 for performance)
        const stationsToFetch = stations.slice(0, 20)

        await Promise.all(
            stationsToFetch.map(async (station) => {
                try {
                    const latestData = await aqiService.getLatest(station.station_id)
                    const pm25 = latestData?.pm25
                    const aqi = calculateAqiFromPm25(pm25)
                    stationsData.push({
                        ...station,
                        latestData,
                        latestAqi: aqi,
                        latestPm25: pm25
                    })
                } catch {
                    // Station might not have data
                    stationsData.push({
                        ...station,
                        latestData: null,
                        latestAqi: undefined,
                        latestPm25: undefined
                    })
                }
            })
        )

        setStationsWithData(stationsData)
        setLoading(false)
    }, [stations])

    useEffect(() => {
        if (!stationsLoading && stations && stations.length > 0) {
            fetchAllLatestData()
        }
    }, [stationsLoading, stations, fetchAllLatestData])

    // Calculate summary statistics from fetched data
    useEffect(() => {
        if (stationsWithData.length > 0) {
            const activeStations = stationsWithData.filter(s => s.latestData !== null)
            const aqiValues = activeStations
                .map(s => s.latestAqi)
                .filter((v): v is number => v !== undefined && v > 0)

            const avgAqi = aqiValues.length > 0
                ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
                : 0
            const maxAqi = aqiValues.length > 0 ? Math.max(...aqiValues) : 0
            const minAqi = aqiValues.length > 0 ? Math.min(...aqiValues) : 0
            const alertCount = aqiValues.filter(v => v > 100).length

            setSummaryStats({
                totalStations: stations?.length || 0,
                activeStations: activeStations.length,
                avgAqi,
                maxAqi,
                minAqi,
                alertCount
            })

            // Calculate status distribution
            let excellent = 0, good = 0, moderate = 0, unhealthy = 0, veryUnhealthy = 0
            aqiValues.forEach((aqi) => {
                if (aqi <= 25) excellent++
                else if (aqi <= 50) good++
                else if (aqi <= 100) moderate++
                else if (aqi <= 200) unhealthy++
                else veryUnhealthy++
            })
            setStatusDistribution({ excellent, good, moderate, unhealthy, veryUnhealthy })
        }
    }, [stationsWithData, stations])

    const currentStatus = summaryStats ? getAqiStatus(summaryStats.avgAqi, isLight) : null
    const currentDate = new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    if (loading || stationsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Spinner size="lg" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {lang === 'th' ? 'สรุปภาพรวมผู้บริหาร' : 'Executive Summary'}
                    </h1>
                    <p className={`mt-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                        {currentDate}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="success" className="px-3 py-1.5">
                        <Icon name="sync" size="xs" className="mr-1" />
                        {lang === 'th' ? 'อัปเดตล่าสุด: ตอนนี้' : 'Last Updated: Now'}
                    </Badge>
                </div>
            </div>

            {/* Overall Status Card */}
            {currentStatus && summaryStats && (
                <Card className={`p-6 border-2 ${currentStatus.bgColor}`}>
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className={`p-4 rounded-2xl ${isLight ? 'bg-white' : 'bg-gray-800'} shadow-lg`}>
                            <Icon name={currentStatus.icon} size="xl" className={currentStatus.color} />
                        </div>
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                {lang === 'th' ? 'สถานะคุณภาพอากาศโดยรวม' : 'Overall Air Quality Status'}
                            </p>
                            <h2 className={`text-3xl font-bold mt-1 ${currentStatus.color}`}>
                                {lang === 'th' ? currentStatus.levelTh : currentStatus.level}
                            </h2>
                            <p className={`mt-2 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                {lang === 'th'
                                    ? `ค่าดัชนีคุณภาพอากาศเฉลี่ย ${summaryStats.avgAqi} จาก ${summaryStats.activeStations} สถานีที่ทำงานอยู่`
                                    : `Average AQI of ${summaryStats.avgAqi} across ${summaryStats.activeStations} active stations`}
                            </p>
                        </div>
                        <div className="text-center md:text-right">
                            <p className={`text-6xl font-bold ${currentStatus.color}`}>
                                {summaryStats.avgAqi}
                            </p>
                            <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                {lang === 'th' ? 'ค่า AQI เฉลี่ย' : 'Average AQI'}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon="location_on"
                    label="Total Stations"
                    labelTh="จำนวนสถานีทั้งหมด"
                    value={summaryStats?.totalStations || 0}
                    subValue={`${summaryStats?.activeStations || 0} ${lang === 'th' ? 'สถานีทำงาน' : 'active'}`}
                    color="bg-blue-500"
                />
                <MetricCard
                    icon="arrow_upward"
                    label="Highest AQI"
                    labelTh="ค่า AQI สูงสุด"
                    value={summaryStats?.maxAqi || '-'}
                    trend="up"
                    color="bg-red-500"
                />
                <MetricCard
                    icon="arrow_downward"
                    label="Lowest AQI"
                    labelTh="ค่า AQI ต่ำสุด"
                    value={summaryStats?.minAqi || '-'}
                    trend="down"
                    color="bg-green-500"
                />
                <MetricCard
                    icon="warning"
                    label="Alerts"
                    labelTh="การแจ้งเตือน"
                    value={summaryStats?.alertCount || 0}
                    subValue={lang === 'th' ? 'สถานีที่ AQI > 100' : 'Stations with AQI > 100'}
                    color="bg-orange-500"
                />
            </div>

            {/* Status Distribution */}
            <Card className="p-6">
                <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    {lang === 'th' ? 'การกระจายตัวของสถานะคุณภาพอากาศ' : 'Air Quality Status Distribution'}
                </h3>
                <StatusBar
                    {...statusDistribution}
                    total={Object.values(statusDistribution).reduce((a, b) => a + b, 0)}
                />
            </Card>

            {/* Station Summary Table */}
            <Card className="p-6">
                <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    {lang === 'th' ? 'สรุปข้อมูลสถานี' : 'Station Summary'}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className={`border-b ${isLight ? 'border-gray-200' : 'border-gray-700'}`}>
                                <th className={`text-left py-3 px-4 font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    {lang === 'th' ? 'สถานี' : 'Station'}
                                </th>
                                <th className={`text-center py-3 px-4 font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    AQI
                                </th>
                                <th className={`text-center py-3 px-4 font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    {lang === 'th' ? 'สถานะ' : 'Status'}
                                </th>
                                <th className={`text-center py-3 px-4 font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    PM2.5
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {stationsWithData.filter(s => s.latestData !== null).slice(0, 10).map((station) => {
                                const stationStatus = station.latestAqi
                                    ? getAqiStatus(station.latestAqi, isLight)
                                    : null
                                return (
                                    <tr
                                        key={station.station_id}
                                        className={`border-b ${isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-gray-800 hover:bg-gray-800/50'}`}
                                    >
                                        <td className={`py-3 px-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                            <div className="flex items-center gap-2">
                                                <Icon name="location_on" size="sm" className="text-primary-500" />
                                                {station.name_th || station.name_en}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`font-bold text-lg ${stationStatus?.color || 'text-gray-500'}`}>
                                                {station.latestAqi || '-'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {stationStatus && (
                                                <Badge
                                                    variant={station.latestAqi && station.latestAqi <= 50 ? 'success' :
                                                        station.latestAqi && station.latestAqi <= 100 ? 'warning' : 'danger'}
                                                >
                                                    {lang === 'th' ? stationStatus.levelTh : stationStatus.level}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className={`py-3 px-4 text-center ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {station.latestPm25 ? `${station.latestPm25.toFixed(1)} µg/m³` : '-'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {stationsWithData.filter(s => s.latestData !== null).length > 10 && (
                    <p className={`mt-4 text-sm text-center ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                        {lang === 'th'
                            ? `แสดง 10 จาก ${stationsWithData.filter(s => s.latestData !== null).length} สถานี`
                            : `Showing 10 of ${stationsWithData.filter(s => s.latestData !== null).length} stations`}
                    </p>
                )}
            </Card>

            {/* Recommendations Section */}
            <Card className="p-6">
                <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    {lang === 'th' ? 'ข้อเสนอแนะ' : 'Recommendations'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summaryStats && summaryStats.alertCount > 0 && (
                        <div className={`p-4 rounded-lg border ${isLight ? 'bg-red-50 border-red-200' : 'bg-red-900/20 border-red-800'}`}>
                            <div className="flex items-start gap-3">
                                <Icon name="warning" className="text-red-500 mt-0.5" />
                                <div>
                                    <p className={`font-medium ${isLight ? 'text-red-800' : 'text-red-300'}`}>
                                        {lang === 'th' ? 'พื้นที่ที่ต้องระวัง' : 'Areas of Concern'}
                                    </p>
                                    <p className={`text-sm mt-1 ${isLight ? 'text-red-600' : 'text-red-400'}`}>
                                        {lang === 'th'
                                            ? `มี ${summaryStats.alertCount} สถานีที่มีค่า AQI เกิน 100`
                                            : `${summaryStats.alertCount} stations have AQI exceeding 100`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className={`p-4 rounded-lg border ${isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-800'}`}>
                        <div className="flex items-start gap-3">
                            <Icon name="info" className="text-blue-500 mt-0.5" />
                            <div>
                                <p className={`font-medium ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>
                                    {lang === 'th' ? 'การติดตามต่อเนื่อง' : 'Continuous Monitoring'}
                                </p>
                                <p className={`text-sm mt-1 ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                                    {lang === 'th'
                                        ? 'ข้อมูลอัปเดตทุกชั่วโมงจากสถานีตรวจวัด'
                                        : 'Data updated hourly from monitoring stations'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    )
}

export default ExecutiveSummaryPage
