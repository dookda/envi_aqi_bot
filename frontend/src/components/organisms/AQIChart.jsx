/**
 * AQIChart Organism
 * Time series chart using Apache ECharts
 * Shows original PM2.5 data, LSTM-imputed values, and anomalies
 */
import { useEffect, useRef, useMemo } from 'react'
import PropTypes from 'prop-types'
import * as echarts from 'echarts'
import { Card, Spinner } from '../atoms'

// Anomaly severity colors
const ANOMALY_COLORS = {
    critical: '#dc2626',
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#fbbf24',
}

export default function AQIChart({
    data,
    loading = false,
    height = 450,
    showAnomalies = true,
    className = '',
}) {
    const chartRef = useRef(null)
    const chartInstance = useRef(null)

    // Process data for chart
    const chartData = useMemo(() => {
        if (!data?.series) return null

        const allData = data.series.timestamps.map((time, i) => ({
            time,
            value: data.series.values[i],
            isImputed: data.series.is_imputed[i],
        }))

        // Original data series
        const originalData = allData.map(d => [
            d.time,
            d.value !== null && !d.isImputed ? d.value : null,
        ])

        // Imputed segments with connecting points
        const imputedSegments = []
        let i = 0
        while (i < allData.length) {
            if (allData[i].isImputed && allData[i].value !== null) {
                const segment = []
                if (i > 0 && allData[i - 1].value !== null) {
                    segment.push([allData[i - 1].time, allData[i - 1].value])
                }
                while (i < allData.length && allData[i].isImputed && allData[i].value !== null) {
                    segment.push([allData[i].time, allData[i].value])
                    i++
                }
                if (i < allData.length && allData[i].value !== null) {
                    segment.push([allData[i].time, allData[i].value])
                }
                if (segment.length > 0) imputedSegments.push(segment)
            } else {
                i++
            }
        }

        // Flatten imputed segments
        const imputedLineData = []
        imputedSegments.forEach((segment, idx) => {
            segment.forEach(point => imputedLineData.push(point))
            if (idx < imputedSegments.length - 1) {
                imputedLineData.push([null, null])
            }
        })

        // Gap areas
        const markAreas = (data.gaps || []).map(gap => [
            { xAxis: gap.start, itemStyle: { color: 'rgba(239, 68, 68, 0.15)' } },
            { xAxis: gap.end },
        ])

        // Anomaly data points
        const anomalyData = (data.anomalies || []).map(a => ({
            value: [a.datetime, a.value],
            itemStyle: {
                color: ANOMALY_COLORS[a.severity] || ANOMALY_COLORS.medium,
                borderColor: '#fff',
                borderWidth: 2,
            },
            anomaly: a, // Store full anomaly data for tooltip
        }))

        return { originalData, imputedLineData, markAreas, anomalyData }
    }, [data])

    // Initialize and update chart
    useEffect(() => {
        if (!chartRef.current || !chartData) return

        if (!chartInstance.current) {
            chartInstance.current = echarts.init(chartRef.current, 'dark')
        }

        const series = [
            {
                name: 'Original PM2.5',
                type: 'line',
                data: chartData.originalData,
                smooth: true,
                symbol: 'circle',
                symbolSize: 3,
                lineStyle: { color: '#3b82f6', width: 2 },
                itemStyle: { color: '#3b82f6' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
                    ]),
                },
                connectNulls: false,
                markArea: { silent: true, data: chartData.markAreas },
                z: 1,
            },
            {
                name: 'LSTM Imputed',
                type: 'line',
                data: chartData.imputedLineData,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                lineStyle: { color: '#f59e0b', width: 3 },
                itemStyle: { color: '#f59e0b', borderColor: '#fbbf24', borderWidth: 2 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
                        { offset: 1, color: 'rgba(245, 158, 11, 0.05)' },
                    ]),
                },
                connectNulls: false,
                z: 10,
            },
        ]

        // Add anomaly series if enabled and has data
        if (showAnomalies && chartData.anomalyData.length > 0) {
            series.push({
                name: 'Anomaly',
                type: 'scatter',
                data: chartData.anomalyData,
                symbol: 'triangle',
                symbolSize: 14,
                z: 20,
                emphasis: {
                    scale: 1.5,
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(239, 68, 68, 0.5)',
                    },
                },
            })
        }

        const legendData = ['Original PM2.5', 'LSTM Imputed']
        if (showAnomalies && chartData.anomalyData.length > 0) {
            legendData.push('Anomaly')
        }

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: data?.station_id ? `PM2.5 Time Series - Station ${data.station_id}` : '',
                left: 'center',
                textStyle: { color: '#f1f5f9', fontSize: 16, fontWeight: 600 },
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textStyle: { color: '#f1f5f9' },
                formatter: params => {
                    if (!params?.length) return ''
                    const date = new Date(params[0].axisValue).toLocaleString()
                    let content = `<strong>${date}</strong><br/>`

                    params.forEach(param => {
                        if (param.value?.[1] !== null) {
                            if (param.seriesName === 'Anomaly') {
                                const anomaly = param.data.anomaly
                                const icon = '⚠️'
                                content += `${icon} <span style="color:${param.color}">Anomaly (${anomaly.type})</span>: `
                                content += `<strong>${param.value[1].toFixed(1)} μg/m³</strong><br/>`
                                content += `<span style="color:#94a3b8">Severity: ${anomaly.severity}</span><br/>`
                            } else {
                                const isImputed = param.seriesName.includes('Imputed')
                                const icon = isImputed ? '🔮' : '📊'
                                const label = isImputed ? 'LSTM Imputed' : 'Original PM2.5'
                                content += `${icon} ${label}: <strong>${param.value[1].toFixed(1)} μg/m³</strong><br/>`
                            }
                        }
                    })
                    return content
                },
            },
            legend: {
                data: legendData,
                top: 35,
                right: 20,
                textStyle: { color: '#94a3b8' },
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '18%',
                top: '12%',
                containLabel: true,
            },
            xAxis: {
                type: 'time',
                axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
                axisLabel: {
                    color: '#94a3b8',
                    formatter: value => {
                        const d = new Date(value)
                        return `${d.getMonth() + 1}/${d.getDate()}\n${d.getHours()}:00`
                    },
                },
                splitLine: { show: true, lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
            },
            yAxis: {
                type: 'value',
                name: 'PM2.5 (μg/m³)',
                nameTextStyle: { color: '#94a3b8' },
                axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
                axisLabel: { color: '#94a3b8' },
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
                min: 0,
            },
            dataZoom: [
                { type: 'inside', start: 0, end: 100 },
                {
                    type: 'slider',
                    start: 0,
                    end: 100,
                    bottom: 10,
                    height: 25,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    fillerColor: 'rgba(59, 130, 246, 0.2)',
                    handleStyle: { color: '#3b82f6' },
                    textStyle: { color: '#94a3b8' },
                },
            ],
            series,
            animation: true,
            animationDuration: 1000,
        }

        chartInstance.current.setOption(option, true)

        const handleResize = () => chartInstance.current?.resize()
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [chartData, data?.station_id, showAnomalies])

    useEffect(() => {
        return () => {
            chartInstance.current?.dispose()
        }
    }, [])

    return (
        <Card padding="lg" className={className}>
            {loading ? (
                <div className="flex items-center justify-center" style={{ height }}>
                    <Spinner size="xl" />
                </div>
            ) : (
                <div ref={chartRef} style={{ width: '100%', height }} />
            )}
        </Card>
    )
}

AQIChart.propTypes = {
    data: PropTypes.shape({
        station_id: PropTypes.string,
        series: PropTypes.shape({
            timestamps: PropTypes.array,
            values: PropTypes.array,
            is_imputed: PropTypes.array,
        }),
        gaps: PropTypes.array,
        anomalies: PropTypes.array,
        statistics: PropTypes.object,
    }),
    loading: PropTypes.bool,
    height: PropTypes.number,
    showAnomalies: PropTypes.bool,
    className: PropTypes.string,
}
