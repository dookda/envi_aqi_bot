/**
 * MockupDataChart Organism
 * Displays mockup environmental data with selectable parameters
 * Uses Apache ECharts for visualization
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import * as echarts from 'echarts'
import { Card, Spinner, Button, Icon } from '../atoms'
import { useTheme } from '../../contexts'
import type { AQIHourlyData } from '@/types'

interface ParameterConfigItem {
    label: string
    unit: string
    color: string
    group: 'pollutant' | 'meteorological'
}

// Parameter configuration with colors
const PARAMETER_CONFIG: Record<string, ParameterConfigItem> = {
    // Pollutants
    pm25: { label: 'PM2.5', unit: 'µg/m³', color: '#3b82f6', group: 'pollutant' },
    pm10: { label: 'PM10', unit: 'µg/m³', color: '#8b5cf6', group: 'pollutant' },
    o3: { label: 'O₃', unit: 'ppb', color: '#10b981', group: 'pollutant' },
    co: { label: 'CO', unit: 'ppm', color: '#f59e0b', group: 'pollutant' },
    no2: { label: 'NO₂', unit: 'ppb', color: '#ef4444', group: 'pollutant' },
    so2: { label: 'SO₂', unit: 'ppb', color: '#ec4899', group: 'pollutant' },
    nox: { label: 'NOₓ', unit: 'ppb', color: '#f97316', group: 'pollutant' },
    // Meteorological
    ws: { label: 'Wind Speed', unit: 'm/s', color: '#06b6d4', group: 'meteorological' },
    wd: { label: 'Wind Direction', unit: '°', color: '#14b8a6', group: 'meteorological' },
    temp: { label: 'Temperature', unit: '°C', color: '#f97316', group: 'meteorological' },
    rh: { label: 'Humidity', unit: '%', color: '#0ea5e9', group: 'meteorological' },
    bp: { label: 'Pressure', unit: 'hPa', color: '#6366f1', group: 'meteorological' },
    rain: { label: 'Rainfall', unit: 'mm', color: '#22c55e', group: 'meteorological' },
}

const API_BASE = '/api'

interface MockupDataResponse {
    data: AQIHourlyData[]
    period?: {
        days: number
        total_points: number
    }
}

interface MockupDataChartProps {
    stationId?: string
    height?: number
    className?: string
}

const MockupDataChart: React.FC<MockupDataChartProps> = ({
    stationId = 'demo',
    height = 450,
    className = '',
}) => {
    const chartRef = useRef<HTMLDivElement | null>(null)
    const chartInstance = useRef<echarts.ECharts | null>(null)
    const { isLight } = useTheme()

    const [data, setData] = useState<MockupDataResponse | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [days, setDays] = useState<number>(3)
    const [selectedParams, setSelectedParams] = useState<string[]>(['pm25', 'pm10', 'temp', 'rh'])

    // Fetch mockup data
    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const paramsQuery = selectedParams.join(',')
            const response = await fetch(
                `${API_BASE}/aqi/mockup/${stationId}?days=${days}&parameters=${paramsQuery}`
            )
            if (!response.ok) throw new Error('Failed to fetch mockup data')
            const result = await response.json()
            setData(result)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }, [stationId, days, selectedParams])

    // Fetch on mount and when parameters change
    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Toggle parameter selection
    const toggleParam = (param: string) => {
        setSelectedParams(prev =>
            prev.includes(param)
                ? prev.filter(p => p !== param)
                : [...prev, param]
        )
    }

    // Select all pollutants
    const selectAllPollutants = () => {
        const pollutants = Object.keys(PARAMETER_CONFIG).filter(
            k => PARAMETER_CONFIG[k].group === 'pollutant'
        )
        setSelectedParams(prev => {
            const newParams = new Set([...prev, ...pollutants])
            return Array.from(newParams)
        })
    }

    // Select all meteorological
    const selectAllMeteorological = () => {
        const meteo = Object.keys(PARAMETER_CONFIG).filter(
            k => PARAMETER_CONFIG[k].group === 'meteorological'
        )
        setSelectedParams(prev => {
            const newParams = new Set([...prev, ...meteo])
            return Array.from(newParams)
        })
    }

    // Clear all selections
    const clearAll = () => {
        setSelectedParams([])
    }

    // Initialize chart
    useEffect(() => {
        if (!chartRef.current || !data?.data?.length) return

        if (!chartInstance.current) {
            chartInstance.current = echarts.init(chartRef.current, isLight ? null : 'dark')
        }

        // Prepare series for each selected parameter
        const series = selectedParams.map(param => {
            const config = PARAMETER_CONFIG[param]
            if (!config) return null

            const seriesData = data.data.map(d => [d.datetime, d[param as keyof AQIHourlyData] as number])

            return {
                name: config.label,
                type: 'line' as const,
                data: seriesData,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                lineStyle: { color: config.color, width: 2 },
                itemStyle: { color: config.color },
                emphasis: {
                    focus: 'series' as const,
                    lineStyle: { width: 3 },
                },
                yAxisIndex: config.group === 'meteorological' ? 1 : 0,
            }
        }).filter((s): s is NonNullable<typeof s> => s !== null)

        const legendData = selectedParams
            .map(param => PARAMETER_CONFIG[param]?.label)
            .filter(Boolean)

        const textColor = isLight ? '#374151' : '#f1f5f9'
        const subtextColor = isLight ? '#6b7280' : '#94a3b8'
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)'
        const bgColor = isLight ? '#ffffff' : 'transparent'

        const option: echarts.EChartsOption = {
            backgroundColor: bgColor,
            title: {
                text: `Environmental Data - ${stationId}`,
                subtext: 'Mockup data for testing',
                left: 'center',
                textStyle: { color: textColor, fontSize: 16, fontWeight: 600 },
                subtextStyle: { color: subtextColor },
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                borderColor: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                textStyle: { color: textColor },
                formatter: (params: any) => {
                    if (!params?.length) return ''
                    const date = new Date(params[0].axisValue).toLocaleString()
                    let content = `<strong>${date}</strong><br/>`
                    params.forEach((param: any) => {
                        if (param.value?.[1] !== null && param.value?.[1] !== undefined) {
                            const paramKey = Object.keys(PARAMETER_CONFIG).find(
                                k => PARAMETER_CONFIG[k].label === param.seriesName
                            )
                            const unit = paramKey ? PARAMETER_CONFIG[paramKey].unit : ''
                            content += `<span style="color:${param.color}">●</span> `
                            content += `${param.seriesName}: <strong>${param.value[1]?.toFixed(2)} ${unit}</strong><br/>`
                        }
                    })
                    return content
                },
            },
            legend: {
                data: legendData,
                top: 50,
                textStyle: { color: subtextColor },
            },
            grid: {
                left: '5%',
                right: '5%',
                bottom: '18%',
                top: '18%',
                containLabel: true,
            },
            xAxis: {
                type: 'time',
                axisLine: { lineStyle: { color: gridColor } },
                axisLabel: {
                    color: subtextColor,
                    formatter: (value: any) => {
                        const d = new Date(value)
                        return `${d.getMonth() + 1}/${d.getDate()}\n${d.getHours()}:00`
                    },
                },
                splitLine: { show: true, lineStyle: { color: gridColor } },
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Pollutants',
                    nameTextStyle: { color: subtextColor },
                    axisLine: { lineStyle: { color: gridColor } },
                    axisLabel: { color: subtextColor },
                    splitLine: { lineStyle: { color: gridColor } },
                    min: 0,
                },
                {
                    type: 'value',
                    name: 'Meteorological',
                    nameTextStyle: { color: subtextColor },
                    axisLine: { lineStyle: { color: gridColor } },
                    axisLabel: { color: subtextColor },
                    splitLine: { show: false },
                    position: 'right',
                },
            ],
            dataZoom: [
                { type: 'inside', start: 0, end: 100 },
                {
                    type: 'slider',
                    start: 0,
                    end: 100,
                    bottom: 10,
                    height: 25,
                    borderColor: gridColor,
                    backgroundColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
                    fillerColor: 'rgba(59, 130, 246, 0.2)',
                    handleStyle: { color: '#3b82f6' },
                    textStyle: { color: subtextColor },
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
    }, [data, selectedParams, isLight, stationId])

    // Clean up chart on unmount
    useEffect(() => {
        return () => {
            chartInstance.current?.dispose()
        }
    }, [])

    const buttonClass = isLight
        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        : 'bg-dark-700 hover:bg-dark-600 text-dark-200'

    const selectedButtonClass = isLight
        ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
        : 'bg-primary-900/30 text-primary-400 ring-2 ring-primary-500'

    return (
        <Card padding="lg" className={className}>
            {/* Controls */}
            <div className="mb-4 space-y-4">
                {/* Time period and refresh */}
                <div className="flex flex-wrap items-center gap-3">
                    <label className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-dark-300'}`}>
                        Days:
                    </label>
                    {[1, 3, 7, 14].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${days === d ? selectedButtonClass : buttonClass
                                }`}
                        >
                            {d}
                        </button>
                    ))}
                    <Button onClick={fetchData} loading={loading} size="sm">
                        <Icon name="refresh" size="sm" />
                        Refresh
                    </Button>
                </div>

                {/* Parameter selection */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-dark-300'}`}>
                            Pollutants:
                        </span>
                        {Object.entries(PARAMETER_CONFIG)
                            .filter(([, config]) => config.group === 'pollutant')
                            .map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => toggleParam(key)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${selectedParams.includes(key)
                                        ? 'ring-2'
                                        : buttonClass
                                        }`}
                                    style={{
                                        backgroundColor: selectedParams.includes(key)
                                            ? `${config.color}20`
                                            : undefined,
                                        color: selectedParams.includes(key)
                                            ? config.color
                                            : undefined,
                                        borderColor: selectedParams.includes(key)
                                            ? config.color
                                            : undefined,
                                        // @ts-ignore
                                        '--tw-ring-color': config.color,
                                    }}
                                >
                                    {config.label}
                                </button>
                            ))}
                        <button
                            onClick={selectAllPollutants}
                            className={`px-2 py-1 rounded text-xs ${buttonClass}`}
                        >
                            All
                        </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-dark-300'}`}>
                            Meteorological:
                        </span>
                        {Object.entries(PARAMETER_CONFIG)
                            .filter(([, config]) => config.group === 'meteorological')
                            .map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => toggleParam(key)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${selectedParams.includes(key)
                                        ? 'ring-2'
                                        : buttonClass
                                        }`}
                                    style={{
                                        backgroundColor: selectedParams.includes(key)
                                            ? `${config.color}20`
                                            : undefined,
                                        color: selectedParams.includes(key)
                                            ? config.color
                                            : undefined,
                                        // @ts-ignore
                                        '--tw-ring-color': config.color,
                                    }}
                                >
                                    {config.label}
                                </button>
                            ))}
                        <button
                            onClick={selectAllMeteorological}
                            className={`px-2 py-1 rounded text-xs ${buttonClass}`}
                        >
                            All
                        </button>
                    </div>

                    <button
                        onClick={clearAll}
                        className={`text-xs underline ${isLight ? 'text-gray-500' : 'text-dark-400'}`}
                    >
                        Clear all
                    </button>
                </div>
            </div>

            {/* Chart */}
            {loading ? (
                <div className="flex items-center justify-center" style={{ height }}>
                    <Spinner size="xl" />
                </div>
            ) : error ? (
                <div className="flex items-center justify-center text-red-500" style={{ height }}>
                    <Icon name="error" className="mr-2" />
                    {error}
                </div>
            ) : selectedParams.length === 0 ? (
                <div className={`flex items-center justify-center ${isLight ? 'text-gray-500' : 'text-dark-400'}`} style={{ height }}>
                    <Icon name="info" className="mr-2" />
                    Select at least one parameter to display
                </div>
            ) : (
                <div ref={chartRef} style={{ width: '100%', height }} />
            )}

            {/* Data info */}
            {data && (
                <div className={`mt-4 pt-4 border-t ${isLight ? 'border-gray-200' : 'border-white/10'} text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                    <span className="mr-4">
                        <Icon name="schedule" size="sm" className="mr-1" />
                        Period: {data.period?.days} days ({data.period?.total_points} points)
                    </span>
                    <span>
                        <Icon name="science" size="sm" className="mr-1" />
                        Mockup data for testing
                    </span>
                </div>
            )}
        </Card>
    )
}

export default MockupDataChart
