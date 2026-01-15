/**
 * Data Upload Page
 * Upload AQI data via API URL (JSON) or CSV file
 */
import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Badge, Spinner, Icon } from '../components/atoms'
import { Navbar } from '../components/organisms'
import { useLanguage, useTheme, useToast } from '../contexts'
import api from '../services/api'

interface UploadResult {
    success: boolean
    records_inserted: number
    records_updated: number
    records_failed: number
    errors?: string[]
    message?: string
}

interface PreviewData {
    columns: string[]
    rows: Record<string, any>[]
    total_rows: number
}

type UploadMode = 'api' | 'csv'

interface StationFormData {
    station_id: string
    name_th: string
    name_en: string
    lat: string
    lon: string
    station_type: string
}

export default function DataUpload(): React.ReactElement {
    const [mode, setMode] = useState<UploadMode>('api')
    const [apiUrl, setApiUrl] = useState<string>('')
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [previewData, setPreviewData] = useState<PreviewData | null>(null)
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Station form state - kept for compatibility but not used in simplified UI
    const [stationForm, setStationForm] = useState<StationFormData>({
        station_id: '',
        name_th: '',
        name_en: '',
        lat: '',
        lon: '',
        station_type: 'urban'
    })

    // CSV type detection: 'station' | 'aqi' | null
    const [csvType, setCsvType] = useState<'station' | 'aqi' | null>(null)

    const { t, lang } = useLanguage()
    const { isLight } = useTheme()
    const { toast } = useToast()

    // Sample API URL template
    const sampleApiUrl = 'http://air4thai.com/forweb/getHistoryData.php?stationID=35t&param=PM25,PM10,O3,CO,NO2,SO2,NOX,WS,WD,TEMP,RH,BP,RAIN&type=hr&sdate=2026-01-01&edate=2026-01-10&stime=00&etime=23'

    // Handle API URL fetch and preview
    const handleFetchApi = async () => {
        if (!apiUrl.trim()) {
            toast.error('Please enter an API URL')
            return
        }

        setLoading(true)
        setPreviewData(null)
        setUploadResult(null)

        try {
            const response = await api.post<{ preview: PreviewData }>('/upload/preview-api', {
                url: apiUrl
            })
            setPreviewData(response.preview)
            toast.success(`Fetched ${response.preview.total_rows} records from API`)
        } catch (err: any) {
            toast.error(err.message || 'Failed to fetch API data')
        } finally {
            setLoading(false)
        }
    }

    // Handle CSV file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (!file.name.endsWith('.csv')) {
                toast.error('Please select a CSV file')
                return
            }
            setCsvFile(file)
            setPreviewData(null)
            setUploadResult(null)
            handleCsvPreview(file)
        }
    }

    // Preview CSV file and detect type
    const handleCsvPreview = async (file: File) => {
        setLoading(true)
        setCsvType(null)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch(`${import.meta.env.BASE_URL}api/upload/preview-csv`.replace(/\/+/g, '/'), {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Failed to preview CSV')
            }

            const data = await response.json()
            setPreviewData(data.preview)

            // Auto-detect CSV type based on columns
            const columns = data.preview.columns.map((c: string) => c.toLowerCase())
            const stationColumns = ['lat', 'lon', 'name_en', 'name_th', 'station_type']
            const aqiColumns = ['datetime', 'pm25', 'pm10', 'o3', 'co', 'no2', 'so2', 'nox']

            const hasStationCols = stationColumns.some(col => columns.includes(col))
            const hasAqiCols = aqiColumns.some(col => columns.includes(col))

            if (hasStationCols && !hasAqiCols) {
                setCsvType('station')
                toast.success(`Detected Station CSV with ${data.preview.total_rows} records`)
            } else if (hasAqiCols) {
                setCsvType('aqi')
                toast.success(`Detected AQI Data CSV with ${data.preview.total_rows} records`)
            } else {
                setCsvType('aqi') // Default to AQI
                toast.info(`Loaded ${data.preview.total_rows} records - treating as AQI data`)
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to preview CSV file')
        } finally {
            setLoading(false)
        }
    }

    // Import data to database
    const handleImport = async () => {
        setLoading(true)
        setUploadResult(null)

        try {
            let response: UploadResult

            if (mode === 'api') {
                response = await api.post<UploadResult>('/upload/import-api', {
                    url: apiUrl
                })
            } else {
                if (!csvFile) {
                    toast.error('Please select a CSV file')
                    setLoading(false)
                    return
                }

                const formData = new FormData()
                formData.append('file', csvFile)

                // Use appropriate endpoint based on detected CSV type
                const endpoint = csvType === 'station'
                    ? `${import.meta.env.BASE_URL}api/upload/import-stations-csv`
                    : `${import.meta.env.BASE_URL}api/upload/import-csv`

                const res = await fetch(endpoint.replace(/\/+/g, '/'), {
                    method: 'POST',
                    body: formData
                })

                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.detail || 'Failed to import CSV')
                }

                response = await res.json()
            }

            setUploadResult(response)
            if (response.success) {
                toast.success(`Successfully imported ${response.records_inserted} records`)
            } else {
                toast.error(response.message || 'Import failed')
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to import data')
            setUploadResult({
                success: false,
                records_inserted: 0,
                records_updated: 0,
                records_failed: 0,
                message: err.message
            })
        } finally {
            setLoading(false)
        }
    }

    // Handle station form submission
    const handleStationSubmit = async () => {
        // Validate form
        if (!stationForm.station_id || !stationForm.name_en || !stationForm.lat || !stationForm.lon) {
            toast.error('Please fill in all required fields')
            return
        }

        // Validate coordinates
        const lat = parseFloat(stationForm.lat)
        const lon = parseFloat(stationForm.lon)
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            toast.error('Invalid latitude or longitude')
            return
        }

        setLoading(true)
        setUploadResult(null)

        try {
            // Create station data array
            const csvData = `station_id,name_th,name_en,lat,lon,station_type
${stationForm.station_id},${stationForm.name_th || stationForm.name_en},${stationForm.name_en},${stationForm.lat},${stationForm.lon},${stationForm.station_type}`

            const blob = new Blob([csvData], { type: 'text/csv' })
            const file = new File([blob], 'station.csv', { type: 'text/csv' })

            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch(`${import.meta.env.BASE_URL}api/upload/import-stations-csv`.replace(/\/+/g, '/'), {
                method: 'POST',
                body: formData
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.detail || 'Failed to add station')
            }

            const response = await res.json()
            setUploadResult(response)

            if (response.success) {
                toast.success(`Successfully added station: ${stationForm.station_id}`)
                // Reset form
                setStationForm({
                    station_id: '',
                    name_th: '',
                    name_en: '',
                    lat: '',
                    lon: '',
                    station_type: 'urban'
                })
            } else {
                toast.error(response.message || 'Failed to add station')
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to add station')
            setUploadResult({
                success: false,
                records_inserted: 0,
                records_updated: 0,
                records_failed: 0,
                message: err.message
            })
        } finally {
            setLoading(false)
        }
    }

    // Handle combined station + CSV upload
    const handleApplyAll = async () => {
        setLoading(true)
        setUploadResult(null)

        let stationResult: UploadResult | null = null
        let csvResult: UploadResult | null = null

        try {
            // Step 1: Create station if form is filled
            if (stationForm.station_id && stationForm.name_en && stationForm.lat && stationForm.lon) {
                const lat = parseFloat(stationForm.lat)
                const lon = parseFloat(stationForm.lon)

                if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    toast.error('Invalid latitude or longitude')
                    setLoading(false)
                    return
                }

                const csvData = `station_id,name_th,name_en,lat,lon,station_type
${stationForm.station_id},${stationForm.name_th || stationForm.name_en},${stationForm.name_en},${stationForm.lat},${stationForm.lon},${stationForm.station_type}`

                const blob = new Blob([csvData], { type: 'text/csv' })
                const file = new File([blob], 'station.csv', { type: 'text/csv' })

                const formData = new FormData()
                formData.append('file', file)

                const res = await fetch(`${import.meta.env.BASE_URL}api/upload/import-stations-csv`.replace(/\/+/g, '/'), {
                    method: 'POST',
                    body: formData
                })

                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.detail || 'Failed to add station')
                }

                stationResult = await res.json()
                if (stationResult?.success) {
                    toast.success(`Station ${stationForm.station_id} added successfully`)
                }
            }

            // Step 2: Import CSV data if file is selected
            if (csvFile) {
                const formData = new FormData()
                formData.append('file', csvFile)

                const endpoint = csvType === 'station'
                    ? `${import.meta.env.BASE_URL}api/upload/import-stations-csv`
                    : `${import.meta.env.BASE_URL}api/upload/import-csv`

                const res = await fetch(endpoint.replace(/\/+/g, '/'), {
                    method: 'POST',
                    body: formData
                })

                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.detail || 'Failed to import CSV')
                }

                csvResult = await res.json()
            }

            // Combine results
            const combinedResult: UploadResult = {
                success: true,
                records_inserted: (stationResult?.records_inserted || 0) + (csvResult?.records_inserted || 0),
                records_updated: (stationResult?.records_updated || 0) + (csvResult?.records_updated || 0),
                records_failed: (stationResult?.records_failed || 0) + (csvResult?.records_failed || 0),
                message: 'Import completed successfully'
            }

            setUploadResult(combinedResult)
            toast.success(`Successfully imported ${combinedResult.records_inserted} records`)

            // Reset form after success
            setStationForm({
                station_id: '',
                name_th: '',
                name_en: '',
                lat: '',
                lon: '',
                station_type: 'urban'
            })
            setCsvFile(null)
            setPreviewData(null)
            setCsvType(null)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }

        } catch (err: any) {
            toast.error(err.message || 'Failed to import data')
            setUploadResult({
                success: false,
                records_inserted: 0,
                records_updated: 0,
                records_failed: 0,
                message: err.message
            })
        } finally {
            setLoading(false)
        }
    }

    // Clear form
    const handleClear = () => {
        setApiUrl('')
        setCsvFile(null)
        setPreviewData(null)
        setUploadResult(null)
        setCsvType(null)
        setStationForm({
            station_id: '',
            name_th: '',
            name_en: '',
            lat: '',
            lon: '',
            station_type: 'urban'
        })
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const file = e.dataTransfer.files?.[0]
        if (file && file.name.endsWith('.csv')) {
            setCsvFile(file)
            setPreviewData(null)
            setUploadResult(null)
            handleCsvPreview(file)
        } else {
            toast.error('Please drop a CSV file')
        }
    }, [])

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-gray-900'}`} >

            <main className="container mx-auto px-4 py-6 max-w-6xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link to="/admin">
                            <Button variant="ghost" size="sm">
                                <Icon name="arrow_back" size="sm" className="mr-2" />
                                {lang === 'th' ? 'กลับ' : 'Back'}
                            </Button>
                        </Link>
                        <div>
                            <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                <Icon name="upload" size="md" className="inline mr-2" />
                                {lang === 'th' ? 'อัปโหลดข้อมูล' : 'Data Upload'}
                            </h1>
                            <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                {lang === 'th'
                                    ? 'นำเข้าข้อมูลจาก API หรือไฟล์ CSV'
                                    : 'Import data from API URL or CSV file'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Mode Selection Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => { setMode('api'); handleClear() }}
                        className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${mode === 'api'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : isLight
                                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                            }`}
                    >
                        <Icon name="link" size="sm" />
                        {lang === 'th' ? 'API URL (JSON)' : 'API URL (JSON)'}
                    </button>
                    <button
                        onClick={() => { setMode('csv'); handleClear() }}
                        className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${mode === 'csv'
                            ? 'bg-green-600 text-white shadow-lg'
                            : isLight
                                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                            }`}
                    >
                        <Icon name="description" size="sm" />
                        {lang === 'th' ? 'CSV Upload' : 'CSV Upload'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input Section */}
                    <Card className="p-6">
                        <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            {mode === 'api'
                                ? (lang === 'th' ? '1. กรอก URL ของ API' : '1. Enter API URL')
                                : (lang === 'th' ? 'อัปโหลดข้อมูล' : 'Upload Data')}
                        </h2>

                        {mode === 'api' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        API URL (JSON Format)
                                    </label>
                                    <textarea
                                        value={apiUrl}
                                        onChange={(e) => setApiUrl(e.target.value)}
                                        placeholder={sampleApiUrl}
                                        rows={4}
                                        className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isLight
                                            ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                            : 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                                            }`}
                                    />
                                </div>

                                <div className={`p-4 rounded-lg ${isLight ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
                                    <p className={`text-sm ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>
                                        <strong>{lang === 'th' ? 'ตัวอย่าง:' : 'Example:'}</strong>
                                    </p>
                                    <code className={`text-xs break-all ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                                        {sampleApiUrl}
                                    </code>
                                </div>

                                <Button
                                    onClick={handleFetchApi}
                                    disabled={loading || !apiUrl.trim()}
                                    className="w-full"
                                >
                                    {loading ? (
                                        <>
                                            <Spinner size="sm" className="mr-2" />
                                            {lang === 'th' ? 'กำลังดึงข้อมูล...' : 'Fetching...'}
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="download" size="sm" className="mr-2" />
                                            {lang === 'th' ? 'ดึงข้อมูลและดูตัวอย่าง' : 'Fetch & Preview'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Station Form Section */}
                                <div className={`border rounded-lg p-4 ${isLight ? 'bg-purple-50 border-purple-200' : 'bg-purple-900/20 border-purple-800'}`}>
                                    <h3 className={`text-md font-semibold mb-3 flex items-center ${isLight ? 'text-purple-900' : 'text-purple-300'}`}>
                                        <Icon name="add_location" size="sm" className="mr-2" />
                                        {lang === 'th' ? 'ข้อมูลสถานี (ไม่บังคับ)' : 'Station Info (Optional)'}
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    Station ID
                                                </label>
                                                <input
                                                    type="text"
                                                    value={stationForm.station_id}
                                                    onChange={(e) => setStationForm({ ...stationForm, station_id: e.target.value })}
                                                    placeholder="TEST01"
                                                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isLight
                                                        ? 'bg-white border-gray-300 text-gray-900'
                                                        : 'bg-gray-800 border-gray-600 text-white'
                                                        }`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    Station Type
                                                </label>
                                                <select
                                                    value={stationForm.station_type}
                                                    onChange={(e) => setStationForm({ ...stationForm, station_type: e.target.value })}
                                                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isLight
                                                        ? 'bg-white border-gray-300 text-gray-900'
                                                        : 'bg-gray-800 border-gray-600 text-white'
                                                        }`}
                                                >
                                                    <option value="urban">Urban</option>
                                                    <option value="industrial">Industrial</option>
                                                    <option value="rural">Rural</option>
                                                    <option value="background">Background</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    Name (English)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={stationForm.name_en}
                                                    onChange={(e) => setStationForm({ ...stationForm, name_en: e.target.value })}
                                                    placeholder="Test Station 1"
                                                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isLight
                                                        ? 'bg-white border-gray-300 text-gray-900'
                                                        : 'bg-gray-800 border-gray-600 text-white'
                                                        }`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    Name (Thai)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={stationForm.name_th}
                                                    onChange={(e) => setStationForm({ ...stationForm, name_th: e.target.value })}
                                                    placeholder="สถานีทดสอบ 1"
                                                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isLight
                                                        ? 'bg-white border-gray-300 text-gray-900'
                                                        : 'bg-gray-800 border-gray-600 text-white'
                                                        }`}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    Latitude
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={stationForm.lat}
                                                    onChange={(e) => setStationForm({ ...stationForm, lat: e.target.value })}
                                                    placeholder="13.7563"
                                                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isLight
                                                        ? 'bg-white border-gray-300 text-gray-900'
                                                        : 'bg-gray-800 border-gray-600 text-white'
                                                        }`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    Longitude
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={stationForm.lon}
                                                    onChange={(e) => setStationForm({ ...stationForm, lon: e.target.value })}
                                                    placeholder="100.5018"
                                                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isLight
                                                        ? 'bg-white border-gray-300 text-gray-900'
                                                        : 'bg-gray-800 border-gray-600 text-white'
                                                        }`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CSV Upload Section */}
                                <div className={`border rounded-lg p-4 ${isLight ? 'bg-green-50 border-green-200' : 'bg-green-900/20 border-green-800'}`}>
                                    <h3 className={`text-md font-semibold mb-3 flex items-center ${isLight ? 'text-green-900' : 'text-green-300'}`}>
                                        <Icon name="upload_file" size="sm" className="mr-2" />
                                        {lang === 'th' ? 'อัปโหลด AQI Data CSV (ไม่บังคับ)' : 'Upload AQI Data CSV (Optional)'}
                                    </h3>
                                    <div className="space-y-4">
                                        <div
                                            onDragOver={handleDragOver}
                                            onDrop={handleDrop}
                                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer hover:border-green-500 ${isLight
                                                ? 'border-gray-300 bg-white'
                                                : 'border-gray-600 bg-gray-800'
                                                }`}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Icon name="upload" size="md" className={`mx-auto mb-2 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                                            <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                                {lang === 'th'
                                                    ? 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก'
                                                    : 'Drag & drop CSV file here, or click to browse'}
                                            </p>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".csv"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                        </div>

                                        {csvFile && (
                                            <div className={`flex items-center justify-between p-3 rounded-lg ${isLight ? 'bg-green-100' : 'bg-green-900/30'}`}>
                                                <div className="flex items-center gap-2">
                                                    <Icon name="description" size="sm" className="text-green-600" />
                                                    <span className={`text-sm ${isLight ? 'text-green-700' : 'text-green-300'}`}>
                                                        {csvFile.name}
                                                    </span>
                                                    <Badge variant="success" size="sm">
                                                        {(csvFile.size / 1024).toFixed(1)} KB
                                                    </Badge>
                                                    {csvType && (
                                                        <Badge variant={csvType === 'station' ? 'warning' : 'info'} size="sm">
                                                            {csvType === 'station' ? 'Station' : 'AQI Data'}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => { setCsvFile(null); setPreviewData(null); setCsvType(null) }}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Icon name="close" size="sm" />
                                                </button>
                                            </div>
                                        )}

                                        <div className={`p-3 rounded-lg ${isLight ? 'bg-white border border-green-200' : 'bg-gray-800 border border-green-800'}`}>
                                            <p className={`text-xs font-medium mb-1 ${isLight ? 'text-green-700' : 'text-green-300'}`}>
                                                {lang === 'th' ? 'รูปแบบ CSV:' : 'CSV Format:'}
                                            </p>
                                            <code className={`text-[10px] ${isLight ? 'text-green-600' : 'text-green-400'}`}>
                                                station_id, datetime, pm25, pm10, o3, co, no2, so2, nox, temp, rh, ws, wd, bp, rain
                                            </code>
                                        </div>
                                    </div>
                                </div>

                                {/* Unified Apply Button */}
                                <Button
                                    onClick={handleApplyAll}
                                    disabled={loading || (!stationForm.station_id && !csvFile)}
                                    variant="primary"
                                    className="w-full py-3 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                >
                                    {loading ? (
                                        <>
                                            <Spinner size="sm" className="mr-2" />
                                            {lang === 'th' ? 'กำลังประมวลผล...' : 'Processing...'}
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="cloud_upload" size="sm" className="mr-2" />
                                            {lang === 'th' ? 'นำเข้าทั้งหมด' : 'Apply All'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </Card>

                    {/* Preview & Import Section */}
                    <Card className="p-6">
                        <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            {lang === 'th' ? '2. ตรวจสอบและนำเข้า' : '2. Review & Import'}
                        </h2>

                        {loading && !previewData && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Spinner size="lg" />
                                <p className={`mt-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'กำลังประมวลผล...' : 'Processing...'}
                                </p>
                            </div>
                        )}

                        {!loading && !previewData && (
                            <div className={`flex flex-col items-center justify-center py-12 ${isLight ? 'text-gray-400' : 'text-gray-600'}`}>
                                <Icon name="visibility" size="lg" className="mb-4" />
                                <p>{lang === 'th' ? 'ยังไม่มีข้อมูลตัวอย่าง' : 'No preview data yet'}</p>
                                <p className="text-sm mt-2">
                                    {mode === 'api'
                                        ? (lang === 'th' ? 'กรอก URL และคลิกดึงข้อมูล' : 'Enter URL and click Fetch')
                                        : (lang === 'th' ? 'เลือกไฟล์ CSV' : 'Select CSV file')}
                                </p>
                            </div>
                        )}

                        {previewData && (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className={`grid grid-cols-3 gap-4 p-4 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-gray-800'}`}>
                                    <div>
                                        <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {lang === 'th' ? 'จำนวนคอลัมน์' : 'Columns'}
                                        </p>
                                        <p className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                            {previewData.columns.length}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {lang === 'th' ? 'จำนวนแถว' : 'Total Rows'}
                                        </p>
                                        <p className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                            {previewData.total_rows.toLocaleString()}
                                        </p>
                                    </div>
                                    {csvType && (
                                        <div>
                                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {lang === 'th' ? 'ประเภท' : 'Type'}
                                            </p>
                                            <Badge
                                                variant={csvType === 'station' ? 'warning' : 'success'}
                                                size="sm"
                                                className="mt-1"
                                            >
                                                <Icon name={csvType === 'station' ? 'location_on' : 'air'} size="xs" className="mr-1" />
                                                {csvType === 'station'
                                                    ? (lang === 'th' ? 'Station' : 'Station')
                                                    : (lang === 'th' ? 'AQI Data' : 'AQI Data')}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {/* Columns */}
                                <div>
                                    <p className={`text-sm font-medium mb-2 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {lang === 'th' ? 'คอลัมน์ที่พบ:' : 'Detected Columns:'}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {previewData.columns.map((col) => (
                                            <Badge key={col} variant="info" size="sm">
                                                {col}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Sample Data */}
                                <div>
                                    <p className={`text-sm font-medium mb-2 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {lang === 'th' ? 'ตัวอย่างข้อมูล (5 แถวแรก):' : 'Sample Data (first 5 rows):'}
                                    </p>
                                    <div className="overflow-x-auto">
                                        <table className={`min-w-full text-xs ${isLight ? 'divide-gray-200' : 'divide-gray-700'}`}>
                                            <thead className={isLight ? 'bg-gray-100' : 'bg-gray-800'}>
                                                <tr>
                                                    {previewData.columns.slice(0, 6).map((col) => (
                                                        <th key={col} className={`px-2 py-1 text-left font-medium ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                                            {col}
                                                        </th>
                                                    ))}
                                                    {previewData.columns.length > 6 && (
                                                        <th className={`px-2 py-1 text-left ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            +{previewData.columns.length - 6} more
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className={isLight ? 'divide-y divide-gray-100' : 'divide-y divide-gray-800'}>
                                                {previewData.rows.slice(0, 5).map((row, idx) => (
                                                    <tr key={idx}>
                                                        {previewData.columns.slice(0, 6).map((col) => (
                                                            <td key={col} className={`px-2 py-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                                {row[col] ?? '-'}
                                                            </td>
                                                        ))}
                                                        {previewData.columns.length > 6 && (
                                                            <td className={`px-2 py-1 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>...</td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Import Button */}
                                <Button
                                    onClick={handleImport}
                                    disabled={loading}
                                    variant="primary"
                                    className="w-full mt-4"
                                >
                                    {loading ? (
                                        <>
                                            <Spinner size="sm" className="mr-2" />
                                            {lang === 'th' ? 'กำลังนำเข้า...' : 'Importing...'}
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="cloud_upload" size="sm" className="mr-2" />
                                            {lang === 'th'
                                                ? `นำเข้า ${previewData.total_rows.toLocaleString()} รายการ`
                                                : `Import ${previewData.total_rows.toLocaleString()} Records`}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Result Section */}
                {uploadResult && (
                    <Card className={`mt-6 p-6 ${uploadResult.success ? 'border-green-500' : 'border-red-500'} border-2`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-full ${uploadResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                <Icon name={uploadResult.success ? 'check_circle' : 'cancel'} size="md" />
                            </div>
                            <div className="flex-1">
                                <h3 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {uploadResult.success
                                        ? (lang === 'th' ? 'นำเข้าสำเร็จ!' : 'Import Successful!')
                                        : (lang === 'th' ? 'นำเข้าล้มเหลว' : 'Import Failed')}
                                </h3>

                                <div className="grid grid-cols-3 gap-4 mt-4">
                                    <div className={`p-3 rounded-lg ${isLight ? 'bg-green-50' : 'bg-green-900/20'}`}>
                                        <p className={`text-xs ${isLight ? 'text-green-600' : 'text-green-400'}`}>
                                            {lang === 'th' ? 'นำเข้าใหม่' : 'Inserted'}
                                        </p>
                                        <p className="text-2xl font-bold text-green-600">
                                            {uploadResult.records_inserted.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-lg ${isLight ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
                                        <p className={`text-xs ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                                            {lang === 'th' ? 'อัปเดต' : 'Updated'}
                                        </p>
                                        <p className="text-2xl font-bold text-blue-600">
                                            {uploadResult.records_updated.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-lg ${isLight ? 'bg-red-50' : 'bg-red-900/20'}`}>
                                        <p className={`text-xs ${isLight ? 'text-red-600' : 'text-red-400'}`}>
                                            {lang === 'th' ? 'ล้มเหลว' : 'Failed'}
                                        </p>
                                        <p className="text-2xl font-bold text-red-600">
                                            {uploadResult.records_failed.toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {uploadResult.errors && uploadResult.errors.length > 0 && (
                                    <div className={`mt-4 p-3 rounded-lg ${isLight ? 'bg-red-50' : 'bg-red-900/20'}`}>
                                        <p className={`text-sm font-medium mb-2 ${isLight ? 'text-red-700' : 'text-red-300'}`}>
                                            {lang === 'th' ? 'ข้อผิดพลาด:' : 'Errors:'}
                                        </p>
                                        <ul className={`text-xs space-y-1 ${isLight ? 'text-red-600' : 'text-red-400'}`}>
                                            {uploadResult.errors.slice(0, 5).map((err, idx) => (
                                                <li key={idx}>• {err}</li>
                                            ))}
                                            {uploadResult.errors.length > 5 && (
                                                <li>...and {uploadResult.errors.length - 5} more errors</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                )}
            </main>
        </div >
    )
}
