/**
 * API Service
 * Centralized API calls to backend using fetch()
 */

const BASE_URL = '/api'
const TIMEOUT = 30000

/**
 * Create a fetch wrapper with timeout support
 */
async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
            throw new Error('Request timeout')
        }
        throw error
    }
}

/**
 * Handle API response
 */
async function handleResponse(response) {
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    let data
    if (isJson) {
        data = await response.json()
    } else {
        data = await response.text()
    }

    if (!response.ok) {
        const error = new Error(data.detail || data.message || `HTTP ${response.status}`)
        error.response = { data, status: response.status }
        console.error('API Error:', data || error.message)
        throw error
    }

    return data
}

/**
 * Create API client with methods similar to axios
 */
const api = {
    get: async (endpoint, options = {}) => {
        const { params, ...fetchOptions } = options
        let url = `${BASE_URL}${endpoint}`

        // Add query parameters if provided
        if (params) {
            const searchParams = new URLSearchParams()
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, value)
                }
            })
            const queryString = searchParams.toString()
            if (queryString) {
                url += `?${queryString}`
            }
        }

        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...fetchOptions.headers,
            },
            ...fetchOptions,
        })

        return handleResponse(response)
    },

    post: async (endpoint, data = null, options = {}) => {
        const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
            ...options,
        })

        return handleResponse(response)
    },

    put: async (endpoint, data = null, options = {}) => {
        const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
            ...options,
        })

        return handleResponse(response)
    },

    delete: async (endpoint, options = {}) => {
        const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        })

        return handleResponse(response)
    },
}

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
    check: () => fetch('/health').then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
    }),
}

export default api
