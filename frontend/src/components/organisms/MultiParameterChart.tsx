/**
 * MultiParameterChart Organism
 * Select any air quality parameter to display with gap-fill and spike indicators
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import * as echarts from 'echarts'
import { Card, Spinner, Icon } from '../atoms'
import { useLanguage, useTheme } from '../../contexts'
import type { AQIHourlyData, ChartDataResponse, ParameterKey, ParameterConfig } from '@/types'

/**
 * Thai month abbreviations
 */
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/**
 * Format date to dd-MM-yyyy HH:mm (24hr format)
 * Uses Thai Buddhist Era (+543 years) and Thai month names when lang is 'th'
 */
const formatDateTime = (date: Date | string, lang: 'th' | 'en' = 'en'): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const day = d.getDate().toString().padStart(2, '0')
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')

    if (lang === 'th') {
        const thaiMonth = THAI_MONTHS[d.getMonth()]
        const thaiYear = d.getFullYear() + 543
        return `${day} ${thaiMonth} ${thaiYear} ${hours}:${minutes}`
    }

    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year} ${hours}:${minutes}`
}

// Parameter configurations
const PARAMETERS: Record<ParameterKey, ParameterConfig> = {
    pm25: { label: 'PM2.5', unit: 'µg/m³', color: '#3b82f6', icon: 'blur_on' },
    pm10: { label: 'PM10', unit: 'µg/m³', color: '#8b5cf6', icon: 'grain' },
    o3: { label: 'O₃ (Ozone)', unit: 'ppb', color: '#10b981', icon: 'cloud' },
    co: { label: 'CO', unit: 'ppm', color: '#f59e0b', icon: 'local_fire_department' },
    no2: { label: 'NO₂', unit: 'ppb', color: '#ef4444', icon: 'factory' },
    so2: { label: 'SO₂', unit: 'ppb', color: '#ec4899', icon: 'volcano' },
    nox: { label: 'NOₓ', unit: 'ppb', color: '#f97316', icon: 'air_purifier' },
    temp: { label: 'Temperature', unit: '°C', color: '#f97316', icon: 'thermostat' },
    rh: { label: 'Humidity', unit: '%', color: '#0ea5e9', icon: 'water_drop' },
    ws: { label: 'Wind Speed', unit: 'm/s', color: '#06b6d4', icon: 'air' },
    wd: { label: 'Wind Direction', unit: '°', color: '#14b8a6', icon: 'explore' },
    bp: { label: 'Pressure', unit: 'mmHg', color: '#6366f1', icon: 'speed' },
    rain: { label: 'Rainfall', unit: 'mm', color: '#22c55e', icon: 'rainy' },
}

// Spike detection thresholds (for anomaly highlighting)
const SPIKE_THRESHOLDS: Record<string, { min: number; max: number; spikeMultiplier: number }> = {
    pm25: { min: 0, max: 200, spikeMultiplier: 2.5 },
    pm10: { min: 0, max: 300, spikeMultiplier: 2.5 },
    o3: { min: 0, max: 200, spikeMultiplier: 2.5 },
    co: { min: 0, max: 15, spikeMultiplier: 2.5 },
    no2: { min: 0, max: 300, spikeMultiplier: 3 },
    so2: { min: 0, max: 400, spikeMultiplier: 3 },
    nox: { min: 0, max: 600, spikeMultiplier: 3 },
    temp: { min: -10, max: 50, spikeMultiplier: 1.5 },
    rh: { min: 0, max: 100, spikeMultiplier: 1.3 },
    ws: { min: 0, max: 30, spikeMultiplier: 3 },
    bp: { min: 700, max: 800, spikeMultiplier: 1.2 },
}

const API_BASE = '/api'

interface MultiParameterChartProps {
    stationId?: string
    timePeriod?: number
    height?: number
    className?: string
    selectedParam?: ParameterKey
    onParamChange?: (param: ParameterKey) => void
    externalData?: ChartDataResponse | null
    loading?: boolean
    onSettingsClick?: () => void
    spikeMultiplier?: number  // Default: 5 (spike = value >= prevValue * multiplier)
    negativeThreshold?: number  // Threshold below which values are considered invalid negative
    consecutiveEqualThreshold?: number  // Default: 3 (detect X consecutive equal values)
}

interface SpikeData {
    value: [string, number]
    itemStyle: {
        color: string
        borderColor: string
        borderWidth: number
    }
    spike: {
        value: number
        prevValue: number
        multiplier: number
    }
}

interface NegativeData {
    value: [string, number]
    itemStyle: {
        color: string
        borderColor: string
        borderWidth: number
    }
    negative: {
        value: number
    }
}

interface ConsecutiveEqualData {
    value: [string, number]
    itemStyle: {
        color: string
        borderColor: string
        borderWidth: number
    }
    consecutive: {
        value: number
        count: number
    }
}

interface ChartStats {
    mean: number
    stdDev: number
    completeness: number
    imputedCount: number
    missingCount: number
    anomalyCount: number
    negativeCount: number
    consecutiveEqualCount: number
    totalPoints: number
}

interface ProcessedChartData {
    originalData: Array<[string, number | null]>
    imputedData: Array<[string, number | null]>
    spikeData: SpikeData[]
    negativeData: NegativeData[]
    consecutiveEqualData: ConsecutiveEqualData[]
    gapAreas: Array<[{ xAxis: string; itemStyle?: { color: string } }, { xAxis: string }]>
    stats: ChartStats
}

const MultiParameterChart: React.FC<MultiParameterChartProps> = ({
    stationId,
    timePeriod = 7,
    height = 450,
    className = '',
    selectedParam: externalSelectedParam,
    onParamChange,
    externalData = null,
    loading: externalLoading = false,
    onSettingsClick,
    spikeMultiplier = 5,  // Default: spike if value >= 5x previous value
    negativeThreshold = -3,  // Default: values below -3 are considered invalid
    consecutiveEqualThreshold = 3,  // Default: detect 3+ consecutive equal values
}) => {
    const { lang } = useLanguage()
    const { isLight } = useTheme()
    const chartRef = useRef<HTMLDivElement | null>(null)
    const chartInstance = useRef<echarts.ECharts | null>(null)

    const [internalSelectedParam, setInternalSelectedParam] = useState<ParameterKey>('pm25')
    const [internalData, setInternalData] = useState<ChartDataResponse | null>(null)
    const [internalLoading, setInternalLoading] = useState<boolean>(false)
    const [showGapFill, setShowGapFill] = useState<boolean>(true)
    const [showSpikes, setShowSpikes] = useState<boolean>(true)
    const [showNegative, setShowNegative] = useState<boolean>(true)
    const [showConsecutiveEqual, setShowConsecutiveEqual] = useState<boolean>(true)

    // Use external state if provided, otherwise internal
    const selectedParam = externalSelectedParam || internalSelectedParam
    const setSelectedParam = (param: ParameterKey) => {
        if (onParamChange) {
            onParamChange(param)
        } else {
            setInternalSelectedParam(param)
        }
    }

    const data = externalData || internalData
    const loading = externalLoading || internalLoading

    // Fetch data for selected parameter (only if external data is not provided)
    const fetchData = useCallback(async () => {
        if (!stationId || externalData) return

        setInternalLoading(true)
        try {
            const endDate = new Date().toISOString()
            const startDate = new Date(Date.now() - timePeriod * 24 * 60 * 60 * 1000).toISOString()
            const response = await fetch(
                `${API_BASE}/aqi/full/${stationId}?start=${startDate}&end=${endDate}&limit=720`
            )
            if (response.ok) {
                const result = await response.json()
                setInternalData(result)
            }
        } catch (err) {
            console.error('Failed to fetch chart data:', err)
        } finally {
            setInternalLoading(false)
        }
    }, [stationId, timePeriod, externalData])

    useEffect(() => {
        if (!externalData) {
            fetchData()
        }
    }, [fetchData, externalData])

    // Process data for chart
    const chartData = useMemo((): ProcessedChartData | null => {
        if (!data?.data?.length) return null

        const paramConfig = PARAMETERS[selectedParam]
        const thresholds = SPIKE_THRESHOLDS[selectedParam] || SPIKE_THRESHOLDS.pm25
        const imputedField = `${selectedParam}_imputed` as keyof AQIHourlyData

        // Sort by datetime
        const sortedData = [...data.data].sort((a, b) =>
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )

        // Calculate statistics for the selected parameter
        const allValues = sortedData.map(d => d[selectedParam as keyof AQIHourlyData] as number | undefined)
        const validValues = allValues.filter((v): v is number => v !== null && v !== undefined)
        const imputedCount = sortedData.filter(d => d[imputedField] || d.is_imputed).length
        const missingCount = allValues.filter(v => v === null || v === undefined).length
        const totalPoints = sortedData.length
        const completeness = totalPoints > 0 ? ((totalPoints - missingCount) / totalPoints * 100) : 0

        // Calculate mean and stdDev for spike detection
        const mean = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0
        const stdDev = validValues.length > 0
            ? Math.sqrt(validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / validValues.length)
            : 0

        // Process each data point
        const originalData: Array<[string, number | null]> = []
        const imputedData: Array<[string, number | null]> = []
        const spikeData: SpikeData[] = []
        const negativeData: NegativeData[] = []
        const consecutiveEqualData: ConsecutiveEqualData[] = []
        const gapAreas: Array<[{ xAxis: string; itemStyle?: { color: string } }, { xAxis: string }]> = []

        let gapStart: string | null = null
        let prevValue: number | null = null  // Track previous value for spike detection
        let consecutiveCount = 1  // Track consecutive equal values
        let consecutiveValue: number | null = null  // Track the value being repeated
        const consecutivePoints: Array<{ time: string; value: number }> = []  // Track points in current sequence

        sortedData.forEach((d, index) => {
            const time = d.datetime
            const value = d[selectedParam as keyof AQIHourlyData] as number | null | undefined
            const isImputed = (d[imputedField] as boolean) || d.is_imputed || false

            // Detect gaps (null values)
            if (value === null || value === undefined) {
                if (!gapStart) gapStart = time
                // Reset consecutive tracking on gap
                if (consecutiveCount >= consecutiveEqualThreshold && consecutiveValue !== null) {
                    // Mark all points in the sequence as consecutive equal
                    consecutivePoints.forEach(pt => {
                        consecutiveEqualData.push({
                            value: [pt.time, pt.value],
                            itemStyle: {
                                color: '#8b5cf6',  // Purple color (distinct from Gap-Fill amber)
                                borderColor: '#fff',
                                borderWidth: 2,
                            },
                            consecutive: {
                                value: pt.value,
                                count: consecutiveCount,
                            }
                        })
                    })
                }
                consecutiveCount = 1
                consecutiveValue = null
                consecutivePoints.length = 0
            } else {
                if (gapStart) {
                    gapAreas.push([{ xAxis: gapStart }, { xAxis: time }])
                    gapStart = null
                }

                // Check for spike: value >= X times the previous value
                // Only detect spike if we have a valid previous value > 0
                const isSpike = prevValue !== null && prevValue > 0 && value >= prevValue * spikeMultiplier

                // Check for negative value using threshold from settings
                const isNegative = value < negativeThreshold

                // Track consecutive equal values
                if (consecutiveValue !== null && value === consecutiveValue) {
                    consecutiveCount++
                    consecutivePoints.push({ time, value })
                } else {
                    // Value changed - check if previous sequence met threshold
                    if (consecutiveCount >= consecutiveEqualThreshold && consecutiveValue !== null) {
                        consecutivePoints.forEach(pt => {
                            consecutiveEqualData.push({
                                value: [pt.time, pt.value],
                                itemStyle: {
                                    color: '#8b5cf6',  // Purple color (distinct from Gap-Fill amber)
                                    borderColor: '#fff',
                                    borderWidth: 2,
                                },
                                consecutive: {
                                    value: pt.value,
                                    count: consecutiveCount,
                                }
                            })
                        })
                    }
                    // Start new sequence
                    consecutiveCount = 1
                    consecutiveValue = value
                    consecutivePoints.length = 0
                    consecutivePoints.push({ time, value })
                }

                if (isImputed) {
                    imputedData.push([time, value])
                    // Also add to original for continuity
                    originalData.push([time, null])
                } else {
                    originalData.push([time, value])
                    imputedData.push([time, null])
                }

                if (isSpike && prevValue !== null) {
                    spikeData.push({
                        value: [time, value],
                        itemStyle: {
                            color: '#ef4444',
                            borderColor: '#fff',
                            borderWidth: 2,
                        },
                        spike: {
                            value,
                            prevValue,
                            multiplier: spikeMultiplier,
                        }
                    })
                }

                if (isNegative) {
                    negativeData.push({
                        value: [time, value],
                        itemStyle: {
                            color: '#06b6d4',
                            borderColor: '#fff',
                            borderWidth: 2,
                        },
                        negative: {
                            value,
                        }
                    })
                }

                // Update previous value for next iteration
                prevValue = value
            }
        })

        // Check final sequence after loop ends
        if (consecutiveCount >= consecutiveEqualThreshold && consecutiveValue !== null) {
            consecutivePoints.forEach(pt => {
                consecutiveEqualData.push({
                    value: [pt.time, pt.value],
                    itemStyle: {
                        color: '#8b5cf6',  // Purple color (distinct from Gap-Fill amber)
                        borderColor: '#fff',
                        borderWidth: 2,
                    },
                    consecutive: {
                        value: pt.value,
                        count: consecutiveCount,
                    }
                })
            })
        }

        return {
            originalData,
            imputedData,
            spikeData,
            negativeData,
            consecutiveEqualData,
            gapAreas,
            stats: {
                mean,
                stdDev,
                completeness,
                imputedCount,
                missingCount,
                anomalyCount: spikeData.length,
                negativeCount: negativeData.length,
                consecutiveEqualCount: consecutiveEqualData.length,
                totalPoints
            }
        }
    }, [data, selectedParam, spikeMultiplier, negativeThreshold, consecutiveEqualThreshold])

    // Initialize and update chart
    useEffect(() => {
        if (!chartRef.current || !chartData) return

        const paramConfig = PARAMETERS[selectedParam]
        const theme = isLight ? null : 'dark'

        if (!chartInstance.current) {
            chartInstance.current = echarts.init(chartRef.current, theme)
        }

        const series: any[] = [
            {
                name: lang === 'th' ? 'ข้อมูลจริง' : 'Original Data',
                type: 'line',
                data: chartData.originalData,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                lineStyle: { color: paramConfig.color, width: 2 },
                itemStyle: { color: paramConfig.color },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: `${paramConfig.color}40` },
                        { offset: 1, color: `${paramConfig.color}05` },
                    ]),
                },
                connectNulls: false,
                markArea: showGapFill ? {
                    silent: true,
                    data: chartData.gapAreas.map(area => [
                        { xAxis: area[0].xAxis, itemStyle: { color: 'rgba(239, 68, 68, 0.1)' } },
                        { xAxis: area[1].xAxis },
                    ])
                } : undefined,
                z: 1,
            },
        ]

        // Add gap-fill (imputed) series - show only markers, no connecting line
        if (showGapFill) {
            series.push({
                name: lang === 'th' ? 'Gap-Fill (LSTM)' : 'Gap-Fill (LSTM)',
                type: 'scatter',  // Changed from 'line' to 'scatter' to show only points
                data: chartData.imputedData.filter(d => d[1] !== null),  // Only show non-null values
                symbol: 'diamond',
                symbolSize: 10,
                itemStyle: { color: '#f59e0b', borderColor: '#fbbf24', borderWidth: 2 },
                z: 10,
            })
        }

        // Add spike/anomaly series
        if (showSpikes && chartData.spikeData.length > 0) {
            series.push({
                name: 'Spike',
                type: 'scatter',
                data: chartData.spikeData,
                symbol: 'triangle',
                symbolSize: 16,
                z: 20,
                itemStyle: {
                    color: '#ef4444'
                },
                emphasis: {
                    scale: 1.5,
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(239, 68, 68, 0.5)',
                    },
                },
            })
        }

        // Add negative value series
        if (showNegative && chartData.negativeData.length > 0) {
            series.push({
                name: lang === 'th' ? 'ค่าติดลบ' : 'Negative',
                type: 'scatter',
                data: chartData.negativeData,
                symbol: 'circle',
                symbolSize: 14,
                z: 20,
                itemStyle: {
                    color: '#06b6d4'
                },
                emphasis: {
                    scale: 1.5,
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(6, 182, 212, 0.5)',
                    },
                },
            })
        }

        // Add consecutive equal values series
        if (showConsecutiveEqual && chartData.consecutiveEqualData.length > 0) {
            series.push({
                name: lang === 'th' ? 'ค่าคงที่ซ้ำ' : 'Stuck Values',
                type: 'scatter',
                data: chartData.consecutiveEqualData,
                symbol: 'rect',
                symbolSize: 12,
                z: 15,
                itemStyle: {
                    color: '#8b5cf6'
                },
                emphasis: {
                    scale: 1.5,
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(139, 92, 246, 0.5)',
                    },
                },
            })
        }

        const legendData = [lang === 'th' ? 'ข้อมูลจริง' : 'Original Data']
        if (showGapFill) legendData.push('Gap-Fill (LSTM)')
        if (showSpikes && chartData.spikeData.length > 0) {
            legendData.push('Spike')
        }
        if (showNegative && chartData.negativeData.length > 0) {
            legendData.push(lang === 'th' ? 'ค่าติดลบ' : 'Negative')
        }
        if (showConsecutiveEqual && chartData.consecutiveEqualData.length > 0) {
            legendData.push(lang === 'th' ? 'ค่าคงที่ซ้ำ' : 'Stuck Values')
        }

        const textColor = isLight ? '#374151' : '#f1f5f9'
        const subTextColor = isLight ? '#6b7280' : '#94a3b8'
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)'

        const option: echarts.EChartsOption = {
            backgroundColor: 'transparent',
            title: {
                text: `${paramConfig.label} ${lang === 'th' ? 'กราฟแบบอนุกรมเวลา' : 'Time Series'}`,
                subtext: stationId ? `Station: ${stationId}` : '',
                left: 'center',
                textStyle: { color: textColor, fontSize: 16, fontWeight: 600 },
                subtextStyle: { color: subTextColor },
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                borderColor: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                textStyle: { color: textColor },
                formatter: (params: any) => {
                    if (!params?.length) return ''
                    const date = formatDateTime(params[0].axisValue, lang)
                    let content = `<strong>${date}</strong><br/>`

                    params.forEach((param: any) => {
                        if (param.value?.[1] !== null && param.value?.[1] !== undefined) {
                            const isSpike = param.seriesName.includes('Spike') || param.seriesName.includes('ผิดปกติ')
                            const isNegative = param.seriesName.includes('Negative') || param.seriesName.includes('ค่าติดลบ')
                            const isConsecutive = param.seriesName.includes('Stuck') || param.seriesName.includes('ค่าคงที่ซ้ำ')
                            const isGapFill = param.seriesName.includes('Gap-Fill')

                            if (isSpike && param.data.spike) {
                                content += `<span style="color:#ef4444">⚠ Spike Detected (${param.data.spike.multiplier}x)</span><br/>`
                                content += `Value: <strong>${param.value[1].toFixed(2)} ${paramConfig.unit}</strong><br/>`
                                content += `<span style="color:${subTextColor}">Previous: ${param.data.spike.prevValue.toFixed(2)} ${paramConfig.unit}</span><br/>`
                            } else if (isNegative && param.data.negative) {
                                content += `<span style="color:#06b6d4">⚠ Negative Value</span><br/>`
                                content += `Value: <strong>${param.value[1].toFixed(2)} ${paramConfig.unit}</strong><br/>`
                            } else if (isConsecutive && param.data.consecutive) {
                                content += `<span style="color:#8b5cf6">⚠ Stuck Value (${param.data.consecutive.count}x repeated)</span><br/>`
                                content += `Value: <strong>${param.value[1].toFixed(2)} ${paramConfig.unit}</strong><br/>`
                            } else {
                                const icon = isGapFill ? '◆' : '●'
                                const color = isGapFill ? '#f59e0b' : paramConfig.color
                                content += `<span style="color:${color}">${icon}</span> `
                                content += `${param.seriesName}: <strong>${param.value[1].toFixed(2)} ${paramConfig.unit}</strong>`
                                if (isGapFill) content += ` <span style="color:#f59e0b">(imputed)</span>`
                                content += '<br/>'
                            }
                        }
                    })
                    return content
                },
            },
            legend: {
                data: legendData,
                top: 40,
                right: 20,
                textStyle: { color: subTextColor },
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '18%',
                top: '18%',
                containLabel: true,
            },
            xAxis: {
                type: 'time',
                axisLine: { lineStyle: { color: gridColor } },
                axisLabel: {
                    color: subTextColor,
                    formatter: (value: any) => {
                        const d = new Date(value)
                        return `${d.getMonth() + 1}/${d.getDate()}\n${d.getHours()}:00`
                    },
                },
                splitLine: { show: true, lineStyle: { color: gridColor } },
            },
            yAxis: {
                type: 'value',
                name: `${paramConfig.label} (${paramConfig.unit})`,
                nameTextStyle: { color: subTextColor },
                axisLine: { lineStyle: { color: gridColor } },
                axisLabel: {
                    color: subTextColor,
                    formatter: (value: number) => String(Math.round(value))
                },
                splitLine: { lineStyle: { color: gridColor } },
                min: (extent: { min: number; max: number }) => Math.floor(extent.min - 5),
            },
            dataZoom: [
                { type: 'inside', start: 0, end: 100 },
                {
                    type: 'slider',
                    start: 0,
                    end: 100,
                    bottom: 10,
                    height: 25,
                    borderColor: gridColor,
                    backgroundColor: isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                    fillerColor: `${paramConfig.color}30`,
                    handleStyle: { color: paramConfig.color },
                    textStyle: { color: subTextColor },
                },
            ],
            series,
            animation: true,
            animationDuration: 800,
        }

        chartInstance.current.setOption(option, true)

        const handleResize = () => chartInstance.current?.resize()
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [chartData, selectedParam, showGapFill, showSpikes, showNegative, showConsecutiveEqual, isLight, lang, stationId])

    // Cleanup
    useEffect(() => {
        return () => {
            chartInstance.current?.dispose()
        }
    }, [])

    const paramConfig = PARAMETERS[selectedParam]

    return (
        <Card className={`${className}`}>
            {/* Header with controls */}
            <div className={`p-4 border-b ${isLight ? 'border-gray-100' : 'border-dark-700'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Parameter Selector */}
                    <div className="flex items-center gap-3">
                        <label className={`text-sm font-medium ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                            <Icon name="tune" size="sm" className="mr-1" />
                            {lang === 'th' ? 'เลือกพารามิเตอร์:' : 'Parameter:'}
                        </label>
                        <select
                            value={selectedParam}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedParam(e.target.value as ParameterKey)}
                            className={`px-4 py-2 rounded-lg border font-medium transition-all ${isLight
                                ? 'bg-white border-gray-200 text-gray-800 hover:border-primary-400'
                                : 'bg-dark-700 border-dark-600 text-white hover:border-primary-500'
                                }`}
                        >
                            {Object.entries(PARAMETERS).map(([key, config]) => (
                                <option key={key} value={key}>
                                    {config.label} ({config.unit})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Toggle Controls */}
                    <div className="flex items-center gap-4">
                        <label className={`flex items-center gap-2 cursor-pointer ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                            <input
                                type="checkbox"
                                checked={showGapFill}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowGapFill(e.target.checked)}
                                className="w-4 h-4 rounded accent-amber-500"
                            />
                            <Icon name="auto_fix_high" size="sm" style={{ color: '#f59e0b' }} />
                            <span className="text-sm">Gap-Fill</span>
                        </label>

                        <label className={`flex items-center gap-2 cursor-pointer ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                            <input
                                type="checkbox"
                                checked={showSpikes}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowSpikes(e.target.checked)}
                                className="w-4 h-4 rounded accent-red-500"
                            />
                            <Icon name="warning" size="sm" style={{ color: '#ef4444' }} />
                            <span className="text-sm">Spikes</span>
                        </label>

                        <label className={`flex items-center gap-2 cursor-pointer ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                            <input
                                type="checkbox"
                                checked={showNegative}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowNegative(e.target.checked)}
                                className="w-4 h-4 rounded accent-cyan-500"
                            />
                            <Icon name="remove_circle" size="sm" style={{ color: '#06b6d4' }} />
                            <span className="text-sm">{lang === 'th' ? 'ค่าติดลบ' : 'Negative'}</span>
                        </label>

                        <label className={`flex items-center gap-2 cursor-pointer ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                            <input
                                type="checkbox"
                                checked={showConsecutiveEqual}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowConsecutiveEqual(e.target.checked)}
                                className="w-4 h-4 rounded accent-purple-500"
                            />
                            <Icon name="pause" size="sm" style={{ color: '#8b5cf6' }} />
                            <span className="text-sm">{lang === 'th' ? 'ค่าคงที่' : 'Stuck'}</span>
                        </label>

                        {/* Settings Button */}
                        {onSettingsClick && (
                            <button
                                onClick={onSettingsClick}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border ${isLight
                                    ? 'hover:bg-gray-100 text-gray-600 border-gray-200'
                                    : 'hover:bg-dark-600 text-dark-300 border-dark-600'
                                    }`}
                                title={lang === 'th' ? 'ตั้งค่าคุณภาพข้อมูล' : 'Data quality settings'}
                            >
                                <Icon name="settings" size="sm" />
                                <span className="text-sm">{lang === 'th' ? 'ตั้งค่า' : 'Settings'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Data Health Stats - Dynamic based on selected parameter */}
            {chartData && (
                <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 p-4 border-b ${isLight ? 'border-gray-100 bg-gray-50/50' : 'border-dark-700 bg-dark-800/50'}`}>
                    {/* Completeness */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-100">
                            <Icon name="trending_up" style={{ color: '#10b981' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ความสมบูรณ์ข้อมูล' : 'Completeness'}
                            </p>
                            <p className="text-xl font-bold text-emerald-500">
                                {chartData.stats.completeness.toFixed(0)}%
                            </p>
                        </div>
                    </div>

                    {/* Average Value for Selected Parameter */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${paramConfig.color}20` }}>
                            <Icon name={paramConfig.icon} style={{ color: paramConfig.color }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? `ค่าเฉลี่ย ${paramConfig.label}` : `Avg ${paramConfig.label}`}
                            </p>
                            <p className="text-xl font-bold" style={{ color: paramConfig.color }}>
                                {chartData.stats.mean.toFixed(1)} <span className="text-xs font-normal">{paramConfig.unit}</span>
                            </p>
                        </div>
                    </div>

                    {/* Gap-Filled Points */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100">
                            <Icon name="auto_fix_high" style={{ color: '#f59e0b' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'จุดที่เติม' : 'Gap-Filled'}
                            </p>
                            <p className="text-xl font-bold text-amber-500">
                                {chartData.stats.imputedCount}
                            </p>
                        </div>
                    </div>

                    {/* Missing Points */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-rose-100">
                            <Icon name="cancel" style={{ color: '#f43f5e' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'จุดที่หายไป' : 'Missing'}
                            </p>
                            <p className="text-xl font-bold text-rose-500">
                                {chartData.stats.missingCount}
                            </p>
                        </div>
                    </div>

                    {/* Anomalies/Spikes */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${chartData.stats.anomalyCount > 0 ? 'bg-red-100' : isLight ? 'bg-gray-100' : 'bg-dark-600'}`}>
                            <Icon name="warning" style={{ color: chartData.stats.anomalyCount > 0 ? '#ef4444' : '#9ca3af' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'Spikes' : 'Spikes'}
                            </p>
                            <p className={`text-xl font-bold ${chartData.stats.anomalyCount > 0 ? 'text-red-500' : isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                {chartData.stats.anomalyCount}
                            </p>
                        </div>
                    </div>

                    {/* Negative Values */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${chartData.stats.negativeCount > 0 ? 'bg-cyan-100' : isLight ? 'bg-gray-100' : 'bg-dark-600'}`}>
                            <Icon name="remove_circle" style={{ color: chartData.stats.negativeCount > 0 ? '#06b6d4' : '#9ca3af' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ค่าติดลบ' : 'Negative'}
                            </p>
                            <p className={`text-xl font-bold ${chartData.stats.negativeCount > 0 ? 'text-cyan-500' : isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                {chartData.stats.negativeCount}
                            </p>
                        </div>
                    </div>

                    {/* Consecutive Equal Values (Stuck) */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isLight ? 'bg-white' : 'bg-dark-700/50'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${chartData.stats.consecutiveEqualCount > 0 ? 'bg-purple-100' : isLight ? 'bg-gray-100' : 'bg-dark-600'}`}>
                            <Icon name="pause" style={{ color: chartData.stats.consecutiveEqualCount > 0 ? '#8b5cf6' : '#9ca3af' }} />
                        </div>
                        <div>
                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                {lang === 'th' ? 'ค่าคงที่ซ้ำ' : 'Stuck Values'}
                            </p>
                            <p className={`text-xl font-bold ${chartData.stats.consecutiveEqualCount > 0 ? 'text-purple-500' : isLight ? 'text-gray-400' : 'text-dark-500'}`}>
                                {chartData.stats.consecutiveEqualCount}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Chart Area */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center" style={{ height }}>
                        <Spinner size="xl" />
                    </div>
                ) : !data ? (
                    <div className={`flex flex-col items-center justify-center ${isLight ? 'text-gray-400' : 'text-dark-500'}`} style={{ height }}>
                        <Icon name="show_chart" size="xl" />
                        <p className="mt-2">{lang === 'th' ? 'เลือกสถานีเพื่อดูข้อมูล' : 'Select a station to view data'}</p>
                    </div>
                ) : (
                    <div ref={chartRef} style={{ width: '100%', height }} />
                )}
            </div>

            {/* Legend/Stats Footer */}
            {chartData && (
                <div className={`px-4 pb-4 flex flex-wrap gap-4 text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PARAMETERS[selectedParam].color }} />
                        <span>{lang === 'th' ? 'ข้อมูลจริง' : 'Original'}</span>
                    </div>
                    {showGapFill && (
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rotate-45" style={{ backgroundColor: '#f59e0b' }} />
                            <span>Gap-Fill (LSTM)</span>
                        </div>
                    )}
                    {showSpikes && chartData.spikeData.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span style={{ color: '#ef4444' }}>▲</span>
                            <span>{chartData.spikeData.length} Spikes</span>
                        </div>
                    )}
                    {showNegative && chartData.negativeData.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#06b6d4' }} />
                            <span>{chartData.negativeData.length} {lang === 'th' ? 'ค่าติดลบ' : 'Negative'}</span>
                        </div>
                    )}
                    {showConsecutiveEqual && chartData.consecutiveEqualData.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3" style={{ backgroundColor: '#8b5cf6' }} />
                            <span>{chartData.consecutiveEqualData.length} {lang === 'th' ? 'ค่าคงที่ซ้ำ' : 'Stuck'}</span>
                        </div>
                    )}
                    <div className="ml-auto">
                        <span>μ = {chartData.stats.mean.toFixed(1)} | σ = {chartData.stats.stdDev.toFixed(1)}</span>
                    </div>
                </div>
            )}
        </Card>
    )
}

export default MultiParameterChart
