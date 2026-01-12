/**
 * Admin Monitoring Page
 * Monitor data update status and compare Air4Thai data with database
 * Redesigned with improved readability and theme support
 */
import { useState, useEffect } from 'react'
import { Button, Card, Badge, Spinner, Icon } from '../components/atoms'
import { useLanguage, useTheme, useToast } from '../contexts'
import api from '../services/api'

interface DataSummary {
    health_status?: string
    synced_stations?: number
    total_stations_tested?: number
    sync_rate_percentage?: number
}

interface LastIngestion {
    run_type?: string
    started_at?: string
    status?: string
    records_inserted?: number
}

interface StationComparison {
    station_id: string
    station_name_th?: string
    station_name_en?: string
    air4thai_value: number | null
    air4thai_time?: string
    db_value: number | null
    db_time?: string
    is_synced: boolean
    time_diff_minutes?: number
    error?: boolean
}

interface DataStatusResponse {
    summary: DataSummary
    last_ingestion: LastIngestion
    station_comparisons?: StationComparison[]
}

interface IngestionLog {
    id: number
    run_type: string
    station_id?: string
    started_at: string
    records_inserted?: number
    missing_detected?: number
    status: string
}

interface SchedulerJob {
    id?: string
    name?: string
    next_run?: string
    trigger?: string
}

interface SchedulerStatus {
    is_running: boolean
    jobs?: SchedulerJob[]
}

// Tab configuration
type TabId = 'overview' | 'comparison' | 'scheduler' | 'logs'

