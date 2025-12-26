/**
 * Dashboard Page
 * Main dashboard with map and chart
 */
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Select, Card, Icon } from '../components/atoms'
import { StatCard, StationSelector } from '../components/molecules'
import { AQIChart, StationMap, Navbar } from '../components/organisms'
import { useStations, useChartData } from '../hooks'
import { useLanguage, useTheme } from '../contexts'

export default function Dashboard() {
    const { stations, loading: stationsLoading } = useStations()
    const { data: chartData, loading: chartLoading, fetchChartData } = useChartData()
    const { t } = useLanguage()
    const { isLight } = useTheme()
    const [searchParams] = useSearchParams()

    const [selectedStation, setSelectedStation] = useState('')
    const [timePeriod, setTimePeriod] = useState(7)
    const [showAnomalies, setShowAnomalies] = useState(true)

    // Translated time period options
    const TIME_PERIOD_OPTIONS = [
        { value: 1, label: t('time.last24h') },
        { value: 3, label: t('time.last3d') },
        { value: 7, label: t('time.last7d') },
        { value: 14, label: t('time.last14d') },
        { value: 30, label: t('time.last30d') },
    ]

    // Load chart data when station or period changes
    useEffect(() => {
        if (selectedStation) {
            fetchChartData(selectedStation, timePeriod)
        }
    }, [selectedStation, timePeriod, fetchChartData])

    // Auto-select station from URL parameter or first station
    useEffect(() => {
        if (stations.length > 0 && !selectedStation) {
            const stationFromUrl = searchParams.get('station')
            if (stationFromUrl && stations.find(s => s.station_id === stationFromUrl)) {
                setSelectedStation(stationFromUrl)
            } else {
                setSelectedStation(stations[0].station_id)
            }
        }
    }, [stations, selectedStation, searchParams])

    const stats = chartData?.statistics || {}

    return (
        <div className="min-h-screen gradient-dark">
            {/* Header with Language/Theme toggles */}
            <Navbar
                title={t('dashboard.title')}
                subtitle={t('dashboard.subtitle')}
            >
                <Link
                    to="/chat"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="smart_toy" size="sm" />
                    {t('dashboard.aiChat')}
                </Link>
                <Link
                    to="/models"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="psychology" size="sm" />
                    {t('dashboard.modelsStatus')}
                </Link>
                <Link
                    to="/admin"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="admin_panel_settings" size="sm" />
                    Admin
                </Link>
            </Navbar>

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
                            label={t('dashboard.timePeriod')}
                            options={TIME_PERIOD_OPTIONS}
                            value={timePeriod}
                            onChange={(v) => setTimePeriod(Number(v))}
                            className="min-w-[180px]"
                        />
                        <Button
                            onClick={() => fetchChartData(selectedStation, timePeriod)}
                            loading={chartLoading}
                        >
                            <Icon name="download" size="sm" />
                            {t('dashboard.loadData')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => fetchChartData(selectedStation, timePeriod)}
                        >
                            <Icon name="refresh" size="sm" />
                            {t('dashboard.refresh')}
                        </Button>
                    </div>
                </Card>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    <StatCard
                        label={t('stats.dataCompleteness')}
                        value={stats.completeness || 0}
                        unit="%"
                        color="success"
                        iconName="trending_up"
                    />
                    <StatCard
                        label={t('stats.averagePM25')}
                        value={stats.mean?.toFixed(1) || '-'}
                        unit="μg/m³"
                        color="primary"
                        iconName="thermostat"
                    />
                    <StatCard
                        label={t('stats.imputedPoints')}
                        value={stats.imputed_points || 0}
                        color="warning"
                        iconName="auto_fix_high"
                    />
                    <StatCard
                        label={t('stats.missingPoints')}
                        value={stats.missing_points || 0}
                        color="danger"
                        iconName="cancel"
                    />
                    <StatCard
                        label={t('stats.anomalies')}
                        value={stats.anomaly_count || 0}
                        color={stats.anomaly_count > 0 ? 'danger' : 'default'}
                        iconName="warning"
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
                        showAnomalies={showAnomalies}
                        onShowAnomaliesChange={setShowAnomalies}
                    />

                    {/* Info Panel */}
                    <Card className="p-6">
                        <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-800' : ''}`}>
                            {t('info.title')}
                        </h3>
                        <div className={`space-y-3 text-sm ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>
                            <p className="flex items-start gap-2">
                                <Icon name="show_chart" color="primary" size="sm" />
                                <span><strong className={isLight ? 'text-gray-800' : 'text-white'}>{t('info.blueLine')}</strong> {t('info.blueLineDesc')}</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <Icon name="auto_fix_high" color="warning" size="sm" />
                                <span><strong className={isLight ? 'text-gray-800' : 'text-white'}>{t('info.orangeLine')}</strong> {t('info.orangeLineDesc')}</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <Icon name="warning" color="danger" size="sm" />
                                <span><strong className={isLight ? 'text-gray-800' : 'text-white'}>{t('info.triangleMarkers')}</strong> {t('info.triangleMarkersDesc')}</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <Icon name="circle" color="danger" size="sm" filled />
                                <span><strong className={isLight ? 'text-gray-800' : 'text-white'}>{t('info.redAreas')}</strong> {t('info.redAreasDesc')}</span>
                            </p>
                        </div>

                        <div className={`mt-6 pt-4 border-t ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
                            <h4 className={`font-medium mb-2 ${isLight ? 'text-gray-800' : ''}`}>{t('aqi.levelGuide')}</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <span className="px-2 py-1 rounded aqi-excellent">0-25: {t('aqi.excellent')}</span>
                                <span className="px-2 py-1 rounded aqi-good">26-50: {t('aqi.good')}</span>
                                <span className="px-2 py-1 rounded aqi-moderate">51-100: {t('aqi.moderate')}</span>
                                <span className="px-2 py-1 rounded aqi-unhealthy-sensitive">101-200: {t('aqi.unhealthySensitive')}</span>
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

