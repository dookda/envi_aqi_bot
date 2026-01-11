/**
 * useChartData Hook
 * Fetch chart data with anomalies
 */
import { useState, useCallback } from 'react'
import type { ChartDataResponse, UseChartDataReturn } from '@/types'
import { aqiService } from '../services/api'

export default function useChartData(): UseChartDataReturn {
  const [data, setData] = useState<ChartDataResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchChartData = useCallback(async (stationId: string, days = 7) => {
    if (!stationId) return

    try {
      setLoading(true)
      setError(null)
      const result = await aqiService.getChartData(stationId, days)
      setData(result)
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch chart data')
      console.error('Error fetching chart data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearData = useCallback(() => {
    setData(null)
  }, [])

  return {
    data,
    loading,
    error,
    fetchChartData,
    clearData,
  }
}
