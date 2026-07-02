/**
 * AQIStatusChart Organism
 * Horizontal bar chart summarizing station counts by AQI severity level
 */
import { useEffect, useRef, useMemo } from 'react'
import * as echarts from 'echarts'
import { useLanguage, useTheme } from '../../contexts'

interface AQIStatusChartProps {
  excellent: number
  good: number
  moderate: number
  unhealthy: number
  veryUnhealthy: number
  total: number
  height?: number
  className?: string
}

// Reserved AQI severity colors (validated for lightness band, chroma floor and
// contrast; the orange/amber adjacent pair sits in the CVD floor band, mitigated
// by the always-on category + value labels on every bar).
const LEVEL_COLORS = {
  excellent: '#0284c7',
  good: '#16a34a',
  moderate: '#b45309',
  unhealthy: '#ea580c',
  veryUnhealthy: '#dc2626',
}

const AQIStatusChart: React.FC<AQIStatusChartProps> = ({
  excellent,
  good,
  moderate,
  unhealthy,
  veryUnhealthy,
  total,
  height = 260,
  className = '',
}) => {
  const { lang } = useLanguage()
  const { isLight } = useTheme()
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  // Ordered best -> worst; reversed at render time so "Excellent" renders at the top
  const levels = useMemo(() => ([
    { count: excellent, color: LEVEL_COLORS.excellent, label: lang === 'th' ? 'ดีมาก' : 'Excellent' },
    { count: good, color: LEVEL_COLORS.good, label: lang === 'th' ? 'ดี' : 'Good' },
    { count: moderate, color: LEVEL_COLORS.moderate, label: lang === 'th' ? 'ปานกลาง' : 'Moderate' },
    { count: unhealthy, color: LEVEL_COLORS.unhealthy, label: lang === 'th' ? 'เริ่มมีผลกระทบต่อสุขภาพ' : 'Unhealthy' },
    { count: veryUnhealthy, color: LEVEL_COLORS.veryUnhealthy, label: lang === 'th' ? 'มีผลกระทบต่อสุขภาพ' : 'Very Unhealthy' },
  ]), [excellent, good, moderate, unhealthy, veryUnhealthy, lang])

  useEffect(() => {
    if (!chartRef.current || total === 0) return

    const theme = isLight ? null : 'dark'
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, theme)
    }

    const textColor = isLight ? '#374151' : '#f1f5f9'
    const subTextColor = isLight ? '#6b7280' : '#94a3b8'
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'

    const orderedLevels = [...levels].reverse()

    const option: echarts.EChartsOption = {
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'item',
        backgroundColor: isLight ? '#ffffff' : '#1e293b',
        borderColor: gridColor,
        textStyle: { color: textColor },
        formatter: (params: any) => {
          const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : '0.0'
          return `<strong>${params.value}</strong> ${lang === 'th' ? 'สถานี' : 'stations'} (${pct}%)<br/>` +
            `<span style="color:${subTextColor}">${params.name}</span>`
        },
      },
      xAxis: {
        type: 'value',
        show: false,
      },
      yAxis: {
        type: 'category',
        data: orderedLevels.map(l => l.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: textColor, fontSize: 13 },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: orderedLevels.map(l => ({ value: l.count, name: l.label, itemStyle: { color: l.color } })),
          barWidth: 22,
          barCategoryGap: '35%',
          itemStyle: { borderRadius: [0, 6, 6, 0] },
          label: {
            show: true,
            position: 'right',
            color: textColor,
            fontWeight: 600,
          },
        },
      ],
      animation: true,
      animationDuration: 600,
    }

    chartInstance.current.setOption(option, true)

    const handleResize = () => chartInstance.current?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [levels, total, isLight, lang])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  if (total === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm ${isLight ? 'text-gray-400' : 'text-dark-500'} ${className}`}
        style={{ height }}
      >
        {lang === 'th' ? 'ไม่มีข้อมูล' : 'No data available'}
      </div>
    )
  }

  return <div ref={chartRef} className={className} style={{ width: '100%', height }} />
}

export default AQIStatusChart
