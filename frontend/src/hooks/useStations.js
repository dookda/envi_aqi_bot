/**
 * useStations Hook
 * Fetch and manage station data
 */
import { useState, useEffect, useCallback } from 'react'
import { stationService } from '../services/api'

export default function useStations() {
    const [stations, setStations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchStations = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await stationService.getAll()
            setStations(data)
        } catch (err) {
            setError(err.message || 'Failed to fetch stations')
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
            setError(err.message || 'Failed to sync stations')
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
