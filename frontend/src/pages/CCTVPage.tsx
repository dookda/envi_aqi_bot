/**
 * CCTV Monitoring Page - Environment Detection
 *
 * Features:
 * - Live video streaming from station CCTVs
 * - Real-time object detection (humans, cars, animals)
 * - Detection statistics and timeline
 * - Multi-station monitoring
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Card, Icon, Badge, Button } from '../components/atoms'
import { StationSelector } from '../components/molecules'
import { Navbar } from '../components/organisms'
import { useStations } from '../hooks'
import { useLanguage, useTheme } from '../contexts'
import type { Station } from '../types'

// Detection types and colors
const DETECTION_TYPES = {
    human: { label: 'Human', labelTh: 'คน', icon: 'person', color: '#3b82f6', emoji: '👤' },
    car: { label: 'Vehicle', labelTh: 'ยานพาหนะ', icon: 'directions_car', color: '#ef4444', emoji: '🚗' },
    motorcycle: { label: 'Motorcycle', labelTh: 'มอเตอร์ไซค์', icon: 'two_wheeler', color: '#f59e0b', emoji: '🏍️' },
    bicycle: { label: 'Bicycle', labelTh: 'จักรยาน', icon: 'directions_bike', color: '#10b981', emoji: '🚲' },
    animal: { label: 'Animal', labelTh: 'สัตว์', icon: 'pets', color: '#8b5cf6', emoji: '🐕' },
}

interface DetectionStats {
    human: number
    car: number
    motorcycle: number
    bicycle: number
    animal: number
    total: number
    timestamp: string
}

interface DetectionEvent {
    id: string
    type: keyof typeof DETECTION_TYPES
    confidence: number
    timestamp: string
    bbox?: { x: number; y: number; width: number; height: number }
}

export default function CCTVPage(): React.ReactElement {
    const { stations, loading: stationsLoading } = useStations()
    const { t, lang } = useLanguage()
    const { isLight } = useTheme()

    const [selectedStation, setSelectedStation] = useState<string>('')
    const [isStreaming, setIsStreaming] = useState<boolean>(false)
    const [detectionEnabled, setDetectionEnabled] = useState<boolean>(true)
    const [detectionStats, setDetectionStats] = useState<DetectionStats>({
        human: 0,
        car: 0,
        motorcycle: 0,
        bicycle: 0,
        animal: 0,
        total: 0,
        timestamp: new Date().toISOString(),
    })
    const [recentDetections, setRecentDetections] = useState<DetectionEvent[]>([])
    const [viewMode, setViewMode] = useState<'single' | 'grid'>('single')

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Auto-select first station
    useEffect(() => {
        if (stations.length > 0 && !selectedStation) {
            setSelectedStation(stations[0].station_id)
        }
    }, [stations, selectedStation])

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    // Simulate detection updates (replace with actual API)
    useEffect(() => {
        if (!isStreaming || !detectionEnabled) return

        const interval = setInterval(() => {
            // Simulate random detections
            const types: (keyof typeof DETECTION_TYPES)[] = ['human', 'car', 'motorcycle', 'bicycle', 'animal']
            const randomType = types[Math.floor(Math.random() * types.length)]

            setDetectionStats(prev => ({
                ...prev,
                [randomType]: prev[randomType] + 1,
                total: prev.total + 1,
                timestamp: new Date().toISOString(),
            }))

            // Add to recent detections
            const newDetection: DetectionEvent = {
                id: `det_${Date.now()}`,
                type: randomType,
                confidence: 0.75 + Math.random() * 0.24,
                timestamp: new Date().toISOString(),
            }

            setRecentDetections(prev => [newDetection, ...prev.slice(0, 9)])
        }, 3000 + Math.random() * 4000)

        return () => clearInterval(interval)
    }, [isStreaming, detectionEnabled])

    const handleStartStream = async () => {
        try {
            // Request access to camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            })

            // Store stream reference
            streamRef.current = stream

            // Attach stream to video element
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }

            setIsStreaming(true)
        } catch (error) {
            console.error('Error accessing camera:', error)
            alert(lang === 'th'
                ? 'ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์'
                : 'Cannot access camera. Please allow camera access in your browser.')
        }
    }

    const handleStopStream = () => {
        // Stop all tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }

        // Clear video element
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }

        setIsStreaming(false)
    }

    const resetStats = () => {
        setDetectionStats({
            human: 0,
            car: 0,
            motorcycle: 0,
            bicycle: 0,
            animal: 0,
            total: 0,
            timestamp: new Date().toISOString(),
        })
        setRecentDetections([])
    }

    const currentStation = stations.find(s => s.station_id === selectedStation)

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50' : 'gradient-dark'}`}>
            {/* Header */}
            <Navbar
                title={lang === 'th' ? '📹 กล้องตรวจจับสิ่งแวดล้อม' : '📹 CCTV Environmental Monitoring'}
                subtitle={currentStation ? (currentStation.name_en || currentStation.name_th) : (lang === 'th' ? 'เลือกสถานีเพื่อดูภาพจากกล้อง' : 'Select station to view camera feed')}
            >
                <Link
                    to="/"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="dashboard" size="sm" />
                    {t('dashboard.title')}
                </Link>
                <Link
                    to="/models"
                    className={`transition text-sm flex items-center gap-1 ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-dark-400 hover:text-white'}`}
                >
                    <Icon name="psychology" size="sm" />
                    {t('dashboard.modelsStatus')}
                </Link>
            </Navbar>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Controls Section */}
                <section className="mb-6">
                    <Card className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Station Selector */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                    <Icon name="location_on" size="sm" className="inline mr-1" />
                                    {lang === 'th' ? 'เลือกสถานี' : 'Select Station'}
                                </label>
                                <StationSelector
                                    stations={stations}
                                    value={selectedStation}
                                    onChange={setSelectedStation}
                                    loading={stationsLoading}
                                />
                            </div>

                            {/* View Mode */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                    <Icon name="view_module" size="sm" className="inline mr-1" />
                                    {lang === 'th' ? 'รูปแบบการแสดงผล' : 'View Mode'}
                                </label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={viewMode === 'single' ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => setViewMode('single')}
                                        className="flex-1"
                                    >
                                        <Icon name="crop_portrait" size="sm" />
                                        {lang === 'th' ? 'เดี่ยว' : 'Single'}
                                    </Button>
                                    <Button
                                        variant={viewMode === 'grid' ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => setViewMode('grid')}
                                        className="flex-1"
                                    >
                                        <Icon name="grid_view" size="sm" />
                                        {lang === 'th' ? 'กริด' : 'Grid'}
                                    </Button>
                                </div>
                            </div>

                            {/* Controls */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                    <Icon name="settings" size="sm" className="inline mr-1" />
                                    {lang === 'th' ? 'ควบคุม' : 'Controls'}
                                </label>
                                <div className="flex gap-2">
                                    {!isStreaming ? (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={handleStartStream}
                                            className="flex-1"
                                        >
                                            <Icon name="play_arrow" size="sm" />
                                            {lang === 'th' ? 'เริ่มถ่ายทอด' : 'Start Stream'}
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={handleStopStream}
                                            className="flex-1"
                                        >
                                            <Icon name="stop" size="sm" />
                                            {lang === 'th' ? 'หยุด' : 'Stop'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Detection Toggle */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="psychology" className="text-primary-500" />
                                <span className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                    {lang === 'th' ? 'ระบบตรวจจับอัตโนมัติ' : 'Automatic Detection System'}
                                </span>
                                <Badge variant={detectionEnabled ? 'success' : 'default'} size="sm">
                                    {detectionEnabled ? (lang === 'th' ? 'เปิด' : 'Enabled') : (lang === 'th' ? 'ปิด' : 'Disabled')}
                                </Badge>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetectionEnabled(!detectionEnabled)}
                            >
                                <Icon name={detectionEnabled ? 'visibility' : 'visibility_off'} size="sm" />
                                {detectionEnabled ? (lang === 'th' ? 'ปิด' : 'Disable') : (lang === 'th' ? 'เปิด' : 'Enable')}
                            </Button>
                        </div>
                    </Card>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Video Feed */}
                    <div className="lg:col-span-2">
                        <Card className="p-0 overflow-hidden">
                            <div className={`relative bg-black aspect-video ${isStreaming ? '' : 'flex items-center justify-center'}`}>
                                {isStreaming ? (
                                    <>
                                        {/* Video element (replace with actual stream) */}
                                        <video
                                            ref={videoRef}
                                            className="w-full h-full object-contain"
                                            autoPlay
                                            muted
                                            playsInline
                                        />
                                        {/* Detection overlay canvas */}
                                        <canvas
                                            ref={canvasRef}
                                            className="absolute inset-0 w-full h-full pointer-events-none"
                                        />
                                        {/* Live indicator */}
                                        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                            <span className="text-sm font-bold">LIVE</span>
                                        </div>
                                        {/* Detection count overlay */}
                                        {detectionEnabled && (
                                            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg backdrop-blur-sm">
                                                <div className="text-xs opacity-70">{lang === 'th' ? 'ตรวจพบ' : 'Detected'}</div>
                                                <div className="text-2xl font-bold">{detectionStats.total}</div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center p-12">
                                        <Icon name="videocam_off" size="2xl" className="text-gray-600 mb-4" />
                                        <p className="text-gray-400 mb-4">
                                            {lang === 'th'
                                                ? 'กดปุ่ม "เริ่มถ่ายทอด" เพื่อเปิดกล้องสาธิต'
                                                : 'Click "Start Stream" to start camera demo'}
                                        </p>
                                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/30 text-blue-300'}`}>
                                            <Icon name="camera" size="sm" />
                                            <span className="text-sm">
                                                {lang === 'th' ? 'จะใช้กล้องของคอมพิวเตอร์' : 'Will use your computer camera'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Info message */}
                            {isStreaming && (
                                <div className={`p-4 ${isLight ? 'bg-green-50 border-t border-green-200' : 'bg-green-900/20 border-t border-green-800/30'}`}>
                                    <div className="flex items-start gap-2">
                                        <Icon name="info" size="sm" className="text-green-500 mt-0.5" />
                                        <div>
                                            <p className={`text-sm ${isLight ? 'text-green-800' : 'text-green-300'}`}>
                                                <strong>{lang === 'th' ? 'Demo Mode:' : 'Demo Mode:'}</strong>{' '}
                                                {lang === 'th'
                                                    ? 'กำลังใช้กล้องของคอมพิวเตอร์เพื่อสาธิต ในการใช้งานจริงจะเชื่อมต่อกับกล้อง CCTV ที่สถานีตรวจวัดและรวมระบบ object detection (YOLO, TensorFlow)'
                                                    : 'Using your computer camera for demonstration. In production, this will connect to station CCTV cameras and integrate object detection systems (YOLO, TensorFlow)'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!isStreaming && (
                                <div className={`p-4 ${isLight ? 'bg-blue-50 border-t border-blue-200' : 'bg-blue-900/20 border-t border-blue-800/30'}`}>
                                    <div className="flex items-start gap-2">
                                        <Icon name="info" size="sm" className="text-blue-500 mt-0.5" />
                                        <div>
                                            <p className={`text-sm ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>
                                                <strong>{lang === 'th' ? 'หมายเหตุ:' : 'Note:'}</strong>{' '}
                                                {lang === 'th'
                                                    ? 'คลิก "เริ่มถ่ายทอด" เพื่อใช้กล้องของคอมพิวเตอร์สาธิตระบบ'
                                                    : 'Click "Start Stream" to use your computer camera for demonstration'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Detection Stats & Recent Detections */}
                    <div className="space-y-6">
                        {/* Detection Statistics */}
                        <Card className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                    <Icon name="analytics" size="sm" />
                                    {lang === 'th' ? 'สถิติการตรวจจับ' : 'Detection Stats'}
                                </h3>
                                <Button variant="ghost" size="sm" onClick={resetStats}>
                                    <Icon name="refresh" size="xs" />
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {(Object.keys(DETECTION_TYPES) as (keyof typeof DETECTION_TYPES)[]).map(type => {
                                    const config = DETECTION_TYPES[type]
                                    const count = detectionStats[type]
                                    const percentage = detectionStats.total > 0 ? (count / detectionStats.total) * 100 : 0

                                    return (
                                        <div key={type} className={`p-3 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-dark-700/50'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Icon name={config.icon} size="sm" style={{ color: config.color }} />
                                                    <span className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                                        {lang === 'th' ? config.labelTh : config.label}
                                                    </span>
                                                </div>
                                                <span className={`text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                                    {count}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-dark-600 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: config.color,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </Card>

                        {/* Recent Detections */}
                        <Card className="p-4">
                            <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                <Icon name="history" size="sm" />
                                {lang === 'th' ? 'การตรวจจับล่าสุด' : 'Recent Detections'}
                            </h3>

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {recentDetections.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Icon name="search_off" size="lg" className="text-gray-400 mb-2" />
                                        <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                            {lang === 'th' ? 'ยังไม่มีการตรวจจับ' : 'No detections yet'}
                                        </p>
                                    </div>
                                ) : (
                                    recentDetections.map(detection => {
                                        const config = DETECTION_TYPES[detection.type]
                                        const timeAgo = new Date(detection.timestamp).toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                        })

                                        return (
                                            <div
                                                key={detection.id}
                                                className={`flex items-center gap-3 p-2 rounded-lg ${isLight ? 'bg-gray-50 hover:bg-gray-100' : 'bg-dark-700/50 hover:bg-dark-700'} transition`}
                                            >
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                                    style={{ backgroundColor: `${config.color}20` }}
                                                >
                                                    <Icon name={config.icon} size="sm" style={{ color: config.color }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                                        {lang === 'th' ? config.labelTh : config.label}
                                                    </div>
                                                    <div className={`text-xs ${isLight ? 'text-gray-500' : 'text-dark-400'}`}>
                                                        {timeAgo} • {(detection.confidence * 100).toFixed(0)}% {lang === 'th' ? 'แม่นยำ' : 'conf'}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Implementation Guide */}
                <section className="mt-6">
                    <Card className={`p-6 ${isLight ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200' : 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-800/30'}`}>
                        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-purple-800' : 'text-purple-300'}`}>
                            <Icon name="integration_instructions" />
                            {lang === 'th' ? '🚀 คู่มือการติดตั้งระบบ' : '🚀 Implementation Guide'}
                        </h3>

                        <div className={`space-y-4 ${isLight ? 'text-purple-700' : 'text-purple-300/90'}`}>
                            <div className={`p-3 rounded-lg mb-4 ${isLight ? 'bg-green-100 border border-green-300' : 'bg-green-900/30 border border-green-700/30'}`}>
                                <p className="text-sm font-semibold mb-1">
                                    ✅ {lang === 'th' ? 'Demo ใช้งานได้แล้ว!' : 'Demo Ready!'}
                                </p>
                                <p className="text-xs">
                                    {lang === 'th'
                                        ? 'ระบบนี้ใช้กล้องของคอมพิวเตอร์เพื่อสาธิตการทำงาน คลิก "เริ่มถ่ายทอด" เพื่อทดสอบ'
                                        : 'This demo uses your computer camera. Click "Start Stream" to test the system'}
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">
                                    {lang === 'th' ? '1. เชื่อมต่อกล้อง CCTV จริง' : '1. Connect Real CCTV Stream'}
                                </h4>
                                <ul className="text-sm space-y-1 ml-4">
                                    <li>• {lang === 'th' ? 'รองรับ RTSP, HLS, WebRTC' : 'Support RTSP, HLS, WebRTC protocols'}</li>
                                    <li>• {lang === 'th' ? 'ใช้ FFmpeg สำหรับ streaming' : 'Use FFmpeg for streaming'}</li>
                                    <li>• {lang === 'th' ? 'ตั้งค่า CORS และ authentication' : 'Configure CORS and authentication'}</li>
                                    <li>• {lang === 'th' ? 'เปลี่ยนจาก getUserMedia() เป็น stream URL' : 'Replace getUserMedia() with stream URL'}</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">
                                    {lang === 'th' ? '2. รวมระบบ Object Detection' : '2. Integrate Object Detection'}
                                </h4>
                                <ul className="text-sm space-y-1 ml-4">
                                    <li>• <strong>YOLO v8/v9:</strong> {lang === 'th' ? 'รวดเร็วและแม่นยำ' : 'Fast and accurate'}</li>
                                    <li>• <strong>TensorFlow.js:</strong> {lang === 'th' ? 'รันบน browser' : 'Run in browser'}</li>
                                    <li>• <strong>OpenCV:</strong> {lang === 'th' ? 'สำหรับ backend processing' : 'For backend processing'}</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">
                                    {lang === 'th' ? '3. เพิ่ม Backend API' : '3. Add Backend API'}
                                </h4>
                                <ul className="text-sm space-y-1 ml-4">
                                    <li>• <code className="bg-purple-200 dark:bg-purple-900/50 px-1 rounded">POST /api/cctv/stream</code> - {lang === 'th' ? 'เริ่ม stream' : 'Start stream'}</li>
                                    <li>• <code className="bg-purple-200 dark:bg-purple-900/50 px-1 rounded">GET /api/cctv/detections</code> - {lang === 'th' ? 'ดึงข้อมูลการตรวจจับ' : 'Get detections'}</li>
                                    <li>• <code className="bg-purple-200 dark:bg-purple-900/50 px-1 rounded">WebSocket</code> - {lang === 'th' ? 'อัพเดทแบบ real-time' : 'Real-time updates'}</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">
                                    {lang === 'th' ? '4. บันทึกและวิเคราะห์' : '4. Storage & Analytics'}
                                </h4>
                                <ul className="text-sm space-y-1 ml-4">
                                    <li>• {lang === 'th' ? 'เก็บข้อมูลการตรวจจับใน database' : 'Store detection data in database'}</li>
                                    <li>• {lang === 'th' ? 'สร้างรายงานแนวโน้ม' : 'Generate trend reports'}</li>
                                    <li>• {lang === 'th' ? 'วิเคราะห์ความสัมพันธ์กับคุณภาพอากาศ' : 'Analyze correlation with air quality'}</li>
                                </ul>
                            </div>
                        </div>
                    </Card>
                </section>
            </main>
        </div>
    )
}
