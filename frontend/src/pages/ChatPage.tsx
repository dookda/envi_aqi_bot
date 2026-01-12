/**
 * Chat Page - AI-powered Air Quality Chatbot (v2.0)
 *
 * Modern, premium chat interface with:
 * - Split-panel layout
 * - Rich message rendering with markdown
 * - Interactive charts
 * - Health recommendations
 * - Quick action buttons
 */
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Icon, Badge } from '../components/atoms'
import { Navbar } from '../components/organisms'
import { useChat } from '../hooks'
import { useLanguage, useTheme } from '../contexts'
import type { ChatMessage as ChatMessageType, Language } from '../types'

// AQI Level configurations
interface AQILevelConfig {
    color: string
    bgColor: string
    bgLight: string
    borderColor: string
    label: { en: string; th: string }
    icon: string
    advice: { en: string; th: string }
}

const AQI_LEVELS: Record<string, AQILevelConfig> = {
    excellent: {
        color: 'text-green-500',
        bgColor: 'bg-green-500',
        bgLight: 'bg-green-100',
        borderColor: 'border-green-500',
        label: { en: 'Excellent', th: 'ดีมาก' },
        icon: 'sentiment_very_satisfied',
        advice: {
            en: 'Air quality is ideal. Perfect for outdoor activities!',
            th: 'คุณภาพอากาศดีเยี่ยม เหมาะสำหรับกิจกรรมกลางแจ้ง!'
        }
    },
    good: {
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500',
        bgLight: 'bg-emerald-100',
        borderColor: 'border-emerald-500',
        label: { en: 'Good', th: 'ดี' },
        icon: 'sentiment_satisfied',
        advice: {
            en: 'Air quality is satisfactory. Enjoy outdoor activities.',
            th: 'คุณภาพอากาศดี สามารถทำกิจกรรมกลางแจ้งได้'
        }
    },
    moderate: {
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500',
        bgLight: 'bg-yellow-100',
        borderColor: 'border-yellow-500',
        label: { en: 'Moderate', th: 'ปานกลาง' },
        icon: 'sentiment_neutral',
        advice: {
            en: 'Sensitive individuals should limit prolonged outdoor exertion.',
            th: 'ผู้ที่มีความไวต่อมลพิษควรจำกัดกิจกรรมกลางแจ้ง'
        }
    },
    unhealthy_sensitive: {
        color: 'text-orange-500',
        bgColor: 'bg-orange-500',
        bgLight: 'bg-orange-100',
        borderColor: 'border-orange-500',
        label: { en: 'Unhealthy (Sensitive)', th: 'มีผลต่อสุขภาพ (กลุ่มเสี่ยง)' },
        icon: 'sentiment_dissatisfied',
        advice: {
            en: 'Sensitive groups should avoid outdoor activities. Others should limit prolonged exertion.',
            th: 'กลุ่มเสี่ยงควรหลีกเลี่ยงกิจกรรมกลางแจ้ง คนทั่วไปควรจำกัดการออกกำลังกาย'
        }
    },
    unhealthy: {
        color: 'text-red-500',
        bgColor: 'bg-red-500',
        bgLight: 'bg-red-100',
        borderColor: 'border-red-500',
        label: { en: 'Unhealthy', th: 'มีผลต่อสุขภาพ' },
        icon: 'sentiment_very_dissatisfied',
        advice: {
            en: 'Everyone should limit outdoor activities. Wear N95 masks if going outside.',
            th: 'ทุกคนควรจำกัดกิจกรรมกลางแจ้ง สวมหน้ากาก N95 หากต้องออกนอกบ้าน'
        }
    },
    hazardous: {
        color: 'text-purple-500',
        bgColor: 'bg-purple-500',
        bgLight: 'bg-purple-100',
        borderColor: 'border-purple-500',
        label: { en: 'Hazardous', th: 'อันตราย' },
        icon: 'warning',
        advice: {
            en: 'Health emergency! Stay indoors with air purifier. Avoid all outdoor activities.',
            th: 'ฉุกเฉินด้านสุขภาพ! อยู่ในอาคารพร้อมเครื่องฟอกอากาศ หลีกเลี่ยงกิจกรรมกลางแจ้งทั้งหมด'
        }
    }
}

