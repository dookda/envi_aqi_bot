/**
 * Dashboard Page
 * Main dashboard with map and chart
 */
import { useState, useEffect } from 'react'
import { Button, Select, Card } from '../components/atoms'
import { StatCard, StationSelector } from '../components/molecules'
import { AQIChart, StationMap } from '../components/organisms'
import { useStations, useChartData } from '../hooks'

const TIME_PERIOD_OPTIONS = [
    { value: 1, label: 'Last 24 hours' },
    { value: 3, label: 'Last 3 days' },
    { value: 7, label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' },
]

export default function Dashboard() {
    const { stations, loading: stationsLoading } = useStations()
    const { data: chartData, loading: chartLoading, fetchChartData } = useChartData()

    const [selectedStation, setSelectedStation] = useState('')
    const [timePeriod, setTimePeriod] = useState(7)
    const [showAnomalies, setShowAnomalies] = useState(true)

    // Load chart data when station or period changes
    useEffect(() => {
        if (selectedStation) {
            fetchChartData(selectedStation, timePeriod)
        }
    }, [selectedStation, timePeriod, fetchChartData])

    // Auto-select first station
    useEffect(() => {
        if (stations.length > 0 && !selectedStation) {
            setSelectedStation(stations[0].station_id)
        }
    }, [stations, selectedStation])

    const stats = chartData?.statistics || {}

    return (
        <div className="min-h-screen gradient-dark">
            {/* Header */}
            <header className="glass border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gradient">
                                🌍 AQI Monitoring Dashboard
                            </h1>
                            <p className="text-dark-400 text-sm">
                                Real-time PM2.5 data with LSTM-based gap filling
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <a
                                href="/chat"
                                className="text-dark-400 hover:text-white transition text-sm"
                            >
                                🤖 AI Chat
                            </a>
                            <a
                                href="/models"
                                className="text-dark-400 hover:text-white transition text-sm"
                            >
                                🧠 Models Status
                            </a>
                            <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showAnomalies}
                                    onChange={(e) => setShowAnomalies(e.target.checked)}
                                    className="w-4 h-4 rounded border-dark-600"
                                />
                                Show Anomalies
                            </label>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Controls */}
                <Card className="mb-6">
                    <div className="flex flex-wrap items-end gap-4">
                        <StationSelector
                            stations={stations}
                            value={selectedStation}
                            onChange={setSelectedStation}
                            loading={stationsLoading}
                            className="min-w-[250px]"
                        />
                        <Select
                            label="Time Period"
                            options={TIME_PERIOD_OPTIONS}
                            value={timePeriod}
                            onChange={(v) => setTimePeriod(Number(v))}
                            className="min-w-[180px]"
                        />
                        <Button
                            onClick={() => fetchChartData(selectedStation, timePeriod)}
                            loading={chartLoading}
                        >
                            📊 Load Data
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => fetchChartData(selectedStation, timePeriod)}
                        >
                            🔄 Refresh
                        </Button>
                    </div>
                </Card>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    <StatCard
                        label="Data Completeness"
                        value={stats.completeness || 0}
                        unit="%"
                        color="success"
                        icon="📈"
                    />
                    <StatCard
                        label="Average PM2.5"
                        value={stats.mean?.toFixed(1) || '-'}
                        unit="μg/m³"
                        color="primary"
                        icon="🌡️"
                    />
                    <StatCard
                        label="Imputed Points"
                        value={stats.imputed_points || 0}
                        color="warning"
                        icon="🔮"
                    />
                    <StatCard
                        label="Missing Points"
                        value={stats.missing_points || 0}
                        color="danger"
                        icon="❌"
                    />
                    <StatCard
                        label="Anomalies"
                        value={stats.anomaly_count || 0}
                        color={stats.anomaly_count > 0 ? 'danger' : 'default'}
                        icon="⚠️"
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Map */}
                    <StationMap
                        stations={stations}
                        selectedStation={selectedStation}
                        onStationSelect={setSelectedStation}
                        loading={stationsLoading}
                        height={400}
                    />

                    {/* Info Panel */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">📌 Understanding the Data</h3>
                        <div className="space-y-3 text-sm text-dark-300">
                            <p className="flex items-start gap-2">
                                <span className="text-primary-400">📊</span>
                                <span><strong className="text-white">Blue line:</strong> Original PM2.5 readings from Air4Thai sensors</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-warning-400">🔮</span>
                                <span><strong className="text-white">Orange line:</strong> LSTM model predictions filling data gaps</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-danger-400">⚠️</span>
                                <span><strong className="text-white">Triangle markers:</strong> Detected anomalies (spikes, outliers)</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-danger-300">🔴</span>
                                <span><strong className="text-white">Red shaded areas:</strong> Periods with missing data</span>
                            </p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/10">
                            <h4 className="font-medium mb-2">AQI Level Guide (PM2.5)</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <span className="px-2 py-1 rounded aqi-excellent">0-25: Excellent</span>
                                <span className="px-2 py-1 rounded aqi-good">26-50: Good</span>
                                <span className="px-2 py-1 rounded aqi-moderate">51-100: Moderate</span>
                                <span className="px-2 py-1 rounded aqi-unhealthy-sensitive">101-200: Unhealthy (Sensitive)</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Chart */}
                <AQIChart
                    data={chartData}
                    loading={chartLoading}
                    showAnomalies={showAnomalies}
                    height={500}
                />
            </main>
        </div>
    )
}
