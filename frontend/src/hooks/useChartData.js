/**
 * useChartData Hook
 * Fetch chart data with anomalies
 */
import { useState, useCallback } from 'react'
import { aqiService } from '../services/api'

export default function useChartData() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchChartData = useCallback(async (stationId, days = 7) => {
        if (!stationId) return

        try {
            setLoading(true)
            setError(null)
            const result = await aqiService.getChartData(stationId, days)
            setData(result)
        } catch (err) {
            setError(err.message || 'Failed to fetch chart data')
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
