/**
 * Models Page
 * Shows LSTM model status and gap-fill availability for each station
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Badge, Spinner } from '../components/atoms'
import { StatCard } from '../components/molecules'
import { Navbar } from '../components/organisms'
import { useLanguage, useTheme } from '../contexts'
import api from '../services/api'

export default function Models() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [trainingStation, setTrainingStation] = useState(null)
    const [filter, setFilter] = useState('all') // all, ready, not-ready

    const { t } = useLanguage()
    const { isLight } = useTheme()

    const fetchModelsStatus = async () => {
        try {
            setLoading(true)
            const result = await api.get('/models/status?limit=200')
            setData(result)
        } catch (err) {
            console.error('Failed to fetch models status:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchModelsStatus()
    }, [])

    const handleTrainModel = async (stationId) => {
        try {
            setTrainingStation(stationId)
            await api.post('/model/train', { station_id: stationId })
            // Refetch after a delay
            setTimeout(fetchModelsStatus, 3000)
        } catch (err) {
            console.error('Failed to trigger training:', err)
        } finally {
            setTrainingStation(null)
        }
    }

    const handleTrainAll = async () => {
        try {
            setTrainingStation('all')
            await api.post('/model/train-all')
            alert('Training started for all stations. This may take several minutes.')
        } catch (err) {
            console.error('Failed to trigger training:', err)
        } finally {
            setTrainingStation(null)
        }
    }

    const filteredStations = data?.stations?.filter(s => {
        if (filter === 'ready') return s.gap_fill_ready
        if (filter === 'not-ready') return !s.gap_fill_ready
        return true
    }) || []

    if (loading) {
        return (
            <div className="min-h-screen gradient-dark flex items-center justify-center">
                <Spinner size="xl" />
            </div>
        )
    }

    const summary = data?.summary || {}

    return (
        <div className="min-h-screen gradient-dark">
            {/* Header with Language/Theme toggles */}
            <Navbar
                title={t('models.title')}
                subtitle={t('models.subtitle')}
            >
                <Link
                    to="/"
                    className={`transition ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    {t('models.backToDashboard')}
                </Link>
                <Button
                    onClick={handleTrainAll}
                    loading={trainingStation === 'all'}
                    variant="primary"
                >
                    {t('models.trainAll')}
                </Button>
            </Navbar>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        label={t('models.totalStations')}
                        value={summary.total_stations || 0}
                        color="primary"
                        icon="📍"
                    />
                    <StatCard
                        label={t('models.modelsTrained')}
                        value={summary.models_trained || 0}
                        color="success"
                        icon="🧠"
                    />
                    <StatCard
                        label={t('models.gapFillReady')}
                        value={summary.gap_fill_ready || 0}
                        color="warning"
                        icon="✅"
                    />
                    <StatCard
                        label={t('models.coverage')}
                        value={summary.coverage_percent || 0}
                        unit="%"
                        color={summary.coverage_percent >= 80 ? 'success' : summary.coverage_percent >= 50 ? 'warning' : 'danger'}
                        icon="📊"
                    />
                </div>

                {/* Filters */}
                <Card className="mb-6 p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className={isLight ? 'text-gray-600' : 'text-dark-400'}>{t('models.filter')}</span>
                        <div className="flex gap-2">
                            {[
                                { value: 'all', label: t('models.allStations') },
                                { value: 'ready', label: t('models.ready') },
                                { value: 'not-ready', label: t('models.notReady') },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilter(opt.value)}
                                    className={`px-4 py-2 rounded-lg transition ${filter === opt.value
                                        ? 'bg-primary-500 text-white'
                                        : isLight
                                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <span className={`ml-auto ${isLight ? 'text-gray-500' : 'text-dark-500'}`}>
                            {t('models.showing')} {filteredStations.length} {t('models.stations')}
                        </span>
                    </div>
                </Card>

                {/* Stations Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStations.map(station => (
                        <Card key={station.station_id} className="p-4">
                            {/* Station Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className={`font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                        {station.station_id}
                                    </h3>
                                    <p className={`text-sm truncate max-w-[200px] ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                        {station.station_name}
                                    </p>
                                </div>
                                <Badge
                                    variant={station.gap_fill_ready ? 'success' : 'danger'}
                                    size="sm"
                                >
                                    {station.gap_fill_ready ? t('models.ready') : t('models.notReady')}
                                </Badge>
                            </div>

                            {/* Model Status */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className={isLight ? 'text-gray-500' : 'text-dark-400'}>{t('models.model')}</span>
                                    <span className={station.model_status.has_model ? 'text-success-400' : isLight ? 'text-gray-400' : 'text-dark-500'}>
                                        {station.model_status.has_model ? t('models.trained') : t('models.notTrained')}
                                    </span>
                                </div>

                                {station.model_status.training_info && (
                                    <>
                                        {/* Accuracy (R²) - Most prominent */}
                                        {station.model_status.training_info.accuracy_percent != null && (
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className={isLight ? 'text-gray-500' : 'text-dark-400'}>{t('models.accuracy')}</span>
                                                <span className={`font-bold ${station.model_status.training_info.accuracy_percent >= 80
                                                    ? 'text-success-400'
                                                    : station.model_status.training_info.accuracy_percent >= 60
                                                        ? 'text-warning-400'
                                                        : 'text-danger-400'
                                                    }`}>
                                                    {station.model_status.training_info.accuracy_percent.toFixed(1)}%
                                                </span>
                                            </div>
                                        )}
                                        {/* Validation R² Raw Value */}
                                        {station.model_status.training_info.val_r2 != null && (
                                            <div className="flex justify-between text-sm">
                                                <span className={isLight ? 'text-gray-500' : 'text-dark-400'}>{t('models.r2Score')}</span>
                                                <span className={isLight ? 'text-gray-800' : 'text-white'}>
                                                    {station.model_status.training_info.val_r2.toFixed(4)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className={isLight ? 'text-gray-500' : 'text-dark-400'}>{t('models.rmse')}</span>
                                            <span className="text-primary-400">
                                                {station.model_status.training_info.val_rmse?.toFixed(4) || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className={isLight ? 'text-gray-500' : 'text-dark-400'}>{t('models.mae')}</span>
                                            <span className="text-primary-400">
                                                {station.model_status.training_info.val_mae?.toFixed(4) || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className={isLight ? 'text-gray-500' : 'text-dark-400'}>{t('models.trainingSamples')}</span>
                                            <span className={isLight ? 'text-gray-800' : 'text-white'}>
                                                {station.model_status.training_info.training_samples || '—'}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Data Status */}
                            <div className={`border-t pt-3 mb-4 ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className={`rounded p-2 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className={isLight ? 'text-gray-500' : 'text-dark-500'}>{t('models.validData')}</div>
                                        <div className={`font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>{station.data_status.valid_points}</div>
                                    </div>
                                    <div className={`rounded p-2 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className={isLight ? 'text-gray-500' : 'text-dark-500'}>{t('models.imputed')}</div>
                                        <div className="text-warning-400 font-medium">{station.data_status.imputed_points}</div>
                                    </div>
                                    <div className={`rounded p-2 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className={isLight ? 'text-gray-500' : 'text-dark-500'}>{t('models.missing')}</div>
                                        <div className="text-danger-400 font-medium">{station.data_status.missing_points}</div>
                                    </div>
                                    <div className={`rounded p-2 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className={isLight ? 'text-gray-500' : 'text-dark-500'}>{t('models.total')}</div>
                                        <div className={`font-medium ${isLight ? 'text-gray-600' : 'text-dark-300'}`}>{station.data_status.total_points}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleTrainModel(station.station_id)}
                                    loading={trainingStation === station.station_id}
                                    className="flex-1"
                                >
                                    {station.model_status.has_model ? t('models.retrain') : t('models.train')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.location.href = `/?station=${station.station_id}`}
                                    className="flex-1"
                                >
                                    {t('models.viewChart')}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>

                {filteredStations.length === 0 && (
                    <Card className="p-12 text-center">
                        <p className={isLight ? 'text-gray-500' : 'text-dark-400'}>{t('models.noStations')}</p>
                    </Card>
                )}
            </main>
        </div>
    )
}

