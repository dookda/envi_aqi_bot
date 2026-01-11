/**
 * Shared TypeScript type definitions for the AQI frontend application
 */

// ============== Station Types ==============

export interface Station {
  station_id: string
  name_th?: string
  name_en?: string
  lat?: number
  lon?: number
  station_type?: string
  created_at?: string
  updated_at?: string
}

export interface StationWithStats extends Station {
  total_records: number
  missing_records: number
  imputed_records: number
  missing_percentage: number
}

// ============== AQI Data Types ==============

export interface AQIHourlyData {
  station_id: string
  datetime: string
  // Pollutants
  pm25?: number
  pm10?: number
  o3?: number
  co?: number
  no2?: number
  so2?: number
  // Weather/Meteorological Data
  ws?: number
  wd?: number
  temp?: number
  rh?: number
  bp?: number
  rain?: number
  // Imputation flags
  is_imputed: boolean
  pm25_imputed?: boolean
  pm10_imputed?: boolean
  o3_imputed?: boolean
  co_imputed?: boolean
  no2_imputed?: boolean
  so2_imputed?: boolean
  ws_imputed?: boolean
  wd_imputed?: boolean
  temp_imputed?: boolean
  rh_imputed?: boolean
  bp_imputed?: boolean
  rain_imputed?: boolean
  // Metadata
  model_version?: string
  created_at?: string
}

export interface ParameterStatistics {
  min: number
  max: number
  avg: number
  valid_count: number
  null_count: number
}

export interface ChartDataResponse {
  station_id: string
  station_name: string
  data_type?: string
  source?: string
  period: {
    start: string
    end: string
  }
  data: AQIHourlyData[]
  statistics?: Record<string, ParameterStatistics>
  total_records?: number
  message?: string
}

export interface ChartStatistics {
  mean: number
  median?: number
  max: number
  min: number
  std_dev?: number
  completeness?: number
}

// ============== Chat Message Types ==============

export interface ChatMessage {
  id: number
  type: 'user' | 'bot'
  text: string
  timestamp: Date
  data?: any
  summary?: any
  intent?: any
  status?: string
  output_type?: string
  llm_provider?: string
  response_time_ms?: number
}

export interface ChatIntent {
  intent_type?: string
  search_query?: string
  station_id?: string
  pollutant?: string
  start_date?: string
  end_date?: string
  interval?: string
  output_type?: string
}

export interface ChatResponse {
  status: string
  message?: string
  intent?: ChatIntent
  data?: any[]
  summary?: any
  output_type?: string
}

// ============== Component Common Types ==============

export type Variant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark'
  | 'ghost'

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export type Theme = 'light' | 'dark'

export type Language = 'en' | 'th'

export type AQILevel =
  | 'excellent'
  | 'good'
  | 'moderate'
  | 'unhealthySensitive'
  | 'unhealthy'

// ============== Table Types ==============

export interface TableColumn<T = any> {
  header: React.ReactNode
  accessor: string
  align?: 'left' | 'center' | 'right'
  render?: (row: T) => React.ReactNode
  sortable?: boolean
}

// ============== Select Types ==============

export interface SelectOption {
  value: string
  label: string
}

// ============== Context Types ==============

export interface ThemeContextType {
  theme: Theme
  isDark: boolean
  isLight: boolean
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

export interface LanguageContextType {
  lang: Language
  language: Language
  t: (key: string) => string
  toggleLanguage: () => void
  setLanguage: (lang: Language) => void
}

export interface Toast {
  id: number
  message: string
  variant: Variant
  duration?: number
}

export interface ToastContextType {
  toasts: Toast[]
  toast: {
    show: (message: string, variant?: Variant, duration?: number) => void
    success: (message: string, duration?: number) => void
    error: (message: string, duration?: number) => void
    warning: (message: string, duration?: number) => void
    info: (message: string, duration?: number) => void
    dismiss: (id: number) => void
    clear: () => void
  }
}

// ============== Hook Return Types ==============

export interface UseStationsReturn {
  stations: Station[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  sync: () => Promise<void>
}

export interface UseChartDataReturn {
  data: ChartDataResponse | null
  loading: boolean
  error: string | null
  fetchChartData: (stationId: string, days?: number) => Promise<void>
  clearData: () => void
}

export interface UseChatReturn {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  sendMessage: (query: string) => Promise<void>
  clearMessages: () => void
}

export interface UseClaudeReturn extends UseChatReturn {
  lastResponseTime: number | null
}

// ============== Model Training Types ==============

export interface ModelInfo {
  station_id: string
  model_version: string
  training_samples: number
  validation_samples: number
  train_rmse: number
  val_rmse: number
  train_mae: number
  val_mae: number
  train_r2?: number
  val_r2?: number
  epochs_completed: number
  training_duration_seconds: number
  created_at: string
}

export interface ModelStatus {
  station_id: string
  model_exists: boolean
  model_version?: string
  last_trained?: string
  performance_metrics?: {
    rmse: number
    mae: number
    r2?: number
  }
}

// ============== Map Types ==============

export interface MapMarker {
  station_id: string
  position: [number, number]
  name: string
  pm25?: number
  isAnomaly?: boolean
}

// ============== Parameter Configuration ==============

export interface ParameterConfig {
  label: string
  unit: string
  color: string
  icon: string
  gradient?: string
}

export type ParameterKey =
  | 'pm25'
  | 'pm10'
  | 'o3'
  | 'co'
  | 'no2'
  | 'so2'
  | 'temp'
  | 'rh'
  | 'ws'
  | 'wd'
  | 'bp'
  | 'rain'
