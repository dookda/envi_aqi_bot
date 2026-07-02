/**
 * Shared AQI utilities — single source of truth for the Thai AQI index math
 * and severity-level presentation used across Dashboard, StationMap, and
 * Executive Summary. Previously each surface had its own copy with slightly
 * different thresholds, so pages could disagree about the same reading.
 */

export type AQILevelKey = 'excellent' | 'good' | 'moderate' | 'unhealthySensitive' | 'unhealthy'

export interface AQILevelConfig {
    min: number
    max: number
    color: string
    label: string
    labelTh: string
    icon: string
}

// AQI Level configuration (Thailand Standard - ดัชนี AQI ประเทศไทย)
export const AQI_LEVELS: Record<AQILevelKey, AQILevelConfig> = {
    excellent: { min: 0, max: 25, color: '#00bcd4', label: 'Excellent', labelTh: 'ดีมาก', icon: 'sentiment_very_satisfied' },
    good: { min: 26, max: 50, color: '#4caf50', label: 'Good', labelTh: 'ดี', icon: 'sentiment_satisfied' },
    moderate: { min: 51, max: 100, color: '#ffeb3b', label: 'Moderate', labelTh: 'ปานกลาง', icon: 'sentiment_neutral' },
    unhealthySensitive: { min: 101, max: 200, color: '#ff9800', label: 'Unhealthy', labelTh: 'เริ่มมีผลกระทบ', icon: 'sentiment_dissatisfied' },
    unhealthy: { min: 201, max: 500, color: '#f44336', label: 'Hazardous', labelTh: 'มีผลกระทบ', icon: 'sentiment_very_dissatisfied' },
}

/**
 * Convert a PM2.5 concentration (µg/m³) to the Thai AQI index.
 * Breakpoints per Thailand PCD: 25 / 37 / 50 / 90 µg/m³ map to AQI 25 / 50 / 100 / 200.
 */
export const pm25ToAqi = (pm25: number | null | undefined): number => {
    if (!pm25 || pm25 <= 0) return 0
    if (pm25 <= 25) return Math.round((pm25 / 25) * 25)
    if (pm25 <= 37) return Math.round(25 + ((pm25 - 25) / 12) * 25)
    if (pm25 <= 50) return Math.round(50 + ((pm25 - 37) / 13) * 50)
    if (pm25 <= 90) return Math.round(100 + ((pm25 - 50) / 40) * 100)
    return Math.round(200 + ((pm25 - 90) / 90) * 100)
}

/** Band a Thai AQI index value into a severity level. */
export const getAqiLevel = (aqi: number | null | undefined): AQILevelKey | null => {
    if (!aqi || aqi <= 0) return null
    if (aqi <= 25) return 'excellent'
    if (aqi <= 50) return 'good'
    if (aqi <= 100) return 'moderate'
    if (aqi <= 200) return 'unhealthySensitive'
    return 'unhealthy'
}

/** Severity level straight from a PM2.5 concentration (converts to AQI first). */
export const getAqiLevelFromPm25 = (pm25: number | null | undefined): AQILevelKey | null =>
    getAqiLevel(pm25ToAqi(pm25))

/** Marker/badge color for a PM2.5 concentration; gray when there is no data. */
export const getAqiColorFromPm25 = (pm25: number | null | undefined): string => {
    const level = getAqiLevelFromPm25(pm25)
    return level ? AQI_LEVELS[level].color : '#64748b'
}
