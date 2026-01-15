/**
 * Data Preparation Page
 * Upload raw CSV files and prepare them for the system
 */
import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card, Icon, Button } from '../components/atoms'
import { useLanguage, useTheme } from '../contexts'

interface PreviewData {
    success: boolean
    station_id: string
    statistics: {
        valid_records: number
        skipped_records: number
        calib_values_replaced: number
        samp_values_replaced: number
        total_special_values_cleaned: number
    }
    date_range: {
        start: string
        end: string
    }
    sample_data: Record<string, string>[]
    issues: string[]
    columns: string[]
}

const DataPreparationPage: React.FC = () => {
    const { lang } = useLanguage()
    const { isLight } = useTheme()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [isDragging, setIsDragging] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [previewData, setPreviewData] = useState<PreviewData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isDownloading, setIsDownloading] = useState(false)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const files = e.dataTransfer.files
        if (files.length > 0) {
            const file = files[0]
            if (file.name.endsWith('.csv')) {
                setSelectedFile(file)
                setError(null)
                setPreviewData(null)
            } else {
                setError(lang === 'th' ? 'กรุณาเลือกไฟล์ CSV เท่านั้น' : 'Please select a CSV file only')
            }
        }
    }, [lang])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const file = files[0]
            if (file.name.endsWith('.csv')) {
                setSelectedFile(file)
                setError(null)
                setPreviewData(null)
            } else {
                setError(lang === 'th' ? 'กรุณาเลือกไฟล์ CSV เท่านั้น' : 'Please select a CSV file only')
            }
        }
    }, [lang])

    const handlePreview = async () => {
        if (!selectedFile) return

        setIsLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)

            const response = await fetch('/ebot/api/prepare-csv/preview', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Failed to process file')
            }

            const data = await response.json()
            setPreviewData(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDownload = async () => {
        if (!selectedFile) return

        setIsDownloading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)

            const response = await fetch('/ebot/api/prepare-csv', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Failed to prepare file')
            }

            // Get filename from headers or use default
            const contentDisposition = response.headers.get('Content-Disposition')
            let filename = 'prepared_data.csv'
            if (contentDisposition) {
                const match = contentDisposition.match(/filename=([^;]+)/)
                if (match) filename = match[1]
            }

            // Download the file
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setIsDownloading(false)
        }
    }

    const handleReset = () => {
        setSelectedFile(null)
        setPreviewData(null)
        setError(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const columnMappings = [
        { from: 'Date & Time', to: 'datetime', format: 'YYYY-MM-DD HH:MM:SS' },
        { from: 'PM10', to: 'pm10', format: 'Numeric' },
        { from: 'PM2.5', to: 'pm25', format: 'Numeric' },
        { from: 'CO', to: 'co', format: 'Numeric' },
        { from: 'NO', to: 'no', format: 'Numeric' },
        { from: 'NO2', to: 'no2', format: 'Numeric' },
        { from: 'NOX', to: 'nox', format: 'Numeric' },
        { from: 'O3', to: 'o3', format: 'Numeric' },
        { from: 'SO2', to: 'so2', format: 'Numeric' },
        { from: 'WS', to: 'ws', format: 'Numeric' },
        { from: 'WD', to: 'wd', format: 'Numeric' },
        { from: 'Temp', to: 'temp', format: 'Numeric' },
        { from: 'RH', to: 'rh', format: 'Numeric' },
        { from: 'BP', to: 'bp', format: 'Numeric' },
        { from: 'RAIN', to: 'rain', format: 'Numeric' },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {lang === 'th' ? 'เตรียมข้อมูล' : 'Data Preparation'}
                    </h1>
                    <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                        {lang === 'th'
                            ? 'อัปโหลดไฟล์ CSV ดิบเพื่อแปลงเป็นรูปแบบที่ระบบรองรับ'
                            : 'Upload raw CSV files to convert them to system-compatible format'}
                    </p>
                </div>
                <Link to="/upload">
                    <Button variant="primary">
                        <Icon name="cloud_upload" size="sm" />
                        {lang === 'th' ? 'ไปที่หน้าอัปโหลด' : 'Go to Upload'}
                    </Button>
                </Link>
            </div>

            {/* Upload Section */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${isLight ? 'bg-blue-100' : 'bg-blue-900/30'}`}>
                        <Icon name="upload_file" className="text-blue-500" size="lg" />
                    </div>
                    <div>
                        <h2 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            {lang === 'th' ? 'อัปโหลดไฟล์ CSV ดิบ' : 'Upload Raw CSV File'}
                        </h2>
                        <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                            {lang === 'th' ? 'ไฟล์จากเครื่องตรวจวัดคุณภาพอากาศ' : 'File exported from air quality monitoring stations'}
                        </p>
                    </div>
                </div>

                {/* Drop Zone */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                        ${isDragging
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : isLight
                                ? 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                                : 'border-gray-600 hover:border-blue-500 hover:bg-gray-800'
                        }
                        ${selectedFile ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
                    `}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {selectedFile ? (
                        <div className="space-y-3">
                            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isLight ? 'bg-green-100' : 'bg-green-900/30'}`}>
                                <Icon name="description" size="xl" className="text-green-600" />
                            </div>
                            <div>
                                <p className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {selectedFile.name}
                                </p>
                                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                </p>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleReset()
                                }}
                                className={`text-sm px-3 py-1 rounded-md ${isLight ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                            >
                                <Icon name="close" size="sm" className="inline mr-1" />
                                {lang === 'th' ? 'เลือกไฟล์ใหม่' : 'Choose Different File'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isLight ? 'bg-gray-100' : 'bg-gray-700'}`}>
                                <Icon name="cloud_upload" size="xl" className={isLight ? 'text-gray-400' : 'text-gray-500'} />
                            </div>
                            <div>
                                <p className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {lang === 'th' ? 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก' : 'Drag and drop file here, or click to select'}
                                </p>
                                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'รองรับไฟล์ .csv เท่านั้น' : 'Supports .csv files only'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className={`mt-4 p-4 rounded-lg ${isLight ? 'bg-red-50 border border-red-200' : 'bg-red-900/20 border border-red-800'}`}>
                        <div className="flex items-center gap-2">
                            <Icon name="error" className="text-red-500" size="sm" />
                            <p className={`text-sm ${isLight ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {selectedFile && !previewData && (
                    <div className="mt-4 flex gap-3">
                        <Button
                            variant="primary"
                            onClick={handlePreview}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Icon name="hourglass_empty" size="sm" className="animate-spin" />
                                    {lang === 'th' ? 'กำลังประมวลผล...' : 'Processing...'}
                                </>
                            ) : (
                                <>
                                    <Icon name="preview" size="sm" />
                                    {lang === 'th' ? 'ตรวจสอบข้อมูล' : 'Preview Data'}
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </Card>

            {/* Preview Results */}
            {previewData && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isLight ? 'bg-green-100' : 'bg-green-900/30'}`}>
                                <Icon name="check_circle" className="text-green-500" size="lg" />
                            </div>
                            <div>
                                <h2 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {lang === 'th' ? 'ผลการตรวจสอบ' : 'Processing Results'}
                                </h2>
                                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Station ID: <span className="font-mono font-semibold text-blue-600">{previewData.station_id}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={handleReset}>
                                <Icon name="refresh" size="sm" />
                                {lang === 'th' ? 'เริ่มใหม่' : 'Start Over'}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleDownload}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <>
                                        <Icon name="hourglass_empty" size="sm" className="animate-spin" />
                                        {lang === 'th' ? 'กำลังดาวน์โหลด...' : 'Downloading...'}
                                    </>
                                ) : (
                                    <>
                                        <Icon name="download" size="sm" />
                                        {lang === 'th' ? 'ดาวน์โหลด CSV ที่แปลงแล้ว' : 'Download Prepared CSV'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Statistics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className={`p-4 rounded-lg ${isLight ? 'bg-green-50' : 'bg-green-900/20'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <Icon name="check" className="text-green-600" size="sm" />
                                <span className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'ข้อมูลที่ใช้ได้' : 'Valid Records'}
                                </span>
                            </div>
                            <p className={`text-2xl font-bold text-green-600`}>
                                {previewData.statistics.valid_records.toLocaleString()}
                            </p>
                        </div>
                        <div className={`p-4 rounded-lg ${isLight ? 'bg-orange-50' : 'bg-orange-900/20'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <Icon name="warning" className="text-orange-600" size="sm" />
                                <span className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'ข้ามไป' : 'Skipped'}
                                </span>
                            </div>
                            <p className={`text-2xl font-bold text-orange-600`}>
                                {previewData.statistics.skipped_records}
                            </p>
                        </div>
                        <div className={`p-4 rounded-lg ${isLight ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <Icon name="cleaning_services" className="text-blue-600" size="sm" />
                                <span className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'ค่าที่แก้ไข' : 'Values Cleaned'}
                                </span>
                            </div>
                            <p className={`text-2xl font-bold text-blue-600`}>
                                {previewData.statistics.total_special_values_cleaned}
                            </p>
                        </div>
                        <div className={`p-4 rounded-lg ${isLight ? 'bg-purple-50' : 'bg-purple-900/20'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <Icon name="date_range" className="text-purple-600" size="sm" />
                                <span className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {lang === 'th' ? 'ช่วงวันที่' : 'Date Range'}
                                </span>
                            </div>
                            <p className={`text-sm font-medium text-purple-600`}>
                                {previewData.date_range.start?.split(' ')[0]} → {previewData.date_range.end?.split(' ')[0]}
                            </p>
                        </div>
                    </div>

                    {/* Issues */}
                    {previewData.issues.length > 0 && (
                        <div className={`mb-6 p-4 rounded-lg ${isLight ? 'bg-yellow-50 border border-yellow-200' : 'bg-yellow-900/20 border border-yellow-800'}`}>
                            <div className="flex items-start gap-2">
                                <Icon name="info" className="text-yellow-600 shrink-0 mt-0.5" size="sm" />
                                <div>
                                    <p className={`text-sm font-medium mb-1 ${isLight ? 'text-yellow-800' : 'text-yellow-200'}`}>
                                        {lang === 'th' ? 'หมายเหตุ' : 'Notes'}
                                    </p>
                                    <ul className={`text-xs space-y-1 ${isLight ? 'text-yellow-700' : 'text-yellow-300'}`}>
                                        {previewData.issues.map((issue, idx) => (
                                            <li key={idx}>• {issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sample Data Preview */}
                    <div>
                        <h3 className={`text-sm font-semibold mb-3 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                            <Icon name="table_chart" className="inline mr-1 text-blue-500" size="sm" />
                            {lang === 'th' ? 'ตัวอย่างข้อมูลที่แปลงแล้ว' : 'Sample of Prepared Data'}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className={`w-full text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                <thead>
                                    <tr className={`border-b ${isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'}`}>
                                        {previewData.columns.slice(0, 8).map((col) => (
                                            <th key={col} className="px-3 py-2 text-left font-semibold">
                                                {col}
                                            </th>
                                        ))}
                                        <th className="px-3 py-2 text-left font-semibold">...</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.sample_data.map((row, idx) => (
                                        <tr key={idx} className={`border-b ${isLight ? 'border-gray-100' : 'border-gray-700'}`}>
                                            {previewData.columns.slice(0, 8).map((col) => (
                                                <td key={col} className="px-3 py-2 font-mono">
                                                    {row[col] || <span className="opacity-30">-</span>}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 opacity-50">...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Card>
            )}

            {/* What Gets Cleaned Section */}
            <Card className="p-6">
                <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    <Icon name="auto_fix_high" className="inline mr-2 text-blue-500" />
                    {lang === 'th' ? 'การแปลงข้อมูลอัตโนมัติ' : 'Automatic Data Transformations'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        {
                            icon: 'delete_sweep',
                            title: lang === 'th' ? 'ลบแถวที่ไม่ต้องการ' : 'Remove Unnecessary Rows',
                            desc: lang === 'th' ? 'ลบข้อมูลหัวตาราง, หน่วย, และสถิติท้ายไฟล์' : 'Removes header info, units row, and footer statistics',
                            color: 'red'
                        },
                        {
                            icon: 'schedule',
                            title: lang === 'th' ? 'แปลงรูปแบบวันที่' : 'Convert Date Format',
                            desc: lang === 'th' ? 'DD/MM/YYYY HH:MM → YYYY-MM-DD HH:MM:SS' : 'DD/MM/YYYY HH:MM → YYYY-MM-DD HH:MM:SS',
                            color: 'blue'
                        },
                        {
                            icon: 'find_replace',
                            title: lang === 'th' ? 'แทนที่ค่าพิเศษ' : 'Replace Special Values',
                            desc: lang === 'th' ? 'แปลง "Calib", "<Samp", "N/A" เป็นค่าว่าง' : 'Converts "Calib", "<Samp", "N/A" to empty values',
                            color: 'orange'
                        },
                        {
                            icon: 'label',
                            title: lang === 'th' ? 'เปลี่ยนชื่อคอลัมน์' : 'Rename Columns',
                            desc: lang === 'th' ? 'เปลี่ยนชื่อให้ตรงกับรูปแบบระบบ' : 'Renames columns to match system format',
                            color: 'green'
                        },
                        {
                            icon: 'add_circle',
                            title: lang === 'th' ? 'เพิ่ม Station ID' : 'Add Station ID',
                            desc: lang === 'th' ? 'เพิ่มคอลัมน์ station_id จากข้อมูลในไฟล์' : 'Extracts station ID from file header',
                            color: 'purple'
                        },
                        {
                            icon: 'text_format',
                            title: lang === 'th' ? 'แก้ไขการเข้ารหัส' : 'Fix Encoding',
                            desc: lang === 'th' ? 'รองรับหลายรูปแบบการเข้ารหัสไฟล์' : 'Supports multiple file encodings (UTF-8, etc.)',
                            color: 'cyan'
                        }
                    ].map((item, idx) => {
                        const colorClasses: Record<string, { bg: string; text: string }> = {
                            red: { bg: isLight ? 'bg-red-50' : 'bg-red-900/20', text: 'text-red-500' },
                            blue: { bg: isLight ? 'bg-blue-50' : 'bg-blue-900/20', text: 'text-blue-500' },
                            orange: { bg: isLight ? 'bg-orange-50' : 'bg-orange-900/20', text: 'text-orange-500' },
                            green: { bg: isLight ? 'bg-green-50' : 'bg-green-900/20', text: 'text-green-500' },
                            purple: { bg: isLight ? 'bg-purple-50' : 'bg-purple-900/20', text: 'text-purple-500' },
                            cyan: { bg: isLight ? 'bg-cyan-50' : 'bg-cyan-900/20', text: 'text-cyan-500' }
                        }
                        const c = colorClasses[item.color]

                        return (
                            <div key={idx} className={`p-4 rounded-lg ${c.bg}`}>
                                <div className="flex items-start gap-3">
                                    <Icon name={item.icon} className={c.text} />
                                    <div>
                                        <p className={`font-medium text-sm ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                            {item.title}
                                        </p>
                                        <p className={`text-xs mt-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </Card>

            {/* Column Mapping Reference */}
            <Card className="p-6">
                <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    <Icon name="table_chart" className="inline mr-2 text-blue-500" />
                    {lang === 'th' ? 'ตารางการแปลงชื่อคอลัมน์' : 'Column Mapping Reference'}
                </h3>
                <div className="overflow-x-auto">
                    <table className={`w-full text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                        <thead>
                            <tr className={`border-b ${isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'}`}>
                                <th className="px-4 py-3 text-left font-semibold">
                                    {lang === 'th' ? 'ชื่อเดิม' : 'Original Name'}
                                </th>
                                <th className="px-4 py-3 text-center">→</th>
                                <th className="px-4 py-3 text-left font-semibold">
                                    {lang === 'th' ? 'ชื่อใหม่' : 'System Name'}
                                </th>
                                <th className="px-4 py-3 text-left font-semibold">
                                    {lang === 'th' ? 'รูปแบบ' : 'Format'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {columnMappings.map((mapping, idx) => (
                                <tr key={idx} className={`border-b ${isLight ? 'border-gray-200' : 'border-gray-700'}`}>
                                    <td className="px-4 py-2 font-mono text-xs">{mapping.from}</td>
                                    <td className="px-4 py-2 text-center text-blue-500">→</td>
                                    <td className="px-4 py-2 font-mono text-xs text-blue-600 font-medium">{mapping.to}</td>
                                    <td className="px-4 py-2 text-xs opacity-75">{mapping.format}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Next Steps */}
            <Card className="p-6">
                <h3 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    <Icon name="arrow_forward" className="inline mr-2 text-green-500" />
                    {lang === 'th' ? 'ขั้นตอนถัดไป' : 'Next Steps'}
                </h3>
                <div className="space-y-3">
                    <Link to="/upload" className="block">
                        <div className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${isLight ? 'bg-blue-50 border-blue-200 hover:border-blue-300' : 'bg-blue-900/20 border-blue-800 hover:border-blue-700'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Icon name="cloud_upload" className="text-blue-500" />
                                    <div>
                                        <p className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                            {lang === 'th' ? 'อัปโหลดไฟล์ CSV ที่เตรียมแล้ว' : 'Upload Prepared CSV File'}
                                        </p>
                                        <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {lang === 'th' ? 'นำเข้าข้อมูลเข้าสู่ระบบ' : 'Import data into the system'}
                                        </p>
                                    </div>
                                </div>
                                <Icon name="chevron_right" className={isLight ? 'text-gray-400' : 'text-gray-600'} />
                            </div>
                        </div>
                    </Link>
                    <div className={`p-4 rounded-lg border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                        <div className="flex items-start gap-3">
                            <Icon name="info" className="text-blue-500 shrink-0" size="sm" />
                            <div>
                                <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    {lang === 'th'
                                        ? 'หลังจากอัปโหลด ระบบจะตรวจสอบความพร้อมในการเทรนโมเดลอัตโนมัติ หากข้อมูลไม่เพียงพอ ระบบจะใช้วิธี Linear Interpolation แทน'
                                        : 'After upload, the system will automatically check training readiness. If data is insufficient, the system will use Linear Interpolation instead.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    )
}

export default DataPreparationPage