export default function Admin(): React.ReactElement {
    const [dataStatus, setDataStatus] = useState<DataStatusResponse | null>(null)
    const [ingestionLogs, setIngestionLogs] = useState<IngestionLog[]>([])
    const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [refreshing, setRefreshing] = useState<boolean>(false)
    const [triggeringIngestion, setTriggeringIngestion] = useState<boolean>(false)
    const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
    const [activeTab, setActiveTab] = useState<TabId>('overview')

    const { t, lang } = useLanguage()
    const { isLight } = useTheme()
    const { toast } = useToast()

    const fetchDataStatus = async (isAutoRefresh: boolean = false): Promise<void> => {
        try {
            if (!isAutoRefresh) {
                setRefreshing(true)
            }
            const [status, logs, scheduler] = await Promise.all([
                api.get<DataStatusResponse>('/admin/data-status?sample_size=10'),
                api.get<IngestionLog[]>('/ingest/logs?limit=10'),
                api.get<SchedulerStatus>('/scheduler/status')
            ])
            setDataStatus(status)
            setIngestionLogs(logs)
            setSchedulerStatus(scheduler)
        } catch (err) {
            console.error('Failed to fetch admin data:', err)
            if (!isAutoRefresh) {
                toast.error('Failed to fetch monitoring data')
            }
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        fetchDataStatus()
    }, [])

    // Auto-refresh every 30 seconds if enabled
    useEffect(() => {
        if (!autoRefresh) return

        const interval = setInterval(() => {
            fetchDataStatus(true)
        }, 30000)

        return () => clearInterval(interval)
    }, [autoRefresh])

    const handleTriggerIngestion = async (): Promise<void> => {
        try {
            setTriggeringIngestion(true)
            await api.post('/scheduler/trigger/hourly')
            toast.success('Hourly data ingestion triggered successfully')

            // Wait 3 seconds then refresh
            setTimeout(() => {
                fetchDataStatus()
            }, 3000)
        } catch (err) {
            console.error('Failed to trigger ingestion:', err)
            toast.error('Failed to trigger ingestion')
        } finally {
            setTriggeringIngestion(false)
        }
    }

    const getHealthColor = (status?: string): 'success' | 'warning' | 'danger' | 'secondary' => {
        switch (status) {
            case 'healthy': return 'success'
            case 'degraded': return 'warning'
            case 'critical': return 'danger'
            default: return 'secondary'
        }
    }

    const getHealthIcon = (status?: string): string => {
        switch (status) {
            case 'healthy': return 'check_circle'
            case 'degraded': return 'warning'
            case 'critical': return 'error'
            default: return 'help'
        }
    }

    const formatDateTime = (dateStr?: string): string => {
        if (!dateStr) return 'N/A'
        const date = new Date(dateStr)
        return date.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatTimeAgo = (dateStr?: string): string => {
        if (!dateStr) return 'N/A'
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return lang === 'th' ? 'เมื่อสักครู่' : 'Just now'
        if (diffMins < 60) return `${diffMins} ${lang === 'th' ? 'นาทีที่แล้ว' : 'min ago'}`
        if (diffHours < 24) return `${diffHours} ${lang === 'th' ? 'ชั่วโมงที่แล้ว' : 'hr ago'}`
        return `${diffDays} ${lang === 'th' ? 'วันที่แล้ว' : 'day(s) ago'}`
    }

    const summary = dataStatus?.summary || {} as DataSummary
    const lastIngestion = dataStatus?.last_ingestion || {} as LastIngestion

    // Tab configuration
    const tabs = [
        { id: 'overview' as TabId, label: lang === 'th' ? 'ภาพรวม' : 'Overview', icon: 'dashboard' },
        { id: 'comparison' as TabId, label: lang === 'th' ? 'เปรียบเทียบข้อมูล' : 'Data Comparison', icon: 'compare_arrows' },
        { id: 'scheduler' as TabId, label: lang === 'th' ? 'ตัวจัดกำหนดการ' : 'Scheduler', icon: 'event_repeat' },
        { id: 'logs' as TabId, label: lang === 'th' ? 'ประวัติการดึงข้อมูล' : 'Ingestion Logs', icon: 'history' }
    ]

    // Theme-aware classes
    const textPrimary = isLight ? 'text-gray-900' : 'text-white'
    const textSecondary = isLight ? 'text-gray-600' : 'text-gray-300'
    const textMuted = isLight ? 'text-gray-500' : 'text-gray-400'
    const bgCard = isLight ? 'bg-white border border-gray-200' : 'bg-dark-800 border border-dark-700'
    const bgCardHover = isLight ? 'hover:bg-gray-50' : 'hover:bg-dark-700/50'
    const bgTableHeader = isLight ? 'bg-gray-50' : 'bg-dark-800/80'
    const bgTableRow = isLight ? 'bg-white' : 'bg-dark-800/30'
    const bgTableRowAlt = isLight ? 'bg-gray-50/50' : 'bg-dark-800/50'
    const borderColor = isLight ? 'border-gray-200' : 'border-dark-700'

    return (
        <div className="p-4 lg:p-6">
            {loading ? (
                <div className={`${bgCard} rounded-xl p-12`}>
                    <div className="flex flex-col items-center justify-center gap-3">
                        <Spinner />
                        <p className={textMuted}>
                            {lang === 'th' ? 'กำลังดึงข้อมูลสถานะ...' : 'Fetching status data...'}
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        <Button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            variant={autoRefresh ? 'success' : 'secondary'}
                            icon={autoRefresh ? 'pause' : 'play_arrow'}
                        >
                            {lang === 'th' ? (autoRefresh ? 'หยุดอัตโนมัติ' : 'รีเฟรชอัตโนมัติ') : (autoRefresh ? 'Stop Auto' : 'Auto Refresh')}
                        </Button>
                        <Button
                            onClick={() => fetchDataStatus()}
                            variant="secondary"
                            icon="refresh"
                            loading={refreshing}
                        >
                            {lang === 'th' ? 'รีเฟรช' : 'Refresh'}
                        </Button>
                        <Button
                            onClick={handleTriggerIngestion}
                            variant="primary"
                            icon="cloud_download"
                            loading={triggeringIngestion}
                        >
                            {lang === 'th' ? 'ดึงข้อมูลใหม่' : 'Trigger Ingestion'}
                        </Button>
                    </div>

                    {/* Tab Menu */}
                    <div className={`${bgCard} rounded-xl mb-6`}>
                        <nav className="flex overflow-x-auto p-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                            flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm whitespace-nowrap transition-all
                                            ${activeTab === tab.id
                                            ? 'bg-primary-500 text-white shadow-md'
                                            : isLight
                                                ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                                : 'text-gray-400 hover:bg-dark-700 hover:text-white'
                                        }
                                        `}
                                >
                                    <Icon name={tab.icon} size="sm" />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                {/* System Health */}
                                <div className={`${bgCard} rounded-xl p-5`}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${summary.health_status === 'healthy'
                                            ? 'bg-green-100 text-green-600'
                                            : summary.health_status === 'degraded'
                                                ? 'bg-yellow-100 text-yellow-600'
                                                : 'bg-red-100 text-red-600'
                                            }`}>
                                            <Icon name={getHealthIcon(summary.health_status)} />
                                        </div>
                                        <div>
                                            <p className={`text-xs ${textMuted}`}>{lang === 'th' ? 'สถานะระบบ' : 'System Health'}</p>
                                            <p className={`font-bold capitalize ${summary.health_status === 'healthy'
                                                ? 'text-green-600'
                                                : summary.health_status === 'degraded'
                                                    ? 'text-yellow-600'
                                                    : 'text-red-600'
                                                }`}>
                                                {summary.health_status || 'unknown'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Synced Stations */}
                                <div className={`${bgCard} rounded-xl p-5`}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                                            <Icon name="sync" />
                                        </div>
                                        <div>
                                            <p className={`text-xs ${textMuted}`}>{lang === 'th' ? 'สถานีที่ซิงค์' : 'Synced Stations'}</p>
                                            <p className={`font-bold text-lg ${textPrimary}`}>
                                                {summary.synced_stations || 0}/{summary.total_stations_tested || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Sync Rate */}
                                <div className={`${bgCard} rounded-xl p-5`}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(summary.sync_rate_percentage || 0) >= 80
                                            ? 'bg-green-100 text-green-600'
                                            : 'bg-yellow-100 text-yellow-600'
                                            }`}>
                                            <Icon name="percent" />
                                        </div>
                                        <div>
                                            <p className={`text-xs ${textMuted}`}>{lang === 'th' ? 'อัตราการซิงค์' : 'Sync Rate'}</p>
                                            <p className={`font-bold text-lg ${(summary.sync_rate_percentage || 0) >= 80
                                                ? 'text-green-600'
                                                : 'text-yellow-600'
                                                }`}>
                                                {summary.sync_rate_percentage || 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Last Update */}
                                <div className={`${bgCard} rounded-xl p-5`}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">
                                            <Icon name="schedule" />
                                        </div>
                                        <div>
                                            <p className={`text-xs ${textMuted}`}>{lang === 'th' ? 'อัพเดทล่าสุด' : 'Last Update'}</p>
                                            <p className={`font-bold ${textPrimary}`}>
                                                {formatTimeAgo(lastIngestion.started_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Last Ingestion Info */}
                            {lastIngestion && (
                                <div className={`${bgCard} rounded-xl p-6 mb-6`}>
                                    <h2 className={`text-lg font-bold ${textPrimary} mb-4 flex items-center gap-2`}>
                                        <Icon name="cloud_sync" className="text-primary-500" />
                                        {lang === 'th' ? 'การดึงข้อมูลล่าสุด' : 'Last Ingestion'}
                                    </h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div>
                                            <p className={`text-sm ${textMuted} mb-1`}>{lang === 'th' ? 'ประเภท' : 'Type'}</p>
                                            <p className={`font-semibold ${textPrimary}`}>{lastIngestion.run_type || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className={`text-sm ${textMuted} mb-1`}>{lang === 'th' ? 'เวลาที่เริ่ม' : 'Started At'}</p>
                                            <p className={`font-semibold ${textPrimary}`}>{formatDateTime(lastIngestion.started_at)}</p>
                                        </div>
                                        <div>
                                            <p className={`text-sm ${textMuted} mb-1`}>{lang === 'th' ? 'สถานะ' : 'Status'}</p>
                                            <Badge variant={lastIngestion.status === 'completed' ? 'success' : lastIngestion.status === 'running' ? 'info' : 'danger'}>
                                                {lastIngestion.status || 'N/A'}
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className={`text-sm ${textMuted} mb-1`}>{lang === 'th' ? 'บันทึกที่เพิ่ม' : 'Records Inserted'}</p>
                                            <p className={`font-semibold text-lg ${textPrimary}`}>{lastIngestion.records_inserted || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Comparison Tab */}
                    {activeTab === 'comparison' && (
                        <div className={`${bgCard} rounded-xl overflow-hidden`}>
                            <div className={`p-6 border-b ${borderColor}`}>
                                <h2 className={`text-lg font-bold ${textPrimary} flex items-center gap-2`}>
                                    <Icon name="compare_arrows" className="text-primary-500" />
                                    {lang === 'th' ? 'เปรียบเทียบข้อมูล Air4Thai vs Database' : 'Air4Thai vs Database Comparison'}
                                </h2>
                                <p className={`text-sm ${textMuted} mt-1`}>
                                    {lang === 'th'
                                        ? 'เปรียบเทียบข้อมูลล่าสุดจาก Air4Thai กับฐานข้อมูล'
                                        : 'Comparison of latest data from Air4Thai with database'}
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className={bgTableHeader}>
                                        <tr className={`text-left text-sm ${textMuted}`}>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'สถานี' : 'Station'}</th>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'PM2.5 (Air4Thai)' : 'PM2.5 (Air4Thai)'}</th>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'เวลา (Air4Thai)' : 'Time (Air4Thai)'}</th>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'PM2.5 (Database)' : 'PM2.5 (Database)'}</th>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'เวลา (Database)' : 'Time (Database)'}</th>
                                            <th className="p-4 font-semibold text-center">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dataStatus?.station_comparisons?.map((station, idx) => (
                                            <tr
                                                key={station.station_id}
                                                className={`border-t ${borderColor} ${bgCardHover} transition-colors ${idx % 2 === 0 ? bgTableRow : bgTableRowAlt}`}
                                            >
                                                <td className="p-4">
                                                    <div>
                                                        <p className={`font-medium ${textPrimary}`}>{lang === 'th' ? station.station_name_th : station.station_name_en}</p>
                                                        <p className={`text-xs ${textMuted}`}>{station.station_id}</p>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {station.error ? (
                                                        <span className="text-red-500 text-sm font-medium">Error</span>
                                                    ) : station.air4thai_value !== null ? (
                                                        <span className={`font-semibold ${textPrimary}`}>{station.air4thai_value.toFixed(1)}</span>
                                                    ) : (
                                                        <span className={textMuted}>N/A</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-sm ${textSecondary}`}>
                                                        {station.air4thai_time ? formatDateTime(station.air4thai_time) : 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {station.db_value !== null ? (
                                                        <span className={`font-semibold ${textPrimary}`}>{station.db_value.toFixed(1)}</span>
                                                    ) : (
                                                        <span className={textMuted}>N/A</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-sm ${textSecondary}`}>
                                                        {station.db_time ? formatDateTime(station.db_time) : 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {station.error ? (
                                                        <Badge variant="danger">
                                                            <Icon name="error" size="sm" /> Error
                                                        </Badge>
                                                    ) : station.is_synced ? (
                                                        <Badge variant="success">
                                                            <Icon name="check_circle" size="sm" /> {lang === 'th' ? 'ซิงค์แล้ว' : 'Synced'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="warning">
                                                            <Icon name="warning" size="sm" /> {lang === 'th' ? 'ไม่ตรงกัน' : 'Out of Sync'}
                                                        </Badge>
                                                    )}
                                                    {station.time_diff_minutes !== null && station.time_diff_minutes !== undefined && (
                                                        <p className={`text-xs ${textMuted} mt-1`}>
                                                            {station.time_diff_minutes.toFixed(0)} {lang === 'th' ? 'นาที' : 'min'}
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Scheduler Tab */}
                    {activeTab === 'scheduler' && schedulerStatus && (
                        <div className={`${bgCard} rounded-xl p-6`}>
                            <h2 className={`text-lg font-bold ${textPrimary} mb-4 flex items-center gap-2`}>
                                <Icon name="event_repeat" className="text-primary-500" />
                                {lang === 'th' ? 'สถานะตัวจัดกำหนดการ' : 'Scheduler Status'}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <p className={`text-sm ${textMuted} mb-2`}>{lang === 'th' ? 'สถานะ' : 'Status'}</p>
                                    <Badge variant={schedulerStatus.is_running ? 'success' : 'danger'}>
                                        {schedulerStatus.is_running ? (lang === 'th' ? 'กำลังทำงาน' : 'Running') : (lang === 'th' ? 'หยุด' : 'Stopped')}
                                    </Badge>
                                </div>
                                <div>
                                    <p className={`text-sm ${textMuted} mb-2`}>{lang === 'th' ? 'งานที่กำหนดไว้' : 'Scheduled Jobs'}</p>
                                    <p className={`font-semibold text-lg ${textPrimary}`}>{schedulerStatus.jobs?.length || 0} jobs</p>
                                </div>
                            </div>

                            {/* Scheduler Jobs List */}
                            {schedulerStatus.jobs && schedulerStatus.jobs.length > 0 && (
                                <div>
                                    <h3 className={`text-md font-semibold ${textPrimary} mb-3`}>
                                        {lang === 'th' ? 'รายการงานที่กำหนดไว้' : 'Scheduled Jobs'}
                                    </h3>
                                    <div className="space-y-3">
                                        {schedulerStatus.jobs.map((job, idx) => (
                                            <div key={idx} className={`p-4 rounded-lg ${isLight ? 'bg-gray-50 border border-gray-100' : 'bg-dark-700/50 border border-dark-600'}`}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className={`font-medium ${textPrimary}`}>{job.name || job.id}</p>
                                                        {job.next_run && (
                                                            <p className={`text-sm ${textMuted} mt-1`}>
                                                                {lang === 'th' ? 'รันครั้งต่อไป: ' : 'Next run: '}
                                                                {formatDateTime(job.next_run)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Badge variant="info">{job.trigger || 'scheduled'}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Logs Tab */}
                    {activeTab === 'logs' && (
                        <div className={`${bgCard} rounded-xl overflow-hidden`}>
                            <div className={`p-6 border-b ${borderColor}`}>
                                <h2 className={`text-lg font-bold ${textPrimary} flex items-center gap-2`}>
                                    <Icon name="history" className="text-primary-500" />
                                    {lang === 'th' ? 'ประวัติการดึงข้อมูล' : 'Recent Ingestion Logs'}
                                </h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className={bgTableHeader}>
                                        <tr className={`text-left text-sm ${textMuted}`}>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'ประเภท' : 'Type'}</th>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'สถานี' : 'Station'}</th>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'เวลาที่เริ่ม' : 'Started At'}</th>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'บันทึกที่เพิ่ม' : 'Records'}</th>
                                            <th className="p-4 font-semibold">{lang === 'th' ? 'ข้อมูลขาด' : 'Missing'}</th>
                                            <th className="p-4 font-semibold text-center">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ingestionLogs.slice(0, 10).map((log, idx) => (
                                            <tr
                                                key={log.id}
                                                className={`border-t ${borderColor} ${bgCardHover} transition-colors ${idx % 2 === 0 ? bgTableRow : bgTableRowAlt}`}
                                            >
                                                <td className="p-4">
                                                    <span className={textSecondary}>{log.run_type}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={textSecondary}>{log.station_id || 'All'}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-sm ${textSecondary}`}>{formatDateTime(log.started_at)}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`font-semibold ${textPrimary}`}>{log.records_inserted || 0}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-orange-500 font-medium">{log.missing_detected || 0}</span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Badge variant={
                                                        log.status === 'completed' ? 'success' :
                                                            log.status === 'running' ? 'info' :
                                                                log.status === 'failed' ? 'danger' : 'secondary'
                                                    }>
                                                        {log.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
