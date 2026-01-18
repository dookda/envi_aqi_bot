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
        { count: excellent, color: 'bg-sky-500', label: lang === 'th' ? 'ดีมาก' : 'Excellent' },      // Blue
        { count: good, color: 'bg-green-500', label: lang === 'th' ? 'ดี' : 'Good' },                // Green
        { count: moderate, color: 'bg-yellow-400', label: lang === 'th' ? 'ปานกลาง' : 'Moderate' }, // Yellow
        { count: unhealthy, color: 'bg-orange-500', label: lang === 'th' ? 'เริ่มมีผลกระทบต่อสุขภาพ' : 'Unhealthy' }, // Orange
        { count: veryUnhealthy, color: 'bg-red-500', label: lang === 'th' ? 'มีผลกระทบต่อสุขภาพ' : 'Very Unhealthy' }, // Red
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
    stationsWithData: StationWithLatest[]
    isLight: boolean
    lang: string
}

// AI Executive Summary Panel Component
const AIExecutiveSummaryPanel: React.FC<AIExecutiveSummaryPanelProps> = ({
    summaryStats,
    statusDistribution,
    stationsWithData,
    isLight,
    lang
}) => {
    const [insight, setInsight] = useState<ExecutiveSummaryInsight | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [isExpanded, setIsExpanded] = useState<boolean>(true)

    const generateInsight = useCallback(() => {
        if (!summaryStats) return

        setLoading(true)

        // Generate insights locally for fast performance
        const insights: string[] = []
        const highlights: string[] = []
        const actionItems: string[] = []
        const policyRecommendations: string[] = []

        const { avgAqi, maxAqi, minAqi, activeStations, totalStations, alertCount } = summaryStats
        const { excellent, good, moderate, unhealthy, veryUnhealthy } = statusDistribution

        // Date and time info
        const currentDate = new Date()
        const dateStr = currentDate.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        const timeStr = currentDate.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })

        if (lang === 'th') {
            // Thai language insights
            insights.push(`📅 **รายงานสรุปผู้บริหาร** ประจำวัน${dateStr} เวลา ${timeStr}`)

            // Overall status
            let statusText = ''
            if (avgAqi <= 25) {
                statusText = 'ดีมาก (Excellent)'
                highlights.push('คุณภาพอากาศดีมาก เหมาะสำหรับกิจกรรมกลางแจ้งทุกประเภท')
            } else if (avgAqi <= 50) {
                statusText = 'ดี (Good)'
                highlights.push('คุณภาพอากาศอยู่ในเกณฑ์ดี')
            } else if (avgAqi <= 100) {
                statusText = 'ปานกลาง (Moderate)'
                highlights.push('คุณภาพอากาศปานกลาง กลุ่มเสี่ยงควรระวัง')
            } else if (avgAqi <= 200) {
                statusText = 'เริ่มมีผลกระทบต่อสุขภาพ'
                highlights.push('⚠️ คุณภาพอากาศเริ่มส่งผลกระทบต่อสุขภาพ')
            } else {
                statusText = 'มีผลกระทบต่อสุขภาพ'
                highlights.push('🚨 คุณภาพอากาศอยู่ในระดับวิกฤต')
            }

            insights.push(`🌍 **สถานะโดยรวม**: คุณภาพอากาศอยู่ในระดับ **${statusText}** โดยมีค่า AQI เฉลี่ย **${avgAqi}**`)

            // Station coverage
            insights.push(`📍 **การครอบคลุม**: มีสถานีที่ทำงานอยู่ **${activeStations}** จาก **${totalStations}** สถานี (${Math.round(activeStations / totalStations * 100)}%)`)
            highlights.push(`${activeStations}/${totalStations} สถานีทำงาน`)

            // AQI range
            insights.push(`📊 **ช่วงค่า AQI**: ต่ำสุด **${minAqi}** - สูงสุด **${maxAqi}** (ช่วงความแตกต่าง ${maxAqi - minAqi})`)
            highlights.push(`ค่า AQI: ${minAqi} - ${maxAqi}`)

            // Distribution summary
            const goodStations = excellent + good
            const badStations = unhealthy + veryUnhealthy
            if (goodStations > 0) {
                insights.push(`✅ **สถานีที่มีคุณภาพอากาศดี**: ${goodStations} สถานี (${Math.round(goodStations / activeStations * 100)}%)`)
            }
            if (badStations > 0) {
                insights.push(`⚠️ **สถานีที่ต้องเฝ้าระวัง**: ${badStations} สถานี มีคุณภาพอากาศเริ่มส่งผลกระทบต่อสุขภาพ`)
                actionItems.push(`เฝ้าระวังพื้นที่ที่มี AQI สูงเกิน 100 จำนวน ${alertCount} สถานี`)
            }

            // Action items
            if (alertCount > 0) {
                actionItems.push(`แจ้งเตือนประชาชนในพื้นที่ที่มีค่า AQI สูง`)
                actionItems.push(`พิจารณามาตรการลดมลพิษในพื้นที่วิกฤต`)
            }
            if (avgAqi > 50) {
                actionItems.push(`ติดตามแนวโน้มคุณภาพอากาศอย่างใกล้ชิด`)
            }
            actionItems.push(`ตรวจสอบการทำงานของสถานีที่ไม่ออนไลน์ (${totalStations - activeStations} สถานี)`)

        } else {
            // English language insights
            insights.push(`📅 **Executive Report** for ${dateStr} at ${timeStr}`)

            // Overall status
            let statusText = ''
            if (avgAqi <= 25) {
                statusText = 'Excellent'
                highlights.push('Air quality is excellent for all outdoor activities')
            } else if (avgAqi <= 50) {
                statusText = 'Good'
                highlights.push('Air quality is satisfactory')
            } else if (avgAqi <= 100) {
                statusText = 'Moderate'
                highlights.push('Air quality is moderate, sensitive groups should be cautious')
            } else if (avgAqi <= 200) {
                statusText = 'Unhealthy for Sensitive Groups'
                highlights.push('⚠️ Air quality affects health of sensitive groups')
            } else {
                statusText = 'Unhealthy'
                highlights.push('🚨 Air quality is at critical level')
            }

            insights.push(`🌍 **Overall Status**: Air quality is **${statusText}** with average AQI of **${avgAqi}**`)

            // Station coverage
            insights.push(`📍 **Coverage**: **${activeStations}** of **${totalStations}** stations active (${Math.round(activeStations / totalStations * 100)}%)`)
            highlights.push(`${activeStations}/${totalStations} stations active`)

            // AQI range
            insights.push(`📊 **AQI Range**: Lowest **${minAqi}** - Highest **${maxAqi}** (range: ${maxAqi - minAqi})`)
            highlights.push(`AQI: ${minAqi} - ${maxAqi}`)

            // Distribution summary
            const goodStations = excellent + good
            const badStations = unhealthy + veryUnhealthy
            if (goodStations > 0) {
                insights.push(`✅ **Good Air Quality**: ${goodStations} stations (${Math.round(goodStations / activeStations * 100)}%)`)
            }
            if (badStations > 0) {
                insights.push(`⚠️ **Stations Requiring Attention**: ${badStations} stations with health-impacting AQI`)
                actionItems.push(`Monitor ${alertCount} areas with AQI exceeding 100`)
            }

            // Action items
            if (alertCount > 0) {
                actionItems.push(`Issue public advisories for high-AQI areas`)
                actionItems.push(`Consider pollution reduction measures in critical zones`)
            }
            if (avgAqi > 50) {
                actionItems.push(`Closely monitor air quality trends`)
            }
            actionItems.push(`Check connectivity of offline stations (${totalStations - activeStations} stations)`)
        }

        // Generate Policy Recommendations based on air quality status
        if (lang === 'th') {
            // Thai policy recommendations
            if (avgAqi > 100) {
                policyRecommendations.push('พิจารณาประกาศเตือนภัยสุขภาพในพื้นที่ที่มีค่า AQI สูง')
                policyRecommendations.push('ควรจัดตั้งศูนย์พักพิงชั่วคราวสำหรับกลุ่มเสี่ยง')
                policyRecommendations.push('ประสานงานกับหน่วยงานที่เกี่ยวข้องเพื่อลดกิจกรรมที่ก่อมลพิษ')
            }
            if (avgAqi > 50) {
                policyRecommendations.push('แนะนำให้โรงเรียนและสถานศึกษาพิจารณาลดกิจกรรมกลางแจ้ง')
                policyRecommendations.push('ประชาสัมพันธ์ให้ประชาชนสวมหน้ากากอนามัยเมื่อออกนอกอาคาร')
            }
            if (alertCount >= 3) {
                policyRecommendations.push('พิจารณามาตรการจำกัดการจราจรในพื้นที่วิกฤต')
                policyRecommendations.push('เพิ่มความถี่ในการติดตามคุณภาพอากาศเป็นทุก 30 นาที')
            }
            policyRecommendations.push('ส่งเสริมการใช้ระบบขนส่งสาธารณะและลดการใช้รถยนต์ส่วนตัว')
            policyRecommendations.push('สนับสนุนการปลูกต้นไม้และเพิ่มพื้นที่สีเขียวในเมือง')
        } else {
            // English policy recommendations
            if (avgAqi > 100) {
                policyRecommendations.push('Consider issuing health advisories for high-AQI areas')
                policyRecommendations.push('Set up temporary shelters for vulnerable populations')
                policyRecommendations.push('Coordinate with agencies to reduce pollution-causing activities')
            }
            if (avgAqi > 50) {
                policyRecommendations.push('Advise schools to reduce outdoor activities')
                policyRecommendations.push('Public awareness campaign for wearing masks outdoors')
            }
            if (alertCount >= 3) {
                policyRecommendations.push('Consider traffic restrictions in critical areas')
                policyRecommendations.push('Increase air quality monitoring frequency to every 30 minutes')
            }
            policyRecommendations.push('Promote public transportation and reduce private vehicle usage')
            policyRecommendations.push('Support urban tree planting and green space expansion')
        }

        // Simulate a brief loading delay for UX
        setTimeout(() => {
            setInsight({
                status: 'success',
                insight: insights.join('\n\n'),
                highlights,
                executive_brief: highlights[0] || null,
                action_items: actionItems.length > 0 ? actionItems : null,
                policy_recommendations: policyRecommendations.length > 0 ? policyRecommendations : null,
                error: null
            })
            setLoading(false)
        }, 300)

    }, [summaryStats, statusDistribution, lang])

    // Generate insight when data changes
    useEffect(() => {
        if (summaryStats && summaryStats.activeStations > 0) {
            generateInsight()
        }
    }, [summaryStats, statusDistribution, generateInsight])

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
                            <p className="text-sm">{lang === 'th' ? 'ไม่มีข้อมูลสำหรับการวิเคราะห์' : 'No data available for analysis'}</p>
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
                stationsWithData={stationsWithData}
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
