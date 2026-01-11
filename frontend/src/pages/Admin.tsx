/**
 * Admin Monitoring Page
 * Monitor data update status and compare Air4Thai data with database
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Badge, Spinner, Icon } from '../components/atoms'
import { StatCard } from '../components/molecules'
import { Navbar } from '../components/organisms'
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

export default function Admin(): React.ReactElement {
    const [dataStatus, setDataStatus] = useState<DataStatusResponse | null>(null)
    const [ingestionLogs, setIngestionLogs] = useState<IngestionLog[]>([])
    const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [refreshing, setRefreshing] = useState<boolean>(false)
    const [triggeringIngestion, setTriggeringIngestion] = useState<boolean>(false)
    const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'scheduler' | 'logs'>('overview')

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

    return (
        <div className="min-h-screen gradient-dark">
            <Navbar
                title={lang === 'th' ? 'การตรวจสอบระบบ' : 'Admin Monitoring'}
                subtitle={lang === 'th' ? 'ตรวจสอบสถานะและความสมบูรณ์ของข้อมูล' : 'Monitor data status and integrity'}
            >
                <Link
                    to="/"
                    className={`transition flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="arrow_back" size="sm" />
                    {lang === 'th' ? 'กลับไปแดชบอร์ด' : 'Back to Dashboard'}
                </Link>
                <Link
                    to="/models"
                    className={`transition flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="psychology" size="sm" />
                    {lang === 'th' ? 'โมเดล' : 'Models'}
                </Link>
            </Navbar>

            <main className="max-w-7xl mx-auto px-4 py-6">{loading ? (
                    <>
                        {/* Loading State with Small Spinner */}
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">
                                    {lang === 'th' ? 'การตรวจสอบข้อมูล' : 'Data Monitoring'}
                                </h1>
                                <p className="text-gray-400">
                                    {lang === 'th'
                                        ? 'กำลังโหลดข้อมูล...'
                                        : 'Loading data...'}
                                </p>
                            </div>
                        </div>
                        <Card className="mb-6 p-12">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Spinner />
                                <p className="text-gray-400 text-sm">
                                    {lang === 'th' ? 'กำลังดึงข้อมูลสถานะ...' : 'Fetching status data...'}
                                </p>
                            </div>
                        </Card>
                    </>
                ) : (
                    <>
                {/* Header Actions */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {lang === 'th' ? 'การตรวจสอบข้อมูล' : 'Data Monitoring'}
                        </h1>
                        <p className="text-gray-400">
                            {lang === 'th'
                                ? 'ตรวจสอบสถานะการอัพเดทข้อมูลและเปรียบเทียบกับ Air4Thai'
                                : 'Monitor data update status and compare with Air4Thai'}
                        </p>
                    </div>
                    <div className="flex gap-3">
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
                </div>

                {/* Tab Menu */}
                <div className="mb-6">
                    <div className="border-b border-gray-700">
                        <nav className="-mb-px flex space-x-8 overflow-x-auto">
                            {[
                                { id: 'overview' as const, label: lang === 'th' ? 'ภาพรวม' : 'Overview', icon: 'dashboard' },
                                { id: 'comparison' as const, label: lang === 'th' ? 'เปรียบเทียบข้อมูล' : 'Data Comparison', icon: 'compare_arrows' },
                                { id: 'scheduler' as const, label: lang === 'th' ? 'ตัวจัดกำหนดการ' : 'Scheduler', icon: 'event_repeat' },
                                { id: 'logs' as const, label: lang === 'th' ? 'ประวัติการดึงข้อมูล' : 'Ingestion Logs', icon: 'history' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                                        ${activeTab === tab.id
                                            ? 'border-blue-500 text-blue-500'
                                            : isLight
                                                ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                                        }
                                    `}
                                >
                                    <Icon name={tab.icon} size="sm" />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        label={lang === 'th' ? 'สถานะระบบ' : 'System Health'}
                        value={summary.health_status || 'unknown'}
                        color={getHealthColor(summary.health_status)}
                        iconName="health_and_safety"
                    />
                    <StatCard
                        label={lang === 'th' ? 'สถานีที่ซิงค์' : 'Synced Stations'}
                        value={`${summary.synced_stations || 0}/${summary.total_stations_tested || 0}`}
                        color="primary"
                        iconName="sync"
                    />
                    <StatCard
                        label={lang === 'th' ? 'อัตราการซิงค์' : 'Sync Rate'}
                        value={`${summary.sync_rate_percentage || 0}%`}
                        color={summary.sync_rate_percentage && summary.sync_rate_percentage >= 80 ? 'success' : 'warning'}
                        iconName="percent"
                    />
                    <StatCard
                        label={lang === 'th' ? 'อัพเดทล่าสุด' : 'Last Update'}
                        value={formatTimeAgo(lastIngestion.started_at)}
                        color="default"
                        iconName="schedule"
                    />
                </div>

                {/* Last Ingestion Info */}
                {lastIngestion && (
                    <Card className="mb-6 p-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Icon name="cloud_sync" />
                            {lang === 'th' ? 'การดึงข้อมูลล่าสุด' : 'Last Ingestion'}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-gray-400 text-sm">{lang === 'th' ? 'ประเภท' : 'Type'}</p>
                                <p className="text-white font-semibold">{lastIngestion.run_type || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">{lang === 'th' ? 'เวลาที่เริ่ม' : 'Started At'}</p>
                                <p className="text-white font-semibold">{formatDateTime(lastIngestion.started_at)}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">{lang === 'th' ? 'สถานะ' : 'Status'}</p>
                                <Badge variant={lastIngestion.status === 'completed' ? 'success' : lastIngestion.status === 'running' ? 'info' : 'danger'}>
                                    {lastIngestion.status || 'N/A'}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">{lang === 'th' ? 'บันทึกที่เพิ่ม' : 'Records Inserted'}</p>
                                <p className="text-white font-semibold">{lastIngestion.records_inserted || 0}</p>
                            </div>
                        </div>
                    </Card>
                )}
                    </>
                )}

                {/* Comparison Tab */}
                {activeTab === 'comparison' && (
                    <>
                {/* Station Comparisons */}
                <Card className="mb-6">
                    <div className="p-6 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Icon name="compare_arrows" />
                            {lang === 'th' ? 'เปรียบเทียบข้อมูล Air4Thai vs Database' : 'Air4Thai vs Database Comparison'}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            {lang === 'th'
                                ? 'เปรียบเทียบข้อมูลล่าสุดจาก Air4Thai กับฐานข้อมูล'
                                : 'Comparison of latest data from Air4Thai with database'}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-800/50">
                                <tr className="text-left text-gray-400 text-sm">
                                    <th className="p-4">{lang === 'th' ? 'สถานี' : 'Station'}</th>
                                    <th className="p-4">{lang === 'th' ? 'PM2.5 (Air4Thai)' : 'PM2.5 (Air4Thai)'}</th>
                                    <th className="p-4">{lang === 'th' ? 'เวลา (Air4Thai)' : 'Time (Air4Thai)'}</th>
                                    <th className="p-4">{lang === 'th' ? 'PM2.5 (Database)' : 'PM2.5 (Database)'}</th>
                                    <th className="p-4">{lang === 'th' ? 'เวลา (Database)' : 'Time (Database)'}</th>
                                    <th className="p-4 text-center">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dataStatus?.station_comparisons?.map((station, idx) => (
                                    <tr
                                        key={station.station_id}
                                        className={`border-t border-gray-700 hover:bg-dark-700/30 transition-colors ${
                                            idx % 2 === 0 ? 'bg-dark-800/20' : ''
                                        }`}
                                    >
                                        <td className="p-4">
                                            <div>
                                                <p className="text-white font-medium">{lang === 'th' ? station.station_name_th : station.station_name_en}</p>
                                                <p className="text-gray-400 text-xs">{station.station_id}</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {station.error ? (
                                                <span className="text-red-400 text-sm">Error</span>
                                            ) : station.air4thai_value !== null ? (
                                                <span className="text-white font-semibold">{station.air4thai_value.toFixed(1)}</span>
                                            ) : (
                                                <span className="text-gray-500">N/A</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="text-gray-300 text-sm">
                                                {station.air4thai_time ? formatDateTime(station.air4thai_time) : 'N/A'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {station.db_value !== null ? (
                                                <span className="text-white font-semibold">{station.db_value.toFixed(1)}</span>
                                            ) : (
                                                <span className="text-gray-500">N/A</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="text-gray-300 text-sm">
                                                {station.db_time ? formatDateTime(station.db_time) : 'N/A'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {station.error ? (
                                                <Badge variant="danger">
                                                    <Icon name="error" size="small" /> Error
                                                </Badge>
                                            ) : station.is_synced ? (
                                                <Badge variant="success">
                                                    <Icon name="check_circle" size="small" /> {lang === 'th' ? 'ซิงค์แล้ว' : 'Synced'}
                                                </Badge>
                                            ) : (
                                                <Badge variant="warning">
                                                    <Icon name="warning" size="small" /> {lang === 'th' ? 'ไม่ตรงกัน' : 'Out of Sync'}
                                                </Badge>
                                            )}
                                            {station.time_diff_minutes !== null && station.time_diff_minutes !== undefined && (
                                                <p className="text-gray-400 text-xs mt-1">
                                                    {station.time_diff_minutes.toFixed(0)} {lang === 'th' ? 'นาที' : 'min'}
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
                    </>
                )}

                {/* Scheduler Tab */}
                {activeTab === 'scheduler' && (
                    <>
                {/* Scheduler Status */}
                {schedulerStatus && (
                    <Card className="mb-6 p-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Icon name="event_repeat" />
                            {lang === 'th' ? 'สถานะตัวจัดกำหนดการ' : 'Scheduler Status'}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <p className="text-gray-400 text-sm">{lang === 'th' ? 'สถานะ' : 'Status'}</p>
                                <Badge variant={schedulerStatus.is_running ? 'success' : 'danger'}>
                                    {schedulerStatus.is_running ? (lang === 'th' ? 'กำลังทำงาน' : 'Running') : (lang === 'th' ? 'หยุด' : 'Stopped')}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">{lang === 'th' ? 'งานที่กำหนดไว้' : 'Scheduled Jobs'}</p>
                                <p className="text-white font-semibold">{schedulerStatus.jobs?.length || 0} jobs</p>
                            </div>
                        </div>

                        {/* Scheduler Jobs List */}
                        {schedulerStatus.jobs && schedulerStatus.jobs.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-3">
                                    {lang === 'th' ? 'รายการงานที่กำหนดไว้' : 'Scheduled Jobs'}
                                </h3>
                                <div className="space-y-3">
                                    {schedulerStatus.jobs.map((job, idx) => (
                                        <div key={idx} className="p-4 bg-dark-800/50 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-white font-medium">{job.name || job.id}</p>
                                                    {job.next_run && (
                                                        <p className="text-gray-400 text-sm mt-1">
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
                    </Card>
                )}
                    </>
                )}

                {/* Logs Tab */}
                {activeTab === 'logs' && (
                    <>
                {/* Recent Ingestion Logs */}
                <Card className="mb-6">
                    <div className="p-6 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Icon name="history" />
                            {lang === 'th' ? 'ประวัติการดึงข้อมูล' : 'Recent Ingestion Logs'}
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-800/50">
                                <tr className="text-left text-gray-400 text-sm">
                                    <th className="p-4">{lang === 'th' ? 'ประเภท' : 'Type'}</th>
                                    <th className="p-4">{lang === 'th' ? 'สถานี' : 'Station'}</th>
                                    <th className="p-4">{lang === 'th' ? 'เวลาที่เริ่ม' : 'Started At'}</th>
                                    <th className="p-4">{lang === 'th' ? 'บันทึกที่เพิ่ม' : 'Records'}</th>
                                    <th className="p-4">{lang === 'th' ? 'ข้อมูลขาด' : 'Missing'}</th>
                                    <th className="p-4 text-center">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ingestionLogs.slice(0, 10).map((log, idx) => (
                                    <tr
                                        key={log.id}
                                        className={`border-t border-gray-700 hover:bg-dark-700/30 transition-colors ${
                                            idx % 2 === 0 ? 'bg-dark-800/20' : ''
                                        }`}
                                    >
                                        <td className="p-4">
                                            <span className="text-gray-300">{log.run_type}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-gray-300">{log.station_id || 'All'}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-gray-300 text-sm">{formatDateTime(log.started_at)}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-white font-semibold">{log.records_inserted || 0}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-orange-400">{log.missing_detected || 0}</span>
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
                </Card>
                    </>
                )}
                    </>
                )}
            </main>
        </div>
    )
}