const getAqiLevel = (level: string): AQILevelConfig => AQI_LEVELS[level] || AQI_LEVELS.moderate

export default function Chat(): React.ReactElement {
    const { messages, loading, sendMessage, clearMessages } = useChat()
    const [inputText, setInputText] = useState<string>('')
    const [showSidebar, setShowSidebar] = useState<boolean>(true)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)

    const { t, language } = useLanguage()
    const { isLight } = useTheme()

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input on load
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault()
        if (!inputText.trim() || loading) return

        await sendMessage(inputText)
        setInputText('')
    }

    const handleQuickAction = (query: string): void => {
        setInputText(query)
        inputRef.current?.focus()
    }

    const quickActions = [
        {
            icon: 'search',
            label: language === 'th' ? 'ค้นหาสถานี' : 'Search Stations',
            query: language === 'th' ? 'ค้นหาสถานีเชียงใหม่' : 'Search stations in Chiang Mai'
        },
        {
            icon: 'show_chart',
            label: language === 'th' ? 'ดูกราฟ PM2.5' : 'PM2.5 Chart',
            query: language === 'th' ? 'ขอดูค่า PM2.5 ย้อนหลัง 7 วันของเชียงใหม่' : 'Show PM2.5 chart for Bangkok last week'
        },
        {
            icon: 'air',
            label: language === 'th' ? 'คุณภาพอากาศวันนี้' : 'Today\'s Air Quality',
            query: language === 'th' ? 'คุณภาพอากาศวันนี้ที่กรุงเทพ' : 'Air quality today in Bangkok'
        },
        {
            icon: 'compare_arrows',
            label: language === 'th' ? 'เปรียบเทียบสถานี' : 'Compare Stations',
            query: language === 'th' ? 'ค้นหาสถานีในภาคเหนือ' : 'Find stations in Northern Thailand'
        }
    ]

    const exampleQueries = language === 'th' ? [
        'ขอดูค่า PM2.5 ย้อนหลัง 7 วันของสถานีเชียงใหม่',
        'ค้นหาสถานีใน กทม',
        'แสดงกราฟฝุ่น PM2.5 ที่ลำปาง',
        'สถานีตรวจวัดในภูเก็ต'
    ] : [
        'Show PM2.5 for last 7 days in Chiang Mai',
        'Search stations in Bangkok',
        'Air quality trends in Lampang',
        'List monitoring stations in Phuket'
    ]

    return (
        <div className="min-h-screen gradient-dark">

            <main className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar - Info Panel */}
                    <div className={`lg:col-span-1 space-y-4 ${showSidebar ? '' : 'hidden lg:block'}`}>
                        {/* AI Assistant Card */}
                        <Card className="p-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-500/20 to-transparent rounded-bl-full" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? 'bg-primary-100' : 'bg-primary-900/50'}`}>
                                        <Icon name="smart_toy" size="lg" color="primary" />
                                    </div>
                                    <div>
                                        <h3 className={`font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                            {language === 'th' ? 'ผู้ช่วย AI' : 'AI Assistant'}
                                        </h3>
                                        <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                            {language === 'th' ? 'พร้อมช่วยเหลือคุณ' : 'Ready to help you'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="success" size="sm">
                                        <Icon name="check_circle" size="xs" /> Online
                                    </Badge>
                                    <Badge variant="primary" size="sm">
                                        🇹🇭 TH/EN
                                    </Badge>
                                </div>
                            </div>
                        </Card>

                        {/* Quick Actions */}
                        <Card className="p-4">
                            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                <Icon name="bolt" size="sm" color="warning" />
                                {language === 'th' ? 'การดำเนินการด่วน' : 'Quick Actions'}
                            </h4>
                            <div className="space-y-2">
                                {quickActions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleQuickAction(action.query)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-center gap-2 group ${isLight
                                            ? 'bg-gray-50 hover:bg-primary-50 text-gray-700 hover:text-primary-700'
                                            : 'bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white'
                                            }`}
                                    >
                                        <Icon name={action.icon} size="sm" className="group-hover:scale-110 transition-transform" />
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </Card>

                        {/* Tips Card */}
                        <Card className={`p-4 ${isLight ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-blue-800/30'}`}>
                            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>
                                <Icon name="lightbulb" size="sm" />
                                {language === 'th' ? 'เคล็ดลับ' : 'Tips'}
                            </h4>
                            <ul className={`text-xs space-y-2 ${isLight ? 'text-blue-700' : 'text-blue-300/80'}`}>
                                <li className="flex items-start gap-2">
                                    <Icon name="check" size="xs" />
                                    {language === 'th' ? 'ใช้ภาษาไทยหรืออังกฤษได้' : 'Ask in Thai or English'}
                                </li>
                                <li className="flex items-start gap-2">
                                    <Icon name="check" size="xs" />
                                    {language === 'th' ? 'ระบุชื่อจังหวัดหรือสถานี' : 'Mention province or station name'}
                                </li>
                                <li className="flex items-start gap-2">
                                    <Icon name="check" size="xs" />
                                    {language === 'th' ? 'ขอดูกราฟย้อนหลังได้' : 'Request historical charts'}
                                </li>
                            </ul>
                        </Card>
                    </div>

                    {/* Main Chat Area */}
                    <div className="lg:col-span-3 flex flex-col">
                        {/* Messages Container */}
                        <Card className={`flex-1 flex flex-col overflow-hidden ${isLight ? 'bg-white' : 'bg-dark-900/50'}`}>
                            {/* Chat Header */}
                            <div className={`px-4 py-3 border-b flex items-center justify-between ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-dark-800/50 border-dark-700'}`}>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="lg:hidden"
                                        onClick={() => setShowSidebar(!showSidebar)}
                                    >
                                        <Icon name="menu" size="sm" />
                                    </button>
                                    <Icon name="chat" color="primary" />
                                    <span className={`font-medium ${isLight ? 'text-gray-700' : 'text-white'}`}>
                                        {language === 'th' ? 'สนทนา' : 'Conversation'}
                                    </span>
                                    {messages.length > 0 && (
                                        <Badge variant="default" size="sm">
                                            {messages.length} {language === 'th' ? 'ข้อความ' : 'messages'}
                                        </Badge>
                                    )}
                                </div>
                                {messages.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearMessages}
                                        disabled={loading}
                                    >
                                        <Icon name="delete_sweep" size="sm" />
                                        {language === 'th' ? 'ล้าง' : 'Clear'}
                                    </Button>
                                )}
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 min-h-[400px] max-h-[500px]">
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center">
                                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 ${isLight ? 'bg-primary-100' : 'bg-primary-900/30'}`}>
                                            <Icon name="forum" size="2xl" color="primary" />
                                        </div>
                                        <h3 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-700' : 'text-white'}`}>
                                            {language === 'th' ? 'เริ่มต้นการสนทนา' : 'Start a Conversation'}
                                        </h3>
                                        <p className={`text-sm text-center mb-6 max-w-md ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                            {language === 'th'
                                                ? 'ถามเกี่ยวกับคุณภาพอากาศ, ค่า PM2.5, หรือค้นหาสถานีตรวจวัด'
                                                : 'Ask about air quality, PM2.5 levels, or search for monitoring stations'}
                                        </p>

                                        {/* Example Queries */}
                                        <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {exampleQueries.map((query, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleQuickAction(query)}
                                                    className={`text-left px-3 py-2 rounded-lg text-xs transition flex items-start gap-2 ${isLight
                                                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                                        : 'bg-dark-800 hover:bg-dark-700 text-dark-300'
                                                        }`}
                                                >
                                                    <Icon name="arrow_forward" size="xs" color="primary" className="mt-0.5 flex-shrink-0" />
                                                    <span className="line-clamp-2">{query}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {messages.map((message) => (
                                            <ChatMessage
                                                key={message.id}
                                                message={message}
                                                isLight={isLight}
                                                language={language}
                                            />
                                        ))}
                                        {loading && <TypingIndicator isLight={isLight} language={language} />}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className={`p-4 border-t ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-dark-800/50 border-dark-700'}`}>
                                <form onSubmit={handleSubmit} className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={inputText}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
                                            placeholder={language === 'th' ? 'พิมพ์คำถามของคุณ...' : 'Type your question...'}
                                            className={`w-full px-4 py-3 pr-12 border rounded-xl transition focus:outline-none focus:ring-2 focus:ring-primary-500/50 ${isLight
                                                ? 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'
                                                : 'bg-dark-800 border-dark-600 text-white placeholder-dark-500'
                                                }`}
                                            maxLength={500}
                                            disabled={loading}
                                        />
                                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                            {inputText.length}/500
                                        </span>
                                    </div>
                                    <Button
                                        type="submit"
                                        loading={loading}
                                        disabled={!inputText.trim() || loading}
                                        className="px-6"
                                    >
                                        <Icon name="send" size="sm" />
                                    </Button>
                                </form>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}

