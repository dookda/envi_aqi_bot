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
    fire: { label: 'Fire & Smoke', labelTh: 'เปลวไฟและควัน', icon: 'local_fire_department', color: '#ff4500', emoji: '🔥' },
}

interface DetectionStats {
    human: number
    car: number
    motorcycle: number
    bicycle: number
    animal: number
    fire: number
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
        fire: 0,
        total: 0,
        timestamp: new Date().toISOString(),
    })
    const [recentDetections, setRecentDetections] = useState<DetectionEvent[]>([])
    const [viewMode, setViewMode] = useState<'single' | 'grid'>('single')

    // LINE Notification state - enabled by default to send notification when objects detected
    const [notifyEnabled, setNotifyEnabled] = useState<boolean>(true)
    const [hasNotified, setHasNotified] = useState<boolean>(false)
    const [notifyMessage, setNotifyMessage] = useState<string | null>(null)

    // Refs to track notification state inside useEffect (avoid stale closures)
    const notifyEnabledRef = useRef(true)  // Initialize with true since notification is enabled by default
    const hasNotifiedRef = useRef(hasNotified)

    // Keep refs in sync with state
    useEffect(() => {
        notifyEnabledRef.current = notifyEnabled
    }, [notifyEnabled])

    useEffect(() => {
        hasNotifiedRef.current = hasNotified
    }, [hasNotified])

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

    // Attach stream to video element when both exist
    useEffect(() => {
        if (!isStreaming || !streamRef.current || !videoRef.current) return

        console.log('🔗 Attaching stream to video element...')

        const video = videoRef.current
        const stream = streamRef.current

        // Add event listeners for debugging
        video.onloadedmetadata = () => {
            console.log('✅ Video metadata loaded')
            console.log('📊 Video dimensions:', {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                readyState: video.readyState
            })
        }

        video.onloadeddata = () => {
            console.log('✅ Video data loaded')
        }

        video.oncanplay = () => {
            console.log('✅ Video can play')
        }

        video.onerror = (error) => {
            console.error('❌ Video element error:', error)
        }

        // Attach stream
        video.srcObject = stream

        console.log('🎬 Attempting to play video...')
        video.play()
            .then(() => {
                console.log('✅ Video is playing')
            })
            .catch(error => {
                console.error('❌ Error playing video:', error)
            })

        // Cleanup event listeners
        return () => {
            video.onloadedmetadata = null
            video.onloadeddata = null
            video.oncanplay = null
            video.onerror = null
        }
    }, [isStreaming])

    // Monitor video element state
    useEffect(() => {
        if (!isStreaming || !videoRef.current) return

        console.log('🔍 Monitoring video element state...')
        const interval = setInterval(() => {
            if (videoRef.current) {
                console.log('📊 Video status:', {
                    readyState: videoRef.current.readyState,
                    networkState: videoRef.current.networkState,
                    paused: videoRef.current.paused,
                    ended: videoRef.current.ended,
                    videoWidth: videoRef.current.videoWidth,
                    videoHeight: videoRef.current.videoHeight,
                    currentTime: videoRef.current.currentTime,
                    hasStream: !!videoRef.current.srcObject,
                    streamActive: streamRef.current?.active
                })
            }
        }, 2000)

        return () => clearInterval(interval)
    }, [isStreaming])

    // Real-time YOLO detection
    useEffect(() => {
        if (!isStreaming || !detectionEnabled || !videoRef.current || !canvasRef.current) return

        let isProcessing = false

        const captureAndDetect = async () => {
            if (isProcessing || !videoRef.current || !canvasRef.current) return

            isProcessing = true

            try {
                const video = videoRef.current
                const canvas = canvasRef.current

                // Skip if video not ready
                if (video.readyState !== 4) {
                    isProcessing = false
                    return
                }

                // Set canvas dimensions to match video
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight

                // Capture frame from video
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    isProcessing = false
                    return
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

                // Convert canvas to blob
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        isProcessing = false
                        return
                    }

                    // Send to YOLO API
                    const formData = new FormData()
                    formData.append('file', blob, 'frame.jpg')

                    try {
                        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
                        const response = await fetch(`${apiBaseUrl}/api/cctv/detect`, {
                            method: 'POST',
                            body: formData
                        })

                        if (!response.ok) {
                            console.error('Detection API error:', response.statusText)
                            isProcessing = false
                            return
                        }

                        const result = await response.json()

                        if (result.success) {
                            // Update statistics
                            const stats = result.statistics
                            setDetectionStats({
                                human: stats.human || 0,
                                car: stats.car || 0,
                                motorcycle: stats.motorcycle || 0,
                                bicycle: stats.bicycle || 0,
                                animal: stats.animal || 0,
                                fire: stats.fire || 0,
                                total: stats.total || 0,
                                timestamp: new Date().toISOString()
                            })

                            // Draw bounding boxes on canvas
                            drawBoundingBoxes(ctx, result.detections, canvas.width, canvas.height)

                            // Add new detections to recent list
                            const newDetections: DetectionEvent[] = result.detections.map((det: any) => ({
                                id: `det_${Date.now()}_${Math.random()}`,
                                type: det.type,
                                confidence: det.confidence,
                                timestamp: new Date().toISOString(),
                                bbox: det.bbox
                            }))

                            if (newDetections.length > 0) {
                                setRecentDetections(prev => [...newDetections, ...prev].slice(0, 10))

                                // Send LINE notification once if enabled and not yet notified
                                // Use refs to get current values (avoid stale closures)
                                if (notifyEnabledRef.current && !hasNotifiedRef.current && stats.total > 0) {
                                    console.log('📱 Sending LINE notification for detection...')
                                    sendLineNotification(stats)
                                }
                            }

                            console.log(`🎯 Detected ${stats.total} objects in ${result.processing_time_ms}ms`)
                        }
                    } catch (error) {
                        console.error('Detection error:', error)
                    } finally {
                        isProcessing = false
                    }
                }, 'image/jpeg', 0.8)
            } catch (error) {
                console.error('Frame capture error:', error)
                isProcessing = false
            }
        }

        // Run detection every 2 seconds
        const interval = setInterval(captureAndDetect, 2000)

        return () => clearInterval(interval)
    }, [isStreaming, detectionEnabled])

    // Draw bounding boxes on canvas
    const drawBoundingBoxes = (
        ctx: CanvasRenderingContext2D,
        detections: any[],
        canvasWidth: number,
        canvasHeight: number
    ) => {
        // Clear previous boxes
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)

        // Draw each detection
        detections.forEach(det => {
            const { x, y, width, height } = det.bbox
            const config = DETECTION_TYPES[det.type as keyof typeof DETECTION_TYPES]

            // Convert relative coordinates to pixels
            const px = x * canvasWidth
            const py = y * canvasHeight
            const pw = width * canvasWidth
            const ph = height * canvasHeight

            // Draw bounding box
            ctx.strokeStyle = config.color
            ctx.lineWidth = 3
            ctx.strokeRect(px, py, pw, ph)

            // Draw label background
            const label = `${config.label} ${(det.confidence * 100).toFixed(0)}%`
            ctx.font = '16px Arial'
            const textWidth = ctx.measureText(label).width
            ctx.fillStyle = config.color
            ctx.fillRect(px, py - 25, textWidth + 10, 25)

            // Draw label text
            ctx.fillStyle = 'white'
            ctx.fillText(label, px + 5, py - 7)
        })
    }

    const handleStartStream = async () => {
        try {
            console.log('🎥 Requesting camera access...')

            // Request access to camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            })

            console.log('✅ Camera access granted')
            console.log('📹 Stream tracks:', stream.getTracks().map(track => ({
                kind: track.kind,
                label: track.label,
                enabled: track.enabled,
                readyState: track.readyState
            })))

            // Store stream reference
            streamRef.current = stream

            // Set streaming state - this will trigger the useEffect to attach the stream
            setIsStreaming(true)
            console.log('✅ Streaming state set to true - video element will render and stream will attach')
        } catch (error) {
            console.error('❌ Error accessing camera:', error)
            console.error('Error details:', {
                name: (error as Error).name,
                message: (error as Error).message
            })
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

    // Send LINE notification
    const sendLineNotification = async (stats: DetectionStats) => {
        console.log('📱 sendLineNotification called with stats:', stats)

        // Mark as notified immediately to prevent duplicate calls
        setHasNotified(true)
        hasNotifiedRef.current = true

        try {
            const currentStation = stations.find(s => s.station_id === selectedStation)
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

            console.log('📱 Calling API:', `${apiBaseUrl}/api/cctv/notify`)

            const response = await fetch(`${apiBaseUrl}/api/cctv/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    station_id: selectedStation,
                    station_name: currentStation?.name_th || currentStation?.name_en || selectedStation,
                    detections: {
                        human: stats.human,
                        car: stats.car,
                        motorcycle: stats.motorcycle,
                        bicycle: stats.bicycle,
                        animal: stats.animal,
                        fire: stats.fire
                    },
                    timestamp: new Date().toISOString(),
                    language: lang
                })
            })

            const result = await response.json()

            if (result.success) {
                setNotifyMessage(lang === 'th'
                    ? `✅ ส่งแจ้งเตือน LINE แล้ว (${result.recipients} คน)`
                    : `✅ LINE notification sent (${result.recipients} users)`)
                console.log('📱 LINE notification sent successfully:', result)
            } else {
                setNotifyMessage(lang === 'th'
                    ? `⚠️ ${result.message}`
                    : `⚠️ ${result.message}`)
            }

            // Clear message after 5 seconds
            setTimeout(() => setNotifyMessage(null), 5000)

        } catch (error) {
            console.error('Error sending LINE notification:', error)
            setNotifyMessage(lang === 'th'
                ? '❌ ส่งแจ้งเตือนไม่สำเร็จ'
                : '❌ Failed to send notification')
            setTimeout(() => setNotifyMessage(null), 5000)
        }
    }

    const resetStats = () => {
        setDetectionStats({
            human: 0,
            car: 0,
            motorcycle: 0,
            bicycle: 0,
            animal: 0,
            fire: 0,
            total: 0,
            timestamp: new Date().toISOString(),
        })
        setRecentDetections([])
        // Reset notification state when stats are reset
        setHasNotified(false)
        hasNotifiedRef.current = false  // Also reset the ref
        setNotifyMessage(null)
    }

    const currentStation = stations.find(s => s.station_id === selectedStation)

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50' : 'gradient-dark'}`}>

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

                        {/* LINE Notification Toggle */}
                        <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="notifications" className="text-green-500" />
                                <span className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-dark-200'}`}>
                                    {lang === 'th' ? 'แจ้งเตือน LINE (ครั้งเดียว)' : 'LINE Notification (Once)'}
                                </span>
                                <Badge variant={notifyEnabled ? 'success' : 'default'} size="sm">
                                    {notifyEnabled ? (lang === 'th' ? 'เปิด' : 'ON') : (lang === 'th' ? 'ปิด' : 'OFF')}
                                </Badge>
                                {hasNotified && (
                                    <Badge variant="info" size="sm">
                                        {lang === 'th' ? 'ส่งแล้ว ✓' : 'Sent ✓'}
                                    </Badge>
                                )}
                            </div>
                            <Button
                                variant={notifyEnabled ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => {
                                    setNotifyEnabled(!notifyEnabled)
                                    if (!notifyEnabled) {
                                        setHasNotified(false) // Reset when enabling
                                        hasNotifiedRef.current = false  // Also reset the ref
                                    }
                                }}
                            >
                                <Icon name={notifyEnabled ? 'notifications_active' : 'notifications_off'} size="sm" />
                                {notifyEnabled ? (lang === 'th' ? 'ปิด' : 'Disable') : (lang === 'th' ? 'เปิด' : 'Enable')}
                            </Button>
                        </div>

                        {/* Notification Status Message */}
                        {notifyMessage && (
                            <div className={`mt-3 p-3 rounded-lg text-sm ${notifyMessage.includes('✅')
                                ? (isLight ? 'bg-green-100 text-green-700' : 'bg-green-900/30 text-green-300')
                                : notifyMessage.includes('❌')
                                    ? (isLight ? 'bg-red-100 text-red-700' : 'bg-red-900/30 text-red-300')
                                    : (isLight ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-900/30 text-yellow-300')
                                }`}>
                                {notifyMessage}
                            </div>
                        )}
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
                                            className="w-full h-full object-cover"
                                            autoPlay
                                            muted
                                            playsInline
                                            style={{ transform: 'scaleX(-1)' }}
                                        />
                                        {/* Detection overlay canvas */}
                                        <canvas
                                            ref={canvasRef}
                                            className="absolute inset-0 w-full h-full pointer-events-none"
                                            style={{ transform: 'scaleX(-1)' }}
                                        />
                                        {/* Live indicator */}
                                        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg z-10">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                            <span className="text-sm font-bold">LIVE</span>
                                        </div>
                                        {/* Detection count overlay */}
                                        {detectionEnabled && (
                                            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg backdrop-blur-sm z-10">
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

            </main>
        </div>
    )
}
