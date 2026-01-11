/**
 * useStations Hook
 * Fetch and manage station data
 */
import { useState, useEffect, useCallback } from 'react'
import type { Station, UseStationsReturn } from '@/types'
import { stationService } from '../services/api'

export default function useStations(): UseStationsReturn {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await stationService.getAll()
      setStations(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch stations')
      console.error('Error fetching stations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const syncStations = useCallback(async () => {
    try {
      await stationService.sync()
      // Refetch after sync
      await fetchStations()
    } catch (err) {
      setError((err as Error).message || 'Failed to sync stations')
    }
  }, [fetchStations])

  useEffect(() => {
    fetchStations()
  }, [fetchStations])

  return {
    stations,
    loading,
    error,
    refetch: fetchStations,
    sync: syncStations,
  }
}
