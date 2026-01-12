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

export default function DataUpload(): React.ReactElement {
    const [mode, setMode] = useState<UploadMode>('api')
    const [apiUrl, setApiUrl] = useState<string>('')
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [previewData, setPreviewData] = useState<PreviewData | null>(null)
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { t, lang } = useLanguage()
    const { isLight } = useTheme()
    const { toast } = useToast()

    // Sample API URL template
    const sampleApiUrl = 'http://air4thai.com/forweb/getHistoryData.php?stationID=35t&param=PM25,PM10,O3,CO,NO2,SO2,WS,WD,TEMP,RH,BP,RAIN&type=hr&sdate=2026-01-01&edate=2026-01-10&stime=00&etime=23'

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

    // Preview CSV file
    const handleCsvPreview = async (file: File) => {
        setLoading(true)
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
            toast.success(`Loaded ${data.preview.total_rows} records from CSV`)
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

                const res = await fetch(`${import.meta.env.BASE_URL}api/upload/import-csv`.replace(/\/+/g, '/'), {
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

    // Clear form
    const handleClear = () => {
        setApiUrl('')
        setCsvFile(null)
        setPreviewData(null)
        setUploadResult(null)
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
        <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-gray-900'}`}>

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
                                : (lang === 'th' ? '1. เลือกไฟล์ CSV' : '1. Select CSV File')}
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
                            <div className="space-y-4">
                                <div
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer hover:border-green-500 ${isLight
                                        ? 'border-gray-300 bg-gray-50'
                                        : 'border-gray-600 bg-gray-800'
                                        }`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Icon name="upload" size="lg" className={`mx-auto mb-4 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
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
                                    <div className={`flex items-center justify-between p-3 rounded-lg ${isLight ? 'bg-green-50' : 'bg-green-900/20'}`}>
                                        <div className="flex items-center gap-2">
                                            <Icon name="description" size="sm" className="text-green-600" />
                                            <span className={`text-sm ${isLight ? 'text-green-700' : 'text-green-300'}`}>
                                                {csvFile.name}
                                            </span>
                                            <Badge variant="success" size="sm">
                                                {(csvFile.size / 1024).toFixed(1)} KB
                                            </Badge>
                                        </div>
                                        <button
                                            onClick={() => { setCsvFile(null); setPreviewData(null) }}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Icon name="close" size="sm" />
                                        </button>
                                    </div>
                                )}

                                <div className={`p-4 rounded-lg ${isLight ? 'bg-green-50' : 'bg-green-900/20'}`}>
                                    <p className={`text-sm font-medium mb-2 ${isLight ? 'text-green-700' : 'text-green-300'}`}>
                                        {lang === 'th' ? 'รูปแบบ CSV ที่รองรับ:' : 'Expected CSV format:'}
                                    </p>
                                    <code className={`text-xs ${isLight ? 'text-green-600' : 'text-green-400'}`}>
                                        station_id, datetime, pm25, pm10, o3, co, no2, so2, temp, rh, ws, wd, bp, rain
                                    </code>
                                </div>
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
                                        : (lang === 'th' ? 'เลือกไฟล์ CSV' : 'Select a CSV file')}
                                </p>
                            </div>
                        )}

                        {previewData && (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className={`grid grid-cols-2 gap-4 p-4 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-gray-800'}`}>
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
        </div>
    )
}