interface TypingIndicatorProps {
    isLight: boolean
    language: Language
}

function TypingIndicator({ isLight, language }: TypingIndicatorProps): React.ReactElement {
    return (
        <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Icon name="smart_toy" size="sm" color="white" />
            </div>
            <div className={`rounded-2xl rounded-tl-md px-4 py-3 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                        {language === 'th' ? 'กำลังคิด...' : 'Thinking...'}
                    </span>
                </div>
            </div>
        </div>
    )
}

interface ChatMessageProps {
    message: ChatMessageType
    isLight: boolean
    language: Language
}

function ChatMessage({ message, isLight, language }: ChatMessageProps): React.ReactElement {
    const isUser = message.type === 'user'
    const isError = message.status === 'error' || message.status === 'out_of_scope'
    const isStationSearch = message.summary?.stations && message.summary?.search_summary
    const hasData = message.data && message.data.length > 0

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${isUser
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                : 'bg-gradient-to-br from-primary-500 to-primary-600'
                }`}>
                <Icon name={isUser ? 'person' : 'smart_toy'} size="sm" color="white" />
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 ${isUser
                    ? 'rounded-tr-md bg-gradient-to-br from-emerald-500/90 to-emerald-600/90 text-white'
                    : isError
                        ? isLight
                            ? 'rounded-tl-md bg-red-50 border border-red-200'
                            : 'rounded-tl-md bg-red-900/20 border border-red-700/30'
                        : isLight
                            ? 'rounded-tl-md bg-gray-100'
                            : 'rounded-tl-md bg-dark-800'
                    }`}>
                    {/* Message Text */}
                    <div className={`text-sm leading-relaxed whitespace-pre-wrap ${isUser
                        ? 'text-white'
                        : isError
                            ? isLight ? 'text-red-700' : 'text-red-300'
                            : isLight ? 'text-gray-800' : 'text-white'
                        }`}>
                        <FormattedText text={message.text} />
                    </div>

                    {/* Health Recommendation Card */}
                    {message.summary?.aqi_level && !isStationSearch && (
                        <HealthAdviceCard
                            aqiLevel={message.summary.aqi_level}
                            isLight={isLight}
                            language={language}
                        />
                    )}

                    {/* Station Search Results */}
                    {message.status === 'success' && isStationSearch && (
                        <div className={`mt-4 pt-4 border-t ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                            <StationSearchResults
                                stations={message.summary.stations}
                                isLight={isLight}
                                language={language}
                            />
                        </div>
                    )}

                    {/* Chart Visualization */}
                    {message.status === 'success' && hasData && !isStationSearch && (
                        <div className={`mt-4 pt-4 border-t ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                            <EnhancedChart
                                data={message.data}
                                summary={message.summary}
                                isLight={isLight}
                                language={language}
                            />
                        </div>
                    )}
                </div>

                {/* Timestamp */}
                <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                        {new Date(message.timestamp).toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                    {isUser && (
                        <Icon name="done_all" size="xs" className={isLight ? 'text-gray-400' : 'text-dark-500'} />
                    )}
                </div>
            </div>
        </div>
    )
}

interface FormattedTextProps {
    text: string
}

function FormattedText({ text }: FormattedTextProps): React.ReactElement {
    if (!text) return <></>

    // Simple markdown-like formatting
    const lines = text.split('\n')

    return (
        <>
            {lines.map((line, idx) => {
                // Bold text: **text**
                let formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                // Emoji headers
                formattedLine = formattedLine.replace(/^(🔍|📍|📊|💨|⚠️|✅|❌|💡|🏥|😷)/, '<span class="text-lg mr-1">$1</span>')

                return (
                    <span key={idx} className="block" dangerouslySetInnerHTML={{ __html: formattedLine || '&nbsp;' }} />
                )
            })}
        </>
    )
}

interface HealthAdviceCardProps {
    aqiLevel: string
    isLight: boolean
    language: Language
}

function HealthAdviceCard({ aqiLevel, isLight, language }: HealthAdviceCardProps): React.ReactElement {
    const level = getAqiLevel(aqiLevel)

    return (
        <div className={`mt-3 p-3 rounded-lg border ${isLight ? level.bgLight : 'bg-opacity-10'} ${level.borderColor}/30`}>
            <div className="flex items-start gap-2">
                <Icon name={level.icon} className={level.color} />
                <div className="flex-1">
                    <div className={`text-sm font-medium ${level.color}`}>
                        {language === 'th' ? 'คำแนะนำสุขภาพ' : 'Health Advice'}
                    </div>
                    <p className={`text-xs mt-1 ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                        {level.advice[language] || level.advice.en}
                    </p>
                </div>
            </div>
        </div>
    )
}

interface Station {
    station_id: string
    name_en?: string
    name_th?: string
    aqi_level?: string
    latest_pm25?: number
    avg_pm25_7d?: number
    data_completeness_7d?: number
}

interface StationSearchResultsProps {
    stations: Station[]
    isLight: boolean
    language: Language
}

function StationSearchResults({ stations, isLight, language }: StationSearchResultsProps): React.ReactElement | null {
    const [showAll, setShowAll] = useState<boolean>(false)

    if (!stations || stations.length === 0) return null

    const INITIAL_DISPLAY = 5
    const displayedStations = showAll ? stations : stations.slice(0, INITIAL_DISPLAY)
    const remainingCount = stations.length - INITIAL_DISPLAY

    return (
        <div className="space-y-3">
            <div className={`text-xs font-medium flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                <Icon name="location_on" size="sm" color="primary" />
                {language === 'th' ? `พบ ${stations.length} สถานี` : `Found ${stations.length} station(s)`}
            </div>

            <div className={`space-y-2 ${showAll ? 'max-h-96' : 'max-h-64'} overflow-y-auto transition-all duration-300`}>
                {displayedStations.map((station, index) => {
                    const level = getAqiLevel(station.aqi_level || 'moderate')

                    return (
                        <div
                            key={station.station_id || index}
                            className={`p-3 rounded-xl border transition hover:scale-[1.02] ${isLight
                                ? 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-md'
                                : 'bg-dark-700/50 border-dark-600 hover:border-primary-500/50'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <div className={`font-medium text-sm flex items-center gap-1 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                        <Icon name="location_on" size="sm" color="primary" />
                                        {station.name_en || station.name_th || station.station_id}
                                    </div>
                                    {station.name_th && station.name_en && (
                                        <div className={`text-xs ml-5 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                            {station.name_th}
                                        </div>
                                    )}
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${level.bgLight} ${level.color}`}>
                                    <Icon name={level.icon} size="xs" />
                                    {level.label[language] || level.label.en}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className={`flex items-center gap-1 ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                                    <Icon name="air" size="xs" />
                                    <span className="font-medium">PM2.5:</span>
                                    {station.latest_pm25 ? `${station.latest_pm25} μg/m³` : 'N/A'}
                                </div>
                                <div className={`flex items-center gap-1 ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                                    <Icon name="calendar_today" size="xs" />
                                    <span className="font-medium">7d Avg:</span>
                                    {station.avg_pm25_7d ? `${station.avg_pm25_7d}` : 'N/A'}
                                </div>
                            </div>

                            {station.data_completeness_7d && (
                                <div className="mt-2">
                                    <div className={`w-full h-1.5 rounded-full ${isLight ? 'bg-gray-200' : 'bg-dark-600'}`}>
                                        <div
                                            className="h-1.5 rounded-full bg-gradient-to-r from-primary-400 to-primary-600"
                                            style={{ width: `${Math.min(station.data_completeness_7d, 100)}%` }}
                                        />
                                    </div>
                                    <div className={`text-[10px] mt-1 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                        {language === 'th' ? 'ข้อมูลครบถ้วน' : 'Data completeness'}: {station.data_completeness_7d}%
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Show More / Show Less Button */}
            {stations.length > INITIAL_DISPLAY && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className={`w-full py-2 px-4 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2 ${isLight
                        ? 'bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200'
                        : 'bg-primary-900/30 hover:bg-primary-900/50 text-primary-300 border border-primary-700/30'
                        }`}
                >
                    <Icon
                        name={showAll ? 'expand_less' : 'expand_more'}
                        size="sm"
                    />
                    {showAll
                        ? (language === 'th' ? 'แสดงน้อยลง' : 'Show Less')
                        : (language === 'th'
                            ? `แสดงอีก ${remainingCount} สถานี`
                            : `Show ${remainingCount} More Stations`)
                    }
                </button>
            )}
        </div>
    )
}

interface DataPoint {
    value: number | null
    time?: string
}

interface EnhancedChartProps {
    data: DataPoint[]
    summary?: any
    isLight: boolean
    language: Language
}

function EnhancedChart({ data, summary, isLight, language }: EnhancedChartProps): React.ReactElement | null {
    if (!data || data.length === 0) return null

    const isTimeSeriesData = data[0]?.value !== undefined || data[0]?.time !== undefined
    if (!isTimeSeriesData) return null

    const validData = data.filter(d => d.value !== null)
    if (validData.length === 0) return null

    const values = validData.map(d => d.value as number)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const range = max - min || 1

    const firstTime = validData[0]?.time ? new Date(validData[0].time as string) : null
    const lastTime = validData[validData.length - 1]?.time ? new Date(validData[validData.length - 1].time as string) : null

    // Determine bar color based on average
    const getBarColor = (value: number): string => {
        if (value <= 25) return 'from-green-400 to-green-500'
        if (value <= 50) return 'from-emerald-400 to-emerald-500'
        if (value <= 100) return 'from-yellow-400 to-yellow-500'
        if (value <= 200) return 'from-orange-400 to-orange-500'
        return 'from-red-400 to-red-500'
    }

    return (
        <div className="space-y-3">
            {/* Chart Header */}
            <div className="flex items-center justify-between">
                <div className={`text-xs font-medium flex items-center gap-1 ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                    <Icon name="show_chart" size="sm" color="primary" />
                    {language === 'th' ? 'กราฟแนวโน้ม' : 'Trend Chart'}
                    <Badge variant="default" size="sm">{validData.length} pts</Badge>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
                <div className={`p-2 rounded-lg text-center ${isLight ? 'bg-gray-100' : 'bg-dark-700/50'}`}>
                    <div className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                        {language === 'th' ? 'ต่ำสุด' : 'Min'}
                    </div>
                    <div className={`text-sm font-bold text-green-500`}>{min.toFixed(1)}</div>
                </div>
                <div className={`p-2 rounded-lg text-center ${isLight ? 'bg-primary-50' : 'bg-primary-900/20'}`}>
                    <div className={`text-xs ${isLight ? 'text-primary-600' : 'text-primary-400'}`}>
                        {language === 'th' ? 'เฉลี่ย' : 'Average'}
                    </div>
                    <div className={`text-sm font-bold ${isLight ? 'text-primary-700' : 'text-primary-300'}`}>{avg.toFixed(1)}</div>
                </div>
                <div className={`p-2 rounded-lg text-center ${isLight ? 'bg-gray-100' : 'bg-dark-700/50'}`}>
                    <div className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                        {language === 'th' ? 'สูงสุด' : 'Max'}
                    </div>
                    <div className={`text-sm font-bold text-red-500`}>{max.toFixed(1)}</div>
                </div>
            </div>

            {/* Chart */}
            <div className="flex">
                {/* Y-axis */}
                <div className={`flex flex-col justify-between text-[10px] pr-2 ${isLight ? 'text-gray-400' : 'text-dark-500'}`} style={{ minWidth: '35px' }}>
                    <span className="text-right">{max.toFixed(0)}</span>
                    <span className="text-right">{((max + min) / 2).toFixed(0)}</span>
                    <span className="text-right">{min.toFixed(0)}</span>
                </div>

                {/* Chart Area - Line Chart */}
                <div className="flex-1">
                    <div className={`relative h-24 border-l border-b rounded-bl-lg ${isLight ? 'border-gray-300' : 'border-dark-600'}`}>
                        <svg width="100%" height="100%" className="overflow-visible">
                            {/* Background grid */}
                            <line x1="0" y1="50%" x2="100%" y2="50%" stroke={isLight ? '#e5e7eb' : '#374151'} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

                            {/* Line path */}
                            <polyline
                                points={validData.slice(-60).map((point, index) => {
                                    const x = (index / Math.max(validData.slice(-60).length - 1, 1)) * 100
                                    const y = 100 - ((point.value! - min) / range) * 100
                                    return `${x}%,${y}%`
                                }).join(' ')}
                                fill="none"
                                stroke="url(#lineGradient)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-all duration-300"
                            />

                            {/* Gradient definition */}
                            <defs>
                                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#3b82f6" />
                                    <stop offset="50%" stopColor="#8b5cf6" />
                                    <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                            </defs>

                            {/* Data points */}
                            {validData.slice(-60).map((point, index) => {
                                const x = (index / Math.max(validData.slice(-60).length - 1, 1)) * 100
                                const y = 100 - ((point.value! - min) / range) * 100
                                const color = point.value! <= 50 ? '#10b981' : point.value! <= 100 ? '#f59e0b' : '#ef4444'
                                return (
                                    <circle
                                        key={index}
                                        cx={`${x}%`}
                                        cy={`${y}%`}
                                        r="3"
                                        fill={color}
                                        className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <title>{`${point.value?.toFixed(1)} μg/m³\n${point.time ? new Date(point.time).toLocaleString() : ''}`}</title>
                                    </circle>
                                )
                            })}
                        </svg>
                    </div>

                    {/* X-axis */}
                    <div className={`flex justify-between text-[10px] mt-1 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                        {firstTime && <span>{firstTime.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: '2-digit', month: 'short' })}</span>}
                        <span className="flex-1 text-center">→</span>
                        {lastTime && <span>{lastTime.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: '2-digit', month: 'short' })}</span>}
                    </div>
                </div>
            </div>

            {/* Trend */}
            {summary?.trend && (
                <div className={`flex items-center gap-2 text-xs ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                    <Icon
                        name={
                            summary.trend === 'increasing' ? 'trending_up' :
                                summary.trend === 'decreasing' ? 'trending_down' :
                                    summary.trend === 'stable' ? 'trending_flat' : 'help'
                        }
                        size="sm"
                        className={
                            summary.trend === 'increasing' ? 'text-red-500' :
                                summary.trend === 'decreasing' ? 'text-green-500' :
                                    'text-gray-500'
                        }
                    />
                    <span>
                        {language === 'th' ? 'แนวโน้ม: ' : 'Trend: '}
                        {summary.trend === 'increasing'
                            ? (language === 'th' ? 'เพิ่มขึ้น ↑' : 'Increasing ↑')
                            : summary.trend === 'decreasing'
                                ? (language === 'th' ? 'ลดลง ↓' : 'Decreasing ↓')
                                : summary.trend === 'stable'
                                    ? (language === 'th' ? 'คงที่ →' : 'Stable →')
                                    : (language === 'th' ? 'ข้อมูลไม่เพียงพอ' : 'Insufficient data')
                        }
                    </span>
                </div>
            )}
        </div>
    )
}
