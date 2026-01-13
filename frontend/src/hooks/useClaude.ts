/**
 * Custom hook for Claude AI Chat functionality
 * Uses Anthropic Claude API for faster inference compared to Ollama
 */
import { useState, useCallback } from 'react'
import type { ChatMessage, UseClaudeReturn } from '@/types'

// Use BASE_URL from Vite config to ensure /ebot/ prefix is included
const API_URL = import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}api`.replace(/\/+/g, '/').replace(/\/$/, '')

interface ClaudeApiResponse {
  status: string
  message?: string
  data?: any[]
  summary?: any
  intent?: any
  output_type?: string
  llm_provider?: string
  response_time_ms?: number
}

export default function useClaude(): UseClaudeReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResponseTime, setLastResponseTime] = useState<number | null>(null)

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
      const startTime = Date.now()

      const response = await fetch(`${API_URL}/chat/claude/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ClaudeApiResponse = await response.json()
      const clientTime = Date.now() - startTime

      // Use server-reported time if available, otherwise client time
      const responseTimeMs = result.response_time_ms || clientTime
      setLastResponseTime(responseTimeMs)

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
        output_type: result.output_type,
        llm_provider: result.llm_provider || 'claude',
        response_time_ms: responseTimeMs
      }

      setMessages(prev => [...prev, botMessage])
    } catch (err) {
      console.error('Claude error:', err)
      setError((err as Error).message)

      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: 'ขออภัย Model B ไม่สามารถประมวลผลได้ กรุณาตรวจสอบ ANTHROPIC_API_KEY',
        timestamp: new Date(),
        status: 'error',
        llm_provider: 'claude'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    setLastResponseTime(null)
  }, [])

  return {
    messages,
    loading,
    error,
    lastResponseTime,
    sendMessage,
    clearMessages
  }
}

function getResponseText(result: ClaudeApiResponse): string {
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
    let text = `🧠 Model B Response (${result.response_time_ms}ms)\n\n`
    text += `ข้อมูล PM2.5:\n\n`
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
