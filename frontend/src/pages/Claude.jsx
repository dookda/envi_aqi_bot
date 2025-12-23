/**
 * Claude AI Chat Page - AI-powered Air Quality Chatbot
 *
 * Uses Anthropic Claude API for faster inference
 * Compare performance with local Ollama version
 */
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Icon } from '../components/atoms'
import { Navbar } from '../components/organisms'
import { useClaude } from '../hooks'
import { useLanguage, useTheme } from '../contexts'

export default function Claude() {
    const { messages, loading, lastResponseTime, sendMessage, clearMessages } = useClaude()
    const [inputText, setInputText] = useState('')
    const messagesEndRef = useRef(null)

    const { t } = useLanguage()
    const { isLight } = useTheme()

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!inputText.trim() || loading) return

        await sendMessage(inputText)
        setInputText('')
    }

    const exampleQueries = [
        'ขอดูค่า PM2.5 ย้อนหลัง 7 วันของสถานีเชียงใหม่',
        'Show me PM2.5 for the last week in Bangkok',
        'Search for Chiang Mai stations',
        'ค้นหาสถานีเชียงใหม่',
        'Air quality trends last month in Chiang Mai',
        'List stations in Bangkok'
    ]

    return (
        <div className="min-h-screen gradient-dark">
            {/* Header */}
            <Navbar
                title="🧠 Claude AI Air Quality"
                subtitle="Powered by Anthropic Claude-3-Haiku"
            >
                <Link
                    to="/chat"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="smart_toy" size="sm" />
                    Ollama Chat
                </Link>
                <Link
                    to="/"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="dashboard" size="sm" />
                    Dashboard
                </Link>
            </Navbar>

            <main className="max-w-5xl mx-auto px-4 py-6">
                {/* Performance Badge */}
                <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${isLight ? 'bg-purple-50 border border-purple-200' : 'bg-purple-900/20 border border-purple-700/30'}`}>
                    <div className="flex items-center gap-2">
                        <Icon name="psychology" color="primary" />
                        <span className={`text-sm font-medium ${isLight ? 'text-purple-800' : 'text-purple-300'}`}>
                            Claude AI Mode - Fast cloud inference by Anthropic
                        </span>
                    </div>
                    {lastResponseTime && (
                        <span className={`text-sm font-mono px-2 py-1 rounded ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-800/40 text-purple-200'}`}>
                            Last: {lastResponseTime}ms
                        </span>
                    )}
                </div>

                {/* Info Card */}
                {messages.length === 0 && (
                    <Card className="mb-6 p-6">
                        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-800' : ''}`}>
                            <Icon name="psychology" color="primary" />
                            Claude AI vs Ollama Performance
                        </h3>
                        <div className={`space-y-3 text-sm mb-6 ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                            <p className="flex items-start gap-2">
                                <Icon name="speed" size="sm" color="success" />
                                <strong>Claude AI:</strong> ~1-3 seconds response time (cloud)
                            </p>
                            <p className="flex items-start gap-2">
                                <Icon name="memory" size="sm" color="warning" />
                                <strong>Ollama:</strong> ~7-10 seconds response time (local)
                            </p>
                            <p className="flex items-start gap-2">
                                <Icon name="info" size="sm" color="primary" />
                                Requires ANTHROPIC_API_KEY environment variable
                            </p>
                        </div>

                        <h4 className={`font-medium mb-3 text-sm flex items-center gap-2 ${isLight ? 'text-gray-700' : ''}`}>
                            <Icon name="lightbulb" size="sm" color="warning" />
                            Try these queries:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {exampleQueries.map((query, index) => (
                                <button
                                    key={index}
                                    onClick={() => setInputText(query)}
                                    className={`text-left px-3 py-2 rounded-lg text-xs transition border flex items-center gap-2 ${isLight
                                        ? 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 hover:border-purple-500'
                                        : 'bg-dark-800 hover:bg-dark-700 text-dark-300 border-dark-600 hover:border-purple-500'
                                        }`}
                                >
                                    <Icon name="arrow_forward" size="xs" color="primary" />
                                    "{query}"
                                </button>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Messages Container */}
                <Card className="mb-4 p-4 min-h-[500px] max-h-[600px] overflow-y-auto">
                    {messages.length === 0 ? (
                        <div className={`flex items-center justify-center h-full ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                            <div className="text-center">
                                <Icon name="psychology" size="2xl" className="mb-4" />
                                <p>Ask me anything about air quality!</p>
                                <p className="text-xs mt-2">🧠 Powered by Claude AI</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <ChatMessage key={message.id} message={message} isLight={isLight} t={t} />
                            ))}
                            {loading && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                                        <Icon name="psychology" size="sm" color="white" />
                                    </div>
                                    <div className={`flex-1 rounded-lg p-4 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-75"></div>
                                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-150"></div>
                                            <span className={`text-sm ml-2 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                Claude is thinking...
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </Card>

                {/* Input Form */}
                <Card className="p-4">
                    <form onSubmit={handleSubmit} className="flex gap-3">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Ask about air quality in Thai or English..."
                            className={`flex-1 px-4 py-3 border rounded-lg transition focus:outline-none focus:border-purple-500 ${isLight
                                ? 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                                : 'bg-dark-800 border-dark-600 text-white placeholder-dark-500'
                                }`}
                            maxLength={300}
                            disabled={loading}
                        />
                        <Button
                            type="submit"
                            loading={loading}
                            disabled={!inputText.trim() || loading}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            <Icon name="psychology" size="sm" />
                            Send
                        </Button>
                        {messages.length > 0 && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={clearMessages}
                                disabled={loading}
                            >
                                <Icon name="delete" size="sm" />
                                Clear
                            </Button>
                        )}
                    </form>
                    <p className={`text-xs mt-2 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                        🧠 Claude AI Mode | {inputText.length}/300 characters
                    </p>
                </Card>
            </main>
        </div>
    )
}

function ChatMessage({ message, isLight, t }) {
    const isUser = message.type === 'user'
    const isClaude = message.llm_provider === 'claude'

    // Determine if this is a station search result
    const isStationSearch = message.summary?.stations && message.summary?.search_summary

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-success-500' : 'bg-purple-500'
                }`}>
                <Icon name={isUser ? 'person' : 'psychology'} size="sm" color="white" />
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-lg p-4 ${isUser
                    ? 'bg-success-900/30 border border-success-700/50'
                    : message.status === 'error' || message.status === 'out_of_scope'
                        ? 'bg-danger-900/30 border border-danger-700/50'
                        : isLight
                            ? 'bg-gray-100 border border-gray-200'
                            : 'bg-dark-800 border border-dark-600'
                    }`}>

                    {/* Response time badge */}
                    {!isUser && message.response_time_ms && (
                        <div className={`text-xs mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-800/40 text-purple-200'}`}>
                            <Icon name="psychology" size="xs" />
                            {message.response_time_ms}ms
                        </div>
                    )}

                    {/* Text */}
                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isLight ? 'text-gray-800' : 'text-white'}`}>
                        {message.text}
                    </p>

                    {/* Station search results */}
                    {message.status === 'success' && isStationSearch && (
                        <div className={`mt-4 pt-4 border-t ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                            <StationSearchResults
                                stations={message.summary.stations}
                                isLight={isLight}
                                t={t}
                            />
                        </div>
                    )}

                    {/* Data visualization for non-search queries */}
                    {message.status === 'success' && message.data && !isStationSearch && (
                        <div className={`mt-4 pt-4 border-t ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                            <MiniChart data={message.data} summary={message.summary} isLight={isLight} t={t} />
                        </div>
                    )}

                    {/* Timestamp */}
                    <p className={`text-xs mt-2 flex items-center gap-1 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                        <Icon name="schedule" size="xs" />
                        {new Date(message.timestamp).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                        {isClaude && <span className="ml-2 text-purple-400">🧠 Claude</span>}
                    </p>
                </div>
            </div>
        </div>
    )
}

function StationSearchResults({ stations, isLight, t }) {
    if (!stations || stations.length === 0) return null

    const getAqiColor = (level) => {
        switch (level) {
            case 'excellent': return 'text-green-500'
            case 'good': return 'text-emerald-500'
            case 'moderate': return 'text-yellow-500'
            case 'unhealthy_sensitive': return 'text-orange-500'
            case 'unhealthy': return 'text-red-500'
            default: return isLight ? 'text-gray-500' : 'text-dark-400'
        }
    }

    const getAqiIcon = (level) => {
        switch (level) {
            case 'excellent':
            case 'good':
                return 'sentiment_very_satisfied'
            case 'moderate':
                return 'sentiment_neutral'
            case 'unhealthy_sensitive':
                return 'sentiment_dissatisfied'
            case 'unhealthy':
                return 'sentiment_very_dissatisfied'
            default:
                return 'help'
        }
    }

    const getAqiLabel = (level) => {
        switch (level) {
            case 'excellent': return 'Excellent'
            case 'good': return 'Good'
            case 'moderate': return 'Moderate'
            case 'unhealthy_sensitive': return 'Unhealthy (Sensitive)'
            case 'unhealthy': return 'Unhealthy'
            default: return 'Unknown'
        }
    }

    return (
        <div className="space-y-3">
            <div className={`text-xs font-medium mb-2 flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                <Icon name="search" size="sm" />
                Station Search Results ({stations.length} found)
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
                {stations.slice(0, 5).map((station, index) => (
                    <div
                        key={station.station_id || index}
                        className={`p-3 rounded-lg border ${isLight
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-dark-700 border-dark-600'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className={`font-medium text-sm flex items-center gap-1 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                    <Icon name="location_on" size="sm" color="primary" />
                                    {station.name_en || station.name_th || station.station_id}
                                </div>
                            </div>
                            <span className={`text-xs flex items-center gap-1 ${getAqiColor(station.aqi_level)}`}>
                                <Icon name={getAqiIcon(station.aqi_level)} size="sm" />
                                {getAqiLabel(station.aqi_level)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className={isLight ? 'text-gray-600' : 'text-dark-300'}>
                                <span className="font-medium">Latest PM2.5:</span>{' '}
                                {station.latest_pm25 ? `${station.latest_pm25} μg/m³` : 'N/A'}
                            </div>
                            <div className={isLight ? 'text-gray-600' : 'text-dark-300'}>
                                <span className="font-medium">7-day Avg:</span>{' '}
                                {station.avg_pm25_7d ? `${station.avg_pm25_7d} μg/m³` : 'N/A'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function MiniChart({ data, summary, isLight, t }) {
    if (!data || data.length === 0) return null

    const isTimeSeriesData = data[0]?.value !== undefined || data[0]?.time !== undefined
    if (!isTimeSeriesData) return null

    const validData = data.filter(d => d.value !== null)
    if (validData.length === 0) return null

    const values = validData.map(d => d.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1

    // Get time range for X-axis
    const firstTime = validData[0]?.time ? new Date(validData[0].time) : null
    const lastTime = validData[validData.length - 1]?.time ? new Date(validData[validData.length - 1].time) : null

    return (
        <div className="space-y-2">
            <div className={`text-xs font-medium mb-2 flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                <Icon name="show_chart" size="sm" />
                Trend Chart ({validData.length} data points)
            </div>

            {/* Chart with axis labels */}
            <div className="flex">
                {/* Y-axis labels */}
                <div className={`flex flex-col justify-between text-xs pr-2 ${isLight ? 'text-gray-400' : 'text-dark-500'}`} style={{ minWidth: '45px' }}>
                    <span className="text-right">{max.toFixed(0)}</span>
                    <span className="text-right text-[10px]">μg/m³</span>
                    <span className="text-right">{min.toFixed(0)}</span>
                </div>

                {/* Chart area */}
                <div className="flex-1">
                    {/* Bars */}
                    <div className="flex items-end gap-0.5 h-20 border-l border-b" style={{ borderColor: isLight ? '#d1d5db' : '#4b5563' }}>
                        {validData.slice(0, 50).map((point, index) => {
                            const height = ((point.value - min) / range) * 100
                            return (
                                <div
                                    key={index}
                                    className="flex-1 bg-purple-500 rounded-t opacity-70 hover:opacity-100 transition cursor-pointer"
                                    style={{ height: `${Math.max(height, 5)}%` }}
                                    title={`${point.value} μg/m³\n${point.time ? new Date(point.time).toLocaleString('th-TH') : ''}`}
                                />
                            )
                        })}
                    </div>

                    {/* X-axis labels */}
                    <div className={`flex justify-between text-[10px] mt-1 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                        {firstTime && <span>{firstTime.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</span>}
                        <span className="text-center flex-1">Time →</span>
                        {lastTime && <span>{lastTime.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</span>}
                    </div>
                </div>
            </div>

            {/* Summary stats */}
            {summary && (
                <div className={`text-xs grid grid-cols-3 gap-2 mt-2 pt-2 border-t ${isLight ? 'text-gray-500 border-gray-200' : 'text-dark-400 border-dark-700'}`}>
                    <div className="flex items-center gap-1">
                        <Icon name="functions" size="xs" />
                        Avg: <span className="font-medium">{summary.mean}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Icon name="arrow_downward" size="xs" />
                        Min: <span className="font-medium">{summary.min}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Icon name="arrow_upward" size="xs" />
                        Max: <span className="font-medium">{summary.max}</span>
                    </div>
                </div>
            )}

            {/* Trend indicator */}
            {summary?.trend && (
                <div className={`text-xs flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                    <Icon
                        name={
                            summary.trend === 'increasing' ? 'trending_up' :
                                summary.trend === 'decreasing' ? 'trending_down' :
                                    summary.trend === 'stable' ? 'trending_flat' : 'help'
                        }
                        size="sm"
                    />
                    Trend: {
                        summary.trend === 'increasing' ? 'Increasing ↑' :
                            summary.trend === 'decreasing' ? 'Decreasing ↓' :
                                summary.trend === 'stable' ? 'Stable →' :
                                    'Insufficient data'
                    }
                </div>
            )}
        </div>
    )
}
