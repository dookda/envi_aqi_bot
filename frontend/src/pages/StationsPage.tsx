/**
 * Station Management Page
 * Manage stations - view, edit, delete stations and their data
 */
import { useState, useEffect } from 'react'
import { Button, Card, Badge, Spinner, Icon } from '../components/atoms'
import { useLanguage, useTheme, useToast } from '../contexts'
import api from '../services/api'

interface Station {
    station_id: string
    name_th: string
    name_en: string
    lat: number
    lon: number
    station_type: string
    created_at: string | null
    updated_at: string | null
    total_records: number
    first_record: string | null
    last_record: string | null
    pm25_count: number
    pm10_count: number
}

interface StationsResponse {
    total: number
    stations: Station[]
}

interface DeleteResult {
    success: boolean
    message: string
    station_id: string
    data_records_deleted?: number
    records_deleted?: number
}

interface EditFormData {
    name_th: string
    name_en: string
    lat: string
    lon: string
    station_type: string
}

export default function StationsPage(): React.ReactElement {
    const [stations, setStations] = useState<Station[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [selectedStation, setSelectedStation] = useState<Station | null>(null)
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
    const [showDeleteDataModal, setShowDeleteDataModal] = useState<boolean>(false)
    const [showEditModal, setShowEditModal] = useState<boolean>(false)
    const [deleting, setDeleting] = useState<boolean>(false)
    const [editForm, setEditForm] = useState<EditFormData>({
        name_th: '',
        name_en: '',
        lat: '',
        lon: '',
        station_type: ''
    })

    const { lang } = useLanguage()
    const { isLight } = useTheme()
    const { toast } = useToast()

    const fetchStations = async (): Promise<void> => {
        try {
            setLoading(true)
            const response = await api.get<StationsResponse>('/stations/manage')
            setStations(response.stations || [])
        } catch (err) {
            console.error('Failed to fetch stations:', err)
            toast.error('Failed to fetch stations')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStations()
    }, [])

    const handleDeleteStation = async (): Promise<void> => {
        if (!selectedStation) return

        try {
            setDeleting(true)
            const result = await api.delete<DeleteResult>(`/stations/${selectedStation.station_id}?delete_data=true`)
            toast.success(result.message || `Station ${selectedStation.station_id} deleted`)
            setShowDeleteModal(false)
            setSelectedStation(null)
            fetchStations()
        } catch (err: any) {
            console.error('Failed to delete station:', err)
            toast.error(err.message || 'Failed to delete station')
        } finally {
            setDeleting(false)
        }
    }

    const handleDeleteData = async (): Promise<void> => {
        if (!selectedStation) return

        try {
            setDeleting(true)
            const result = await api.delete<DeleteResult>(`/stations/${selectedStation.station_id}/data`)
            toast.success(result.message || `Data deleted for station ${selectedStation.station_id}`)
            setShowDeleteDataModal(false)
            setSelectedStation(null)
            fetchStations()
        } catch (err: any) {
            console.error('Failed to delete data:', err)
            toast.error(err.message || 'Failed to delete data')
        } finally {
            setDeleting(false)
        }
    }

    const handleEditStation = async (): Promise<void> => {
        if (!selectedStation) return

        try {
            setDeleting(true)
            const params = new URLSearchParams()
            if (editForm.name_th) params.append('name_th', editForm.name_th)
            if (editForm.name_en) params.append('name_en', editForm.name_en)
            if (editForm.lat) params.append('lat', editForm.lat)
            if (editForm.lon) params.append('lon', editForm.lon)
            if (editForm.station_type) params.append('station_type', editForm.station_type)

            await api.put(`/stations/${selectedStation.station_id}?${params.toString()}`)
            toast.success(`Station ${selectedStation.station_id} updated`)
            setShowEditModal(false)
            setSelectedStation(null)
            fetchStations()
        } catch (err: any) {
            console.error('Failed to update station:', err)
            toast.error(err.message || 'Failed to update station')
        } finally {
            setDeleting(false)
        }
    }

    const openEditModal = (station: Station): void => {
        setSelectedStation(station)
        setEditForm({
            name_th: station.name_th || '',
            name_en: station.name_en || '',
            lat: station.lat?.toString() || '',
            lon: station.lon?.toString() || '',
            station_type: station.station_type || ''
        })
        setShowEditModal(true)
    }

    const formatDateTime = (dateStr: string | null): string => {
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

    const formatNumber = (num: number): string => {
        return num.toLocaleString()
    }

    // Filter stations based on search
    const filteredStations = stations.filter(station => {
        const query = searchQuery.toLowerCase()
        return (
            station.station_id.toLowerCase().includes(query) ||
            (station.name_th || '').toLowerCase().includes(query) ||
            (station.name_en || '').toLowerCase().includes(query) ||
            (station.station_type || '').toLowerCase().includes(query)
        )
    })

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
    const inputBg = isLight ? 'bg-white border-gray-300' : 'bg-dark-700 border-dark-600'

    return (
        <div className="p-4 lg:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textPrimary} flex items-center gap-2`}>
                        <Icon name="location_on" className="text-primary-500" />
                        {lang === 'th' ? 'จัดการสถานี' : 'Station Management'}
                    </h1>
                    <p className={`text-sm ${textMuted} mt-1`}>
                        {lang === 'th'
                            ? 'จัดการสถานีตรวจวัดคุณภาพอากาศทั้งหมด'
                            : 'Manage all air quality monitoring stations'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={fetchStations}
                        variant="secondary"
                        icon="refresh"
                        loading={loading}
                    >
                        {lang === 'th' ? 'รีเฟรช' : 'Refresh'}
                    </Button>
                </div>
            </div>

            {/* Search and Stats */}
            <div className={`${bgCard} rounded-xl p-4 mb-6`}>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Icon name="search" size="sm" className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={lang === 'th' ? 'ค้นหาสถานี...' : 'Search stations...'}
                                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${inputBg} ${textPrimary} focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-lg ${isLight ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
                            <span className={`text-sm ${textMuted}`}>{lang === 'th' ? 'ทั้งหมด: ' : 'Total: '}</span>
                            <span className={`font-bold text-blue-600`}>{stations.length}</span>
                        </div>
                        <div className={`px-4 py-2 rounded-lg ${isLight ? 'bg-green-50' : 'bg-green-900/20'}`}>
                            <span className={`text-sm ${textMuted}`}>{lang === 'th' ? 'แสดง: ' : 'Showing: '}</span>
                            <span className={`font-bold text-green-600`}>{filteredStations.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stations Table */}
            {loading ? (
                <div className={`${bgCard} rounded-xl p-12`}>
                    <div className="flex flex-col items-center justify-center gap-3">
                        <Spinner />
                        <p className={textMuted}>
                            {lang === 'th' ? 'กำลังโหลดข้อมูลสถานี...' : 'Loading stations...'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className={`${bgCard} rounded-xl overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className={bgTableHeader}>
                                <tr className={`text-left text-sm ${textMuted}`}>
                                    <th className="p-4 font-semibold">{lang === 'th' ? 'รหัสสถานี' : 'Station ID'}</th>
                                    <th className="p-4 font-semibold">{lang === 'th' ? 'ชื่อ' : 'Name'}</th>
                                    <th className="p-4 font-semibold">{lang === 'th' ? 'ประเภท' : 'Type'}</th>
                                    <th className="p-4 font-semibold">{lang === 'th' ? 'พิกัด' : 'Location'}</th>
                                    <th className="p-4 font-semibold text-right">{lang === 'th' ? 'จำนวนข้อมูล' : 'Records'}</th>
                                    <th className="p-4 font-semibold">{lang === 'th' ? 'ช่วงเวลา' : 'Date Range'}</th>
                                    <th className="p-4 font-semibold text-center">{lang === 'th' ? 'จัดการ' : 'Actions'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStations.map((station, idx) => (
                                    <tr
                                        key={station.station_id}
                                        className={`border-t ${borderColor} ${bgCardHover} transition-colors ${idx % 2 === 0 ? bgTableRow : bgTableRowAlt}`}
                                    >
                                        <td className="p-4">
                                            <span className={`font-mono font-semibold ${textPrimary}`}>{station.station_id}</span>
                                        </td>
                                        <td className="p-4">
                                            <div>
                                                <p className={`font-medium ${textPrimary}`}>{lang === 'th' ? station.name_th : station.name_en}</p>
                                                <p className={`text-xs ${textMuted}`}>{lang === 'th' ? station.name_en : station.name_th}</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant={
                                                station.station_type === 'urban' ? 'info' :
                                                    station.station_type === 'industrial' ? 'warning' :
                                                        station.station_type === 'unknown' ? 'secondary' : 'success'
                                            }>
                                                {station.station_type || 'unknown'}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-sm ${textSecondary}`}>
                                                {station.lat?.toFixed(4)}, {station.lon?.toFixed(4)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div>
                                                <p className={`font-bold ${textPrimary}`}>{formatNumber(station.total_records)}</p>
                                                <p className={`text-xs ${textMuted}`}>
                                                    PM2.5: {formatNumber(station.pm25_count)} | PM10: {formatNumber(station.pm10_count)}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {station.first_record ? (
                                                <div>
                                                    <p className={`text-sm ${textSecondary}`}>{formatDateTime(station.first_record)}</p>
                                                    <p className={`text-xs ${textMuted}`}>→ {formatDateTime(station.last_record)}</p>
                                                </div>
                                            ) : (
                                                <span className={textMuted}>No data</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(station)}
                                                    className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/30 text-blue-400'}`}
                                                    title={lang === 'th' ? 'แก้ไข' : 'Edit'}
                                                >
                                                    <Icon name="edit" size="sm" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedStation(station); setShowDeleteDataModal(true) }}
                                                    className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-orange-100 text-orange-600' : 'hover:bg-orange-900/30 text-orange-400'}`}
                                                    title={lang === 'th' ? 'ลบข้อมูล' : 'Delete Data'}
                                                >
                                                    <Icon name="delete_sweep" size="sm" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedStation(station); setShowDeleteModal(true) }}
                                                    className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/30 text-red-400'}`}
                                                    title={lang === 'th' ? 'ลบสถานี' : 'Delete Station'}
                                                >
                                                    <Icon name="delete_forever" size="sm" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredStations.length === 0 && (
                        <div className="p-12 text-center">
                            <Icon name="search_off" size="lg" className={textMuted} />
                            <p className={`mt-4 ${textMuted}`}>
                                {lang === 'th' ? 'ไม่พบสถานีที่ตรงกัน' : 'No matching stations found'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Station Modal */}
            {showDeleteModal && selectedStation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className={`${bgCard} rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <Icon name="warning" className="text-red-600" />
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold ${textPrimary}`}>
                                    {lang === 'th' ? 'ยืนยันการลบสถานี' : 'Confirm Delete Station'}
                                </h3>
                                <p className={`text-sm ${textMuted}`}>
                                    {lang === 'th' ? 'การดำเนินการนี้ไม่สามารถย้อนกลับได้' : 'This action cannot be undone'}
                                </p>
                            </div>
                        </div>

                        <div className={`p-4 rounded-lg mb-6 ${isLight ? 'bg-red-50' : 'bg-red-900/20'}`}>
                            <p className={`text-sm ${textSecondary} mb-2`}>
                                {lang === 'th' ? 'คุณกำลังจะลบ:' : 'You are about to delete:'}
                            </p>
                            <p className={`font-bold ${textPrimary}`}>{selectedStation.station_id}</p>
                            <p className={`text-sm ${textMuted}`}>{selectedStation.name_en}</p>
                            <p className={`text-sm text-red-600 mt-2 font-medium`}>
                                {lang === 'th'
                                    ? `รวมถึงข้อมูล ${formatNumber(selectedStation.total_records)} รายการ`
                                    : `Including ${formatNumber(selectedStation.total_records)} data records`}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => { setShowDeleteModal(false); setSelectedStation(null) }}
                                variant="secondary"
                                className="flex-1"
                            >
                                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                            </Button>
                            <Button
                                onClick={handleDeleteStation}
                                variant="danger"
                                loading={deleting}
                                icon="delete_forever"
                                className="flex-1"
                            >
                                {lang === 'th' ? 'ลบสถานี' : 'Delete Station'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Data Modal */}
            {showDeleteDataModal && selectedStation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className={`${bgCard} rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                                <Icon name="delete_sweep" className="text-orange-600" />
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold ${textPrimary}`}>
                                    {lang === 'th' ? 'ยืนยันการลบข้อมูล' : 'Confirm Delete Data'}
                                </h3>
                                <p className={`text-sm ${textMuted}`}>
                                    {lang === 'th' ? 'ลบข้อมูลทั้งหมด แต่เก็บสถานีไว้' : 'Delete all data, keep station'}
                                </p>
                            </div>
                        </div>

                        <div className={`p-4 rounded-lg mb-6 ${isLight ? 'bg-orange-50' : 'bg-orange-900/20'}`}>
                            <p className={`text-sm ${textSecondary} mb-2`}>
                                {lang === 'th' ? 'สถานี:' : 'Station:'}
                            </p>
                            <p className={`font-bold ${textPrimary}`}>{selectedStation.station_id}</p>
                            <p className={`text-sm ${textMuted}`}>{selectedStation.name_en}</p>
                            <p className={`text-sm text-orange-600 mt-2 font-medium`}>
                                {lang === 'th'
                                    ? `จะลบข้อมูล ${formatNumber(selectedStation.total_records)} รายการ`
                                    : `Will delete ${formatNumber(selectedStation.total_records)} data records`}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => { setShowDeleteDataModal(false); setSelectedStation(null) }}
                                variant="secondary"
                                className="flex-1"
                            >
                                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                            </Button>
                            <Button
                                onClick={handleDeleteData}
                                variant="warning"
                                loading={deleting}
                                icon="delete_sweep"
                                className="flex-1"
                            >
                                {lang === 'th' ? 'ลบข้อมูล' : 'Delete Data'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Station Modal */}
            {showEditModal && selectedStation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className={`${bgCard} rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <Icon name="edit" className="text-blue-600" />
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold ${textPrimary}`}>
                                    {lang === 'th' ? 'แก้ไขสถานี' : 'Edit Station'}
                                </h3>
                                <p className={`text-sm ${textMuted}`}>{selectedStation.station_id}</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>
                                        {lang === 'th' ? 'ชื่อ (อังกฤษ)' : 'Name (English)'}
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.name_en}
                                        onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })}
                                        className={`w-full px-3 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:ring-2 focus:ring-primary-500`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>
                                        {lang === 'th' ? 'ชื่อ (ไทย)' : 'Name (Thai)'}
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.name_th}
                                        onChange={(e) => setEditForm({ ...editForm, name_th: e.target.value })}
                                        className={`w-full px-3 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:ring-2 focus:ring-primary-500`}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>
                                        {lang === 'th' ? 'ละติจูด' : 'Latitude'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={editForm.lat}
                                        onChange={(e) => setEditForm({ ...editForm, lat: e.target.value })}
                                        className={`w-full px-3 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:ring-2 focus:ring-primary-500`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>
                                        {lang === 'th' ? 'ลองจิจูด' : 'Longitude'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={editForm.lon}
                                        onChange={(e) => setEditForm({ ...editForm, lon: e.target.value })}
                                        className={`w-full px-3 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:ring-2 focus:ring-primary-500`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>
                                    {lang === 'th' ? 'ประเภทสถานี' : 'Station Type'}
                                </label>
                                <select
                                    value={editForm.station_type}
                                    onChange={(e) => setEditForm({ ...editForm, station_type: e.target.value })}
                                    className={`w-full px-3 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:ring-2 focus:ring-primary-500`}
                                >
                                    <option value="urban">Urban</option>
                                    <option value="industrial">Industrial</option>
                                    <option value="rural">Rural</option>
                                    <option value="background">Background</option>
                                    <option value="unknown">Unknown</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => { setShowEditModal(false); setSelectedStation(null) }}
                                variant="secondary"
                                className="flex-1"
                            >
                                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                            </Button>
                            <Button
                                onClick={handleEditStation}
                                variant="primary"
                                loading={deleting}
                                icon="save"
                                className="flex-1"
                            >
                                {lang === 'th' ? 'บันทึก' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
