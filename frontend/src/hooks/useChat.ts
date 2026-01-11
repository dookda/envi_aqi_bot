/**
 * Custom hook for AI Chat functionality
 * Note: Response text no longer includes emojis - icons are rendered in UI components
 */
import { useState, useCallback } from 'react'
import type { ChatMessage, UseChatReturn } from '@/types'

// Use BASE_URL from Vite config to ensure /ebot/ prefix is included
// Set VITE_API_URL environment variable to override if needed
const API_URL = import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}api`.replace(/\/+/g, '/').replace(/\/$/, '')

interface ChatApiResponse {
  status: string
  message?: string
  data?: any[]
  summary?: any
  intent?: any
  output_type?: string
}

export default function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now(),
      type: 'user',
      text: query,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/chat/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ChatApiResponse = await response.json()

      // Add bot response
      const botMessage: ChatMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: result.message || getResponseText(result),
        timestamp: new Date(),
        data: result.data,
        summary: result.summary,
        intent: result.intent,
        status: result.status,
        output_type: result.output_type
      }

      setMessages(prev => [...prev, botMessage])
    } catch (err) {
      console.error('Chat error:', err)
      setError((err as Error).message)

      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง',
        timestamp: new Date(),
        status: 'error'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages
  }
}

function getResponseText(result: ChatApiResponse): string {
  if (result.status === 'out_of_scope') {
    return result.message || 'ระบบนี้รองรับเฉพาะคำถามเกี่ยวกับคุณภาพอากาศเท่านั้น'
  }

  if (result.status === 'invalid_request') {
    return result.message || 'ไม่สามารถประมวลผลคำขอได้ กรุณาลองใหม่'
  }

  if (result.status === 'error') {
    return result.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
  }

  if (result.status === 'success' && result.summary) {
    const s = result.summary
    let text = `ข้อมูล PM2.5:\n\n`
    text += `• ค่าเฉลี่ย: ${s.mean} μg/m³\n`
    text += `• ค่าสูงสุด: ${s.max} μg/m³\n`
    text += `• ค่าต่ำสุด: ${s.min} μg/m³\n`
    text += `• จุดข้อมูล: ${s.valid_points}/${s.data_points} จุด\n`

    if (s.aqi_level) {
      const levels: Record<string, string> = {
        excellent: 'ดีมาก',
        good: 'ดี',
        moderate: 'ปานกลาง',
        unhealthy_sensitive: 'ไม่ดีต่อกลุ่มเสี่ยง',
        unhealthy: 'ไม่ดี'
      }
      text += `\nระดับคุณภาพอากาศ: ${levels[s.aqi_level] || s.aqi_level}`
    }

    return text
  }

  return 'ได้รับข้อมูลแล้ว'
}
