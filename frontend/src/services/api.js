/**
 * API Service
 * Centralized API calls to backend
 */
import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Response interceptor for error handling
api.interceptors.response.use(
    response => response.data,
    error => {
        console.error('API Error:', error.response?.data || error.message)
        throw error
    }
)

// Station endpoints
export const stationService = {
    getAll: (limit = 200) => api.get(`/stations?limit=${limit}`),
    getById: (stationId) => api.get(`/stations/${stationId}`),
    sync: () => api.post('/stations/sync'),
}

// AQI Data endpoints
export const aqiService = {
    getHistory: (stationId, params = {}) =>
        api.get(`/aqi/${stationId}`, { params }),
    getLatest: (stationId) =>
        api.get(`/aqi/${stationId}/latest`),
    getChartData: (stationId, days = 7) =>
        api.get(`/aqi/${stationId}/chart?days=${days}&include_imputed=true`),
    getMissing: (stationId, days = 30) =>
        api.get(`/aqi/${stationId}/missing?days=${days}`),
}

// Ingestion endpoints
export const ingestionService = {
    startBatch: (stationIds, days = 7) =>
        api.post('/ingest/batch', { station_ids: stationIds, days }),
    getStatus: () => api.get('/ingest/status'),
}

// Imputation endpoints
export const imputationService = {
    runImputation: (stationId) =>
        api.post('/impute', { station_id: stationId }),
    runCycle: (stationIds) =>
        api.post('/impute/cycle', { station_ids: stationIds }),
}

// Scheduler endpoints
export const schedulerService = {
    getStatus: () => api.get('/scheduler/status'),
    getJobs: () => api.get('/scheduler/jobs'),
    triggerHourly: () => api.post('/scheduler/trigger/hourly'),
    triggerImputation: () => api.post('/scheduler/trigger/imputation'),
}

// Health check
export const healthService = {
    check: () => axios.get('/health').then(r => r.data),
}

export default api
