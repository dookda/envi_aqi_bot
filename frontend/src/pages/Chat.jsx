/**
 * Chat Page - AI-powered Air Quality Chatbot
 *
 * Natural language interface for querying air quality data
 * Supports Thai and English queries
 */
import { useState, useRef, useEffect } from 'react'
import { Button, Card } from '../components/atoms'
import { Navbar } from '../components/organisms'
import { useChat } from '../hooks'
import { useLanguage, useTheme } from '../contexts'

export default function Chat() {
    const { messages, loading, sendMessage, clearMessages } = useChat()
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
        'คุณภาพอากาศวันนี้ที่กรุงเทพฯ',
        'Air quality trends last month in Chiang Mai'
    ]

    return (
        <div className="min-h-screen gradient-dark">
            {/* Header with Language/Theme toggles */}
            <Navbar
                title={t('chat.title')}
                subtitle={t('chat.subtitle')}
            >
                <a
                    href="/"
                    className={`transition text-sm ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    {t('chat.dashboard')}
                </a>
                <a
                    href="/models"
                    className={`transition text-sm ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    {t('chat.models')}
                </a>
            </Navbar>

            <main className="max-w-5xl mx-auto px-4 py-6">
                {/* Info Card */}
                {messages.length === 0 && (
                    <Card className="mb-6 p-6">
                        <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-800' : ''}`}>
                            {t('chat.howToUse')}
                        </h3>
                        <div className={`space-y-3 text-sm mb-6 ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                            <p>{t('chat.instruction1')}</p>
                            <p>{t('chat.instruction2')}</p>
                            <p>{t('chat.instruction3')}</p>
                        </div>

                        <h4 className={`font-medium mb-3 text-sm ${isLight ? 'text-gray-700' : ''}`}>
                            {t('chat.exampleQueries')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {exampleQueries.map((query, index) => (
                                <button
                                    key={index}
                                    onClick={() => setInputText(query)}
                                    className={`text-left px-3 py-2 rounded-lg text-xs transition border ${isLight
                                            ? 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 hover:border-primary-500'
                                            : 'bg-dark-800 hover:bg-dark-700 text-dark-300 border-dark-600 hover:border-primary-500'
                                        }`}
                                >
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
                                <div className="text-6xl mb-4">💬</div>
                                <p>{t('chat.startConversation')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <ChatMessage key={message.id} message={message} isLight={isLight} t={t} />
                            ))}
                            {loading && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                        🤖
                                    </div>
                                    <div className={`flex-1 rounded-lg p-4 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
                                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse delay-75"></div>
                                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse delay-150"></div>
                                            <span className={`text-sm ml-2 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                {t('chat.processing')}
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
                            placeholder={t('chat.placeholder')}
                            className={`flex-1 px-4 py-3 border rounded-lg transition focus:outline-none focus:border-primary-500 ${isLight
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
                        >
                            {t('chat.send')}
                        </Button>
                        {messages.length > 0 && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={clearMessages}
                                disabled={loading}
                            >
                                {t('chat.clear')}
                            </Button>
                        )}
                    </form>
                    <p className={`text-xs mt-2 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                        {t('chat.maxLength')} {inputText.length}/300 {t('chat.characters')}
                    </p>
                </Card>
            </main>
        </div>
    )
}

function ChatMessage({ message, isLight, t }) {
    const isUser = message.type === 'user'

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-success-500' : 'bg-primary-500'
                }`}>
                {isUser ? '👤' : '🤖'}
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
                    {/* Text */}
                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isLight ? 'text-gray-800' : 'text-white'}`}>
                        {message.text}
                    </p>

                    {/* Data visualization for successful queries */}
                    {message.status === 'success' && message.data && (
                        <div className={`mt-4 pt-4 border-t ${isLight ? 'border-gray-200' : 'border-dark-700'}`}>
                            <MiniChart data={message.data} summary={message.summary} isLight={isLight} t={t} />
                        </div>
                    )}

                    {/* Timestamp */}
                    <p className={`text-xs mt-2 ${isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                        {new Date(message.timestamp).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                </div>
            </div>
        </div>
    )
}

function MiniChart({ data, summary, isLight, t }) {
    if (!data || data.length === 0) return null

    const validData = data.filter(d => d.value !== null)
    if (validData.length === 0) return null

    const values = validData.map(d => d.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1

    return (
        <div className="space-y-3">
            <div className={`text-xs font-medium mb-2 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                {t('chat.trendChart')} ({validData.length} {t('chat.dataPoints')})
            </div>

            {/* Simple sparkline */}
            <div className="flex items-end gap-0.5 h-16">
                {validData.slice(0, 50).map((point, index) => {
                    const height = ((point.value - min) / range) * 100
                    return (
                        <div
                            key={index}
                            className="flex-1 bg-primary-500 rounded-t opacity-70 hover:opacity-100 transition"
                            style={{ height: `${Math.max(height, 5)}%` }}
                            title={`${point.value} μg/m³`}
                        />
                    )
                })}
            </div>

            {/* Trend indicator */}
            {summary?.trend && (
                <div className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                    {t('chat.trend')} {
                        summary.trend === 'increasing' ? t('chat.increasing') :
                            summary.trend === 'decreasing' ? t('chat.decreasing') :
                                summary.trend === 'stable' ? t('chat.stable') :
                                    t('chat.insufficient')
                    }
                </div>
            )}
        </div>
    )
}

