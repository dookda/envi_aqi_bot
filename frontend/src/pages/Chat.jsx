/**
 * Chat Page - AI-powered Air Quality Chatbot
 *
 * Natural language interface for querying air quality data
 * Supports Thai and English queries
 */
import { useState, useRef, useEffect } from 'react'
import { Button, Card } from '../components/atoms'
import { useChat } from '../hooks'

export default function Chat() {
    const { messages, loading, sendMessage, clearMessages } = useChat()
    const [inputText, setInputText] = useState('')
    const messagesEndRef = useRef(null)

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
            {/* Header */}
            <header className="glass border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gradient">
                                🤖 AI Air Quality Assistant
                            </h1>
                            <p className="text-dark-400 text-sm">
                                ถามคำถามเกี่ยวกับคุณภาพอากาศได้เป็นภาษาไทยหรืออังกฤษ
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <a
                                href="/"
                                className="text-dark-400 hover:text-white transition text-sm"
                            >
                                📊 Dashboard
                            </a>
                            <a
                                href="/models"
                                className="text-dark-400 hover:text-white transition text-sm"
                            >
                                🧠 Models
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                {/* Info Card */}
                {messages.length === 0 && (
                    <Card className="mb-6 p-6">
                        <h3 className="text-lg font-semibold mb-4">💬 วิธีใช้งาน</h3>
                        <div className="space-y-3 text-sm text-dark-300 mb-6">
                            <p>• ถามคำถามเกี่ยวกับคุณภาพอากาศเป็นภาษาไทยหรืออังกฤษ</p>
                            <p>• ระบบจะแปลงคำถามเป็นข้อมูลและแสดงผลลัพธ์</p>
                            <p>• รองรับข้อมูล PM2.5, PM10, AQI และมลพิษอื่นๆ</p>
                        </div>

                        <h4 className="font-medium mb-3 text-sm">ตัวอย่างคำถาม:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {exampleQueries.map((query, index) => (
                                <button
                                    key={index}
                                    onClick={() => setInputText(query)}
                                    className="text-left px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700
                                             text-dark-300 text-xs transition border border-dark-600 hover:border-primary-500"
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
                        <div className="flex items-center justify-center h-full text-dark-500">
                            <div className="text-center">
                                <div className="text-6xl mb-4">💬</div>
                                <p>เริ่มต้นสนทนาด้วยการพิมพ์คำถามด้านล่าง</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <ChatMessage key={message.id} message={message} />
                            ))}
                            {loading && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                        🤖
                                    </div>
                                    <div className="flex-1 bg-dark-800 rounded-lg p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
                                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse delay-75"></div>
                                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse delay-150"></div>
                                            <span className="text-dark-400 text-sm ml-2">กำลังประมวลผล...</span>
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
                            placeholder="พิมพ์คำถามของคุณที่นี่... (เช่น ขอดูค่า PM2.5 ย้อนหลัง 7 วันของสถานีเชียงใหม่)"
                            className="flex-1 px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg
                                     text-white placeholder-dark-500 focus:outline-none focus:border-primary-500
                                     transition"
                            maxLength={300}
                            disabled={loading}
                        />
                        <Button
                            type="submit"
                            loading={loading}
                            disabled={!inputText.trim() || loading}
                        >
                            ส่ง
                        </Button>
                        {messages.length > 0 && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={clearMessages}
                                disabled={loading}
                            >
                                ล้าง
                            </Button>
                        )}
                    </form>
                    <p className="text-xs text-dark-500 mt-2">
                        ความยาวสูงสุด: {inputText.length}/300 ตัวอักษร
                    </p>
                </Card>
            </main>
        </div>
    )
}

function ChatMessage({ message }) {
    const isUser = message.type === 'user'

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isUser ? 'bg-success-500' : 'bg-primary-500'
            }`}>
                {isUser ? '👤' : '🤖'}
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-lg p-4 ${
                    isUser
                        ? 'bg-success-900/30 border border-success-700/50'
                        : message.status === 'error' || message.status === 'out_of_scope'
                        ? 'bg-danger-900/30 border border-danger-700/50'
                        : 'bg-dark-800 border border-dark-600'
                }`}>
                    {/* Text */}
                    <p className="text-white whitespace-pre-wrap text-sm leading-relaxed">
                        {message.text}
                    </p>

                    {/* Data visualization for successful queries */}
                    {message.status === 'success' && message.data && (
                        <div className="mt-4 pt-4 border-t border-dark-700">
                            <MiniChart data={message.data} summary={message.summary} />
                        </div>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-dark-500 mt-2">
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

function MiniChart({ data, summary }) {
    if (!data || data.length === 0) return null

    const validData = data.filter(d => d.value !== null)
    if (validData.length === 0) return null

    const values = validData.map(d => d.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1

    return (
        <div className="space-y-3">
            <div className="text-xs font-medium text-dark-400 mb-2">
                📈 กราฟแนวโน้ม ({validData.length} จุดข้อมูล)
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
                <div className="text-xs text-dark-400">
                    แนวโน้ม: {
                        summary.trend === 'increasing' ? '📈 เพิ่มขึ้น' :
                        summary.trend === 'decreasing' ? '📉 ลดลง' :
                        summary.trend === 'stable' ? '➡️ คงที่' :
                        '❓ ไม่เพียงพอ'
                    }
                </div>
            )}
        </div>
    )
}
