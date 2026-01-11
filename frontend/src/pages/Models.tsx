/**
 * Models Page
 * Shows LSTM model status and gap-fill availability for each station
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Badge, Spinner, Icon } from '../components/atoms'
import { StatCard } from '../components/molecules'
import { Navbar } from '../components/organisms'
import { useLanguage, useTheme, useToast } from '../contexts'
import api from '../services/api'

interface TrainingInfo {
    accuracy_percent?: number
    val_r2?: number
    val_rmse?: number
    val_mae?: number
    training_samples?: number
}

interface ModelStatus {
    has_model: boolean
    training_info?: TrainingInfo
}

interface DataStatus {
    valid_points: number
    imputed_points: number
    missing_points: number
    total_points: number
}

interface StationModel {
    station_id: string
    station_name: string
    gap_fill_ready: boolean
    model_status: ModelStatus
    data_status: DataStatus
}

interface ModelsSummary {
    total_stations: number
    models_trained: number
    gap_fill_ready: number
    coverage_percent: number
}

interface ModelsStatusResponse {
    summary: ModelsSummary
    stations: StationModel[]
}

export default function Models(): React.ReactElement {
    const [data, setData] = useState<ModelsStatusResponse | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [trainingStation, setTrainingStation] = useState<string | null>(null)
    const [imputingStation, setImputingStation] = useState<string | null>(null)
    const [filledStations, setFilledStations] = useState<Set<string>>(new Set())
    const [filter, setFilter] = useState<'all' | 'ready' | 'not-ready'>('all')

    const { t } = useLanguage()
    const { isLight } = useTheme()
    const { toast } = useToast()
    const navigate = useNavigate()

    const fetchModelsStatus = async (): Promise<void> => {
        try {
            setLoading(true)
            const result = await api.get<ModelsStatusResponse>('/models/status?limit=200')
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

    const handleTrainModel = async (stationId: string): Promise<void> => {
        try {
            setTrainingStation(stationId)

            // Start training
            await api.post('/model/train', {
                station_id: stationId,
                force_retrain: true  // Force retrain even if model exists
            })

            // Poll for completion (check every 2 seconds, max 10 minutes)
            let attempts = 0
            const maxAttempts = 300 // 10 minutes

            const pollStatus = async (): Promise<void> => {
                if (attempts >= maxAttempts) {
                    setTrainingStation(null)
                    toast.warning('Training is taking longer than expected. Please check the model status page.')
                    return
                }

                attempts++

                // Check if training is complete by fetching updated status
                try {
                    const result = await api.get<ModelsStatusResponse>('/models/status?limit=200')
                    const station = result.stations?.find(s => s.station_id === stationId)

                    // If we have updated training info, training is complete
                    if (station && station.model_status.training_info) {
                        setData(result)
                        setTrainingStation(null)
                        return
                    }
                } catch (error) {
                    console.error('Error polling status:', error)
                }

                // Continue polling
                setTimeout(pollStatus, 2000)
            }

            // Start polling after 5 seconds (give training time to start)
            setTimeout(pollStatus, 5000)

        } catch (err) {
            console.error('Failed to trigger training:', err)
            toast.error(`Training failed: ${(err as Error).message}`)
            setTrainingStation(null)
        }
    }

    const handleTrainAll = async (): Promise<void> => {
        try {
            setTrainingStation('all')
            await api.post('/model/train-all')
            toast.info('Training started for all stations. This may take several minutes.')
        } catch (err) {
            console.error('Failed to trigger training:', err)
            toast.error('Failed to start batch training')
        } finally {
            setTrainingStation(null)
        }
    }

    const handleFillGaps = async (stationId: string): Promise<void> => {
        try {
            setImputingStation(stationId)
            const result = await api.post<{
                imputed_count?: number
                skipped_count?: number
                failed_count?: number
                reason?: string
            }>('/impute', { station_id: stationId })

            // Mark station as filled (changes button color)
            setFilledStations(prev => new Set([...prev, stationId]))

            // Show success toast with details
            const imputed = result?.imputed_count || 0
            const skipped = result?.skipped_count || 0
            const failed = result?.failed_count || 0

            if (imputed > 0) {
                toast.success(`${stationId}: ${imputed} gap${imputed > 1 ? 's' : ''} filled successfully${skipped > 0 ? `, ${skipped} skipped` : ''}`)
            } else if (result?.reason === 'no_missing_values') {
                toast.info(`${stationId}: No missing values to fill`)
            } else {
                toast.warning(`${stationId}: No gaps could be filled${failed > 0 ? ` (${failed} failed)` : ''}`)
            }
        } catch (err) {
            console.error('Failed to fill gaps:', err)
            toast.error(`Failed to fill gaps for ${stationId}`)
        } finally {
            setImputingStation(null)
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

    const summary = data?.summary || {} as ModelsSummary

    return (
        <div className="min-h-screen gradient-dark">
            {/* Header with Language/Theme toggles */}
            <Navbar
                title={t('models.title')}
                subtitle={t('models.subtitle')}
            >
                <Link
                    to="/"
                    className={`transition flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="arrow_back" size="sm" />
                    {t('models.backToDashboard')}
                </Link>
                <Link
                    to="/admin"
                    className={`transition flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="admin_panel_settings" size="sm" />
                    Admin
                </Link>
                <Button
                    onClick={handleTrainAll}
                    loading={trainingStation === 'all'}
                    variant="primary"
                >
                    <Icon name="model_training" size="sm" />
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
                        iconName="location_on"
                    />
                    <StatCard
                        label={t('models.modelsTrained')}
                        value={summary.models_trained || 0}
                        color="success"
                        iconName="psychology"
                    />
                    <StatCard
                        label={t('models.gapFillReady')}
                        value={summary.gap_fill_ready || 0}
                        color="warning"
                        iconName="check_circle"
                    />
                    <StatCard
                        label={t('models.coverage')}
                        value={summary.coverage_percent || 0}
                        unit="%"
                        color={summary.coverage_percent >= 80 ? 'success' : summary.coverage_percent >= 50 ? 'warning' : 'danger'}
                        iconName="bar_chart"
                    />
                </div>

                {/* Filters */}
                <Card className="mb-6 p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className={isLight ? 'text-gray-600' : 'text-dark-400'}>{t('models.filter')}</span>
                        <div className="flex gap-2">
                            {[
                                { value: 'all' as const, label: t('models.allStations'), icon: 'list' },
                                { value: 'ready' as const, label: t('models.ready'), icon: 'check_circle' },
                                { value: 'not-ready' as const, label: t('models.notReady'), icon: 'pending' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilter(opt.value)}
                                    className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${filter === opt.value
                                        ? 'bg-primary-500 text-white'
                                        : isLight
                                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                        }`}
                                >
                                    <Icon name={opt.icon} size="sm" />
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
                                    <h3 className={`font-semibold flex items-center gap-1 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                        <Icon name="location_on" size="sm" color="primary" />
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
                                    <span className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                        <Icon name="psychology" size="xs" />
                                        {t('models.model')}
                                    </span>
                                    <span className={station.model_status.has_model ? 'text-success-400' : isLight ? 'text-gray-400' : 'text-dark-500'}>
                                        {station.model_status.has_model ? t('models.trained') : t('models.notTrained')}
                                    </span>
                                </div>

                                {station.model_status.training_info && (
                                    <>
                                        {/* Accuracy (R²) - Most prominent */}
                                        {station.model_status.training_info.accuracy_percent != null && (
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                    <Icon name="speed" size="xs" />
                                                    {t('models.accuracy')}
                                                </span>
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
                                                <span className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                    <Icon name="functions" size="xs" />
                                                    {t('models.r2Score')}
                                                </span>
                                                <span className={isLight ? 'text-gray-800' : 'text-white'}>
                                                    {station.model_status.training_info.val_r2.toFixed(4)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                <Icon name="query_stats" size="xs" />
                                                {t('models.rmse')}
                                            </span>
                                            <span className="text-primary-400">
                                                {station.model_status.training_info.val_rmse?.toFixed(4) || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                <Icon name="analytics" size="xs" />
                                                {t('models.mae')}
                                            </span>
                                            <span className="text-primary-400">
                                                {station.model_status.training_info.val_mae?.toFixed(4) || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                <Icon name="dataset" size="xs" />
                                                {t('models.trainingSamples')}
                                            </span>
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
                                        <div className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-500'}`}>
                                            <Icon name="check" size="xs" />
                                            {t('models.validData')}
                                        </div>
                                        <div className={`font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>{station.data_status.valid_points}</div>
                                    </div>
                                    <div className={`rounded p-2 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-500'}`}>
                                            <Icon name="auto_fix_high" size="xs" />
                                            {t('models.imputed')}
                                        </div>
                                        <div className="text-warning-400 font-medium">{station.data_status.imputed_points}</div>
                                    </div>
                                    <div className={`rounded p-2 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-500'}`}>
                                            <Icon name="cancel" size="xs" />
                                            {t('models.missing')}
                                        </div>
                                        <div className="text-danger-400 font-medium">{station.data_status.missing_points}</div>
                                    </div>
                                    <div className={`rounded p-2 ${isLight ? 'bg-gray-100' : 'bg-dark-800'}`}>
                                        <div className={`flex items-center gap-1 ${isLight ? 'text-gray-500' : 'text-dark-500'}`}>
                                            <Icon name="database" size="xs" />
                                            {t('models.total')}
                                        </div>
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
                                    disabled={trainingStation === station.station_id}
                                    className="flex-1"
                                >
                                    <Icon name="model_training" size="xs" />
                                    {station.model_status.has_model ? t('models.retrain') : t('models.train')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate(`/?station=${station.station_id}`)}
                                    className="flex-1"
                                >
                                    <Icon name="show_chart" size="xs" />
                                    {t('models.viewChart')}
                                </Button>
                                {/* Fill Gaps button - always shown when model is ready for gap filling */}
                                {station.gap_fill_ready && (
                                    <Button
                                        size="sm"
                                        variant={
                                            station.data_status.missing_points === 0
                                                ? "success"
                                                : filledStations.has(station.station_id)
                                                    ? "primary"
                                                    : "secondary"
                                        }
                                        onClick={() => handleFillGaps(station.station_id)}
                                        loading={imputingStation === station.station_id}
                                        disabled={imputingStation === station.station_id || station.data_status.missing_points === 0}
                                        className="flex-1"
                                    >
                                        <Icon name="auto_fix_high" size="xs" />
                                        {station.data_status.missing_points === 0
                                            ? 'Complete'
                                            : filledStations.has(station.station_id)
                                                ? 'Filled'
                                                : 'Fill Gaps'}
                                    </Button>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>

                {filteredStations.length === 0 && (
                    <Card className="p-12 text-center">
                        <Icon name="search_off" size="2xl" color="muted" className="mb-4" />
                        <p className={isLight ? 'text-gray-500' : 'text-dark-400'}>{t('models.noStations')}</p>
                    </Card>
                )}
            </main>
        </div>
    )
}
