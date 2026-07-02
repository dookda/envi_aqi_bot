/**
 * Executive Summary Page
 * High-level overview of air quality status for executives and decision makers
 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Icon, Badge, Spinner } from '../components/atoms'
import { AQIStatusChart } from '../components/organisms'
import { useStations } from '../hooks'
import { useLanguage, useTheme } from '../contexts'
import { aqiService, aiService } from '../services/api'
import type { Station, AQIHourlyData } from '../types'
import { pm25ToAqi } from '../utils/aqi'

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

const getAqiStatus = (value: number, isLight: boolean): AQIStatus => {
    // Thailand AQI Standard (ดัชนี AQI ประเทศไทย)
    if (value <= 25) return {
        level: 'Excellent',
        levelTh: 'ดีมาก',
        color: 'text-cyan-500',  // Cyan - Thailand PCD
        bgColor: isLight ? 'bg-cyan-50 border-cyan-200' : 'bg-cyan-900/20 border-cyan-800',
        icon: 'sentiment_very_satisfied'
    }
    if (value <= 50) return {
        level: 'Good',
        levelTh: 'ดี',
        color: 'text-green-500',  // Green - Thailand PCD
        bgColor: isLight ? 'bg-green-50 border-green-200' : 'bg-green-900/20 border-green-800',
        icon: 'sentiment_satisfied'
    }
    if (value <= 100) return {
        level: 'Moderate',
        levelTh: 'ปานกลาง',
        color: 'text-yellow-500',  // Yellow - Thailand PCD
        bgColor: isLight ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-900/20 border-yellow-800',
        icon: 'sentiment_neutral'
    }
    if (value <= 200) return {
        level: 'Unhealthy',
        levelTh: 'เริ่มมีผลกระทบ',
        color: 'text-orange-500',  // Orange - Thailand PCD
        bgColor: isLight ? 'bg-orange-50 border-orange-200' : 'bg-orange-900/20 border-orange-800',
        icon: 'sentiment_dissatisfied'
    }
    return {
        level: 'Hazardous',
        levelTh: 'มีผลกระทบ',
        color: 'text-red-500',  // Red - Thailand PCD
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

// AI Executive Summary Types
interface ExecutiveSummaryInsight {
    status: string
    insight: string | null
    highlights: string[] | null
    executive_brief: string | null
    action_items: string[] | null
    policy_recommendations: string[] | null
    error: string | null
}

interface AIExecutiveSummaryPanelProps {
    summaryStats: SummaryStats | null
    statusDistribution: {
        excellent: number
        good: number
        moderate: number
        unhealthy: number
        veryUnhealthy: number
    }
    isLight: boolean
    lang: string
}

// AI Executive Summary Panel Component
const AIExecutiveSummaryPanel: React.FC<AIExecutiveSummaryPanelProps> = ({
    summaryStats,
    statusDistribution,
    isLight,
    lang
}) => {
    const [insight, setInsight] = useState<ExecutiveSummaryInsight | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [isExpanded, setIsExpanded] = useState<boolean>(true)

    const generateInsight = useCallback(async () => {
        if (!summaryStats) return

        setLoading(true)

        try {
            // Call AI Service (Ollama)
            console.log('Generating AI summary with lang:', lang)
            const response = await aiService.generateExecutiveSummary({
                ...summaryStats,
                statusDistribution,
                lang
            })
            console.log('AI response:', response)

            if (response.status === 'success' && response.insight) {
                setInsight({
                    status: 'success',
                    insight: response.insight,
                    highlights: response.highlights || [],
                    executive_brief: response.executive_brief || '',
                    action_items: response.action_items || [],
                    policy_recommendations: response.policy_recommendations || [],
                    error: null
                })
            } else {
                // Handle API error response
                setInsight({
                    status: 'error',
                    insight: null,
                    highlights: null,
                    executive_brief: null,
                    action_items: null,
                    policy_recommendations: null,
                    error: response.error || (lang === 'th' ? 'ไม่สามารถสร้างรายงานสรุปได้' : 'Failed to generate summary')
                })
            }
        } catch (err) {
            console.error('AI Generation failed:', err)
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            setInsight({
                status: 'error',
                insight: null,
                highlights: null,
                executive_brief: null,
                action_items: null,
                policy_recommendations: null,
                error: lang === 'th'
                    ? `ไม่สามารถเชื่อมต่อกับบริการ AI ได้: ${errorMessage}`
                    : `AI Service Error: ${errorMessage}`
            })
        } finally {
            setLoading(false)
        }

    }, [summaryStats, statusDistribution, lang])

    // Generate insight when data or language changes
    useEffect(() => {
        if (summaryStats && summaryStats.activeStations > 0) {
            generateInsight()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [summaryStats, statusDistribution, lang])

    if (!summaryStats) return null

    return (
        <Card className="p-0 overflow-hidden">
            {/* Header */}
            <div
                className={`px-5 py-4 flex items-center justify-between cursor-pointer border-b ${isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-dark-700 hover:bg-dark-700/50'}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Icon name="auto_awesome" className="text-white" size="lg" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                            {lang === 'th' ? '🤖 AI สรุปสำหรับผู้บริหาร' : '🤖 AI Executive Brief'}
                        </h3>
                        {insight?.executive_brief && (
                            <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {insight.executive_brief}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            generateInsight()
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
                <div className="p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Spinner size="md" />
                            <span className={`ml-3 text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'กำลังวิเคราะห์ข้อมูล...' : 'Analyzing data...'}
                            </span>
                        </div>
                    ) : insight?.status === 'error' ? (
                        <div className={`text-center py-8 rounded-lg ${isLight ? 'bg-red-50' : 'bg-red-900/20'}`}>
                            <Icon name="error_outline" size="xl" className="mb-3 text-red-500" />
                            <p className={`text-sm font-medium ${isLight ? 'text-red-700' : 'text-red-300'}`}>
                                {insight.error || (lang === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred')}
                            </p>
                            <p className={`text-xs mt-2 ${isLight ? 'text-red-500' : 'text-red-400'}`}>
                                {lang === 'th' ? 'กรุณาตรวจสอบว่าบริการ AI (Ollama) กำลังทำงานอยู่' : 'Please ensure the AI service (Ollama) is running'}
                            </p>
                            <button
                                onClick={generateInsight}
                                className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isLight ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-red-900/30 text-red-300 hover:bg-red-900/50'}`}
                            >
                                <Icon name="refresh" size="xs" className="mr-1" />
                                {lang === 'th' ? 'ลองอีกครั้ง' : 'Try Again'}
                            </button>
                        </div>
                    ) : insight?.status === 'success' && insight.insight ? (
                        <div className="space-y-5">
                            {/* Main Insight */}
                            <div className={`prose prose-sm max-w-none ${isLight ? 'prose-gray' : 'prose-invert'}`}>
                                {insight.insight.split('\n\n').map((paragraph, idx) => (
                                    <p
                                        key={idx}
                                        className={`text-sm leading-relaxed mb-3 ${isLight ? 'text-gray-700' : 'text-dark-200'}`}
                                        dangerouslySetInnerHTML={{
                                            __html: paragraph
                                                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                                                .replace(/\n/g, '<br/>')
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Key Highlights */}
                            {insight.highlights && insight.highlights.length > 0 && (
                                <div className={`rounded-lg p-4 ${isLight ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20'}`}>
                                    <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                        <Icon name="stars" size="sm" className="text-amber-500" />
                                        {lang === 'th' ? 'จุดสำคัญ' : 'Key Highlights'}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {insight.highlights.map((highlight, idx) => (
                                            <span
                                                key={idx}
                                                className={`text-sm px-3 py-1.5 rounded-full ${isLight ? 'bg-white text-gray-700 border border-gray-200 shadow-sm' : 'bg-dark-600 text-dark-200'}`}
                                            >
                                                {highlight}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Items */}
                            {insight.action_items && insight.action_items.length > 0 && (
                                <div className={`rounded-lg p-4 border-l-4 border-amber-500 ${isLight ? 'bg-amber-50' : 'bg-amber-900/20'}`}>
                                    <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                                        <Icon name="checklist" size="sm" />
                                        {lang === 'th' ? 'ข้อเสนอแนะสำหรับผู้บริหาร' : 'Executive Action Items'}
                                    </h4>
                                    <ul className="space-y-2">
                                        {insight.action_items.map((item, idx) => (
                                            <li key={idx} className={`text-sm flex items-start gap-2 ${isLight ? 'text-amber-700' : 'text-amber-200'}`}>
                                                <Icon name="arrow_right" size="xs" className="mt-0.5 flex-shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Policy Recommendations */}
                            {insight.policy_recommendations && insight.policy_recommendations.length > 0 && (
                                <div className={`rounded-lg p-4 border-l-4 border-purple-500 ${isLight ? 'bg-purple-50' : 'bg-purple-900/20'}`}>
                                    <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isLight ? 'text-purple-800' : 'text-purple-300'}`}>
                                        <Icon name="policy" size="sm" />
                                        {lang === 'th' ? 'ข้อเสนอแนะเชิงนโยบาย' : 'Policy Recommendations'}
                                    </h4>
                                    <ul className="space-y-2">
                                        {insight.policy_recommendations.map((item, idx) => (
                                            <li key={idx} className={`text-sm flex items-start gap-2 ${isLight ? 'text-purple-700' : 'text-purple-200'}`}>
                                                <Icon name="gavel" size="xs" className="mt-0.5 flex-shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={`text-center py-8 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                            <Icon name="insights" size="xl" className="mb-3" />
                            <p className="text-sm">{lang === 'th' ? 'คลิกปุ่มรีเฟรชเพื่อสร้างรายงานสรุป AI' : 'Click refresh to generate AI summary'}</p>
                            <button
                                onClick={generateInsight}
                                className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isLight ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50'}`}
                            >
                                <Icon name="auto_awesome" size="xs" className="mr-1" />
                                {lang === 'th' ? 'สร้างรายงาน AI' : 'Generate AI Summary'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </Card>
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

        // Process all stations in batches of 50 for better performance
        const batchSize = 50
        for (let i = 0; i < stations.length; i += batchSize) {
            const batch = stations.slice(i, i + batchSize)

            await Promise.all(
                batch.map(async (station) => {
                    try {
                        const latestData = await aqiService.getLatest(station.station_id)
                        const pm25 = latestData?.pm25
                        const aqi = pm25ToAqi(pm25)
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
        }

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
                        {lang === 'th' ? 'บทสรุปสำหรับผู้บริหาร' : 'Executive Summary'}
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

            {/* AI Executive Summary Panel */}
            <AIExecutiveSummaryPanel
                summaryStats={summaryStats}
                statusDistribution={statusDistribution}
                isLight={isLight}
                lang={lang}
            />

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
                <AQIStatusChart
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
