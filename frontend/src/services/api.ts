/**
 * API Service
 * Centralized API calls to backend using fetch()
 */

import type {
  Station,
  AQIHourlyData,
  ChartDataResponse,
} from '@/types'

// Get base URL from Vite config (uses BASE_URL from vite.config.ts)
const BASE_URL = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, '/').replace(/\/$/, '')
const TIMEOUT = 30000

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>
}

interface ApiResponse<T = any> {
  data?: T
  status: number
  detail?: string
  message?: string
}

interface ApiError extends Error {
  response?: ApiResponse
}

/**
 * Create a fetch wrapper with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = TIMEOUT
): Promise<Response> {
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
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

/**
 * Handle API response
 */
async function handleResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')
  const isJson = contentType?.includes('application/json')

  let data: any
  if (isJson) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    const error = new Error(data.detail || data.message || `HTTP ${response.status}`) as ApiError
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
  get: async <T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> => {
    const { params, ...fetchOptions } = options
    let url = `${BASE_URL}${endpoint}`

    // Add query parameters if provided
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
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

    return handleResponse<T>(response)
  },

  post: async <T = any>(endpoint: string, data: any = null, options: RequestInit = {}): Promise<T> => {
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })

    return handleResponse<T>(response)
  },

  put: async <T = any>(endpoint: string, data: any = null, options: RequestInit = {}): Promise<T> => {
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })

    return handleResponse<T>(response)
  },

  delete: async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    return handleResponse<T>(response)
  },
}

// Station endpoints
export const stationService = {
  getAll: (limit = 200): Promise<Station[]> => api.get<Station[]>(`/stations?limit=${limit}`),
  getById: (stationId: string): Promise<Station> => api.get<Station>(`/stations/${stationId}`),
  sync: (): Promise<{ message: string }> => api.post('/stations/sync'),
}

interface AQIParams {
  start_date?: string
  end_date?: string
  limit?: number
  include_imputed?: boolean
  [key: string]: string | number | boolean | null | undefined
}

// AQI Data endpoints
export const aqiService = {
  getHistory: (stationId: string, params: AQIParams = {}): Promise<AQIHourlyData[]> =>
    api.get<AQIHourlyData[]>(`/aqi/${stationId}`, { params }),
  getLatest: (stationId: string): Promise<AQIHourlyData> =>
    api.get<AQIHourlyData>(`/aqi/${stationId}/latest`),
  getChartData: (stationId: string, days = 7): Promise<ChartDataResponse> =>
    api.get<ChartDataResponse>(`/aqi/${stationId}/chart?days=${days}&include_imputed=true`),
  getMissing: (stationId: string, days = 30): Promise<any> =>
    api.get(`/aqi/${stationId}/missing?days=${days}`),
}

interface BatchIngestionRequest {
  station_ids: string[]
  days: number
}

interface IngestionStatus {
  status: string
  message?: string
}

// Ingestion endpoints
export const ingestionService = {
  startBatch: (stationIds: string[], days = 7): Promise<IngestionStatus> =>
    api.post<IngestionStatus>('/ingest/batch', { station_ids: stationIds, days }),
  getStatus: (): Promise<IngestionStatus> => api.get<IngestionStatus>('/ingest/status'),
}

interface ImputationRequest {
  station_id: string
}

interface CycleRequest {
  station_ids: string[]
}

interface ImputationResponse {
  status: string
  message?: string
}

// Imputation endpoints
export const imputationService = {
  runImputation: (stationId: string): Promise<ImputationResponse> =>
    api.post<ImputationResponse>('/impute', { station_id: stationId }),
  runCycle: (stationIds: string[]): Promise<ImputationResponse> =>
    api.post<ImputationResponse>('/impute/cycle', { station_ids: stationIds }),
}

interface SchedulerStatus {
  status: string
  jobs?: any[]
}

// Scheduler endpoints
export const schedulerService = {
  getStatus: (): Promise<SchedulerStatus> => api.get<SchedulerStatus>('/scheduler/status'),
  getJobs: (): Promise<any[]> => api.get<any[]>('/scheduler/jobs'),
  triggerHourly: (): Promise<{ message: string }> => api.post('/scheduler/trigger/hourly'),
  triggerImputation: (): Promise<{ message: string }> => api.post('/scheduler/trigger/imputation'),
}

interface HealthResponse {
  status: string
  version?: string
}

// Health check
export const healthService = {
  check: (): Promise<HealthResponse> => fetch(`${import.meta.env.BASE_URL}health`).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  }),
}

// AI Service
export const aiService = {
  generateExecutiveSummary: (data: any): Promise<any> => api.post('/ai/executive-summary', data),
}

export default api
