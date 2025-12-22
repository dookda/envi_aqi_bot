/**
 * Language Context for Thai/English translation
 */
import { createContext, useContext, useState, useEffect } from 'react'

const translations = {
    en: {
        // Dashboard
        'dashboard.title': '🌍 AQI Monitoring Dashboard',
        'dashboard.subtitle': 'Real-time PM2.5 data with LSTM-based gap filling',
        'dashboard.aiChat': '🤖 AI Chat',
        'dashboard.modelsStatus': '🧠 Models Status',
        'dashboard.showAnomalies': 'Show Anomalies',
        'dashboard.timePeriod': 'Time Period',
        'dashboard.loadData': '📊 Load Data',
        'dashboard.refresh': '🔄 Refresh',

        // Time periods
        'time.last24h': 'Last 24 hours',
        'time.last3d': 'Last 3 days',
        'time.last7d': 'Last 7 days',
        'time.last14d': 'Last 14 days',
        'time.last30d': 'Last 30 days',

        // Stats
        'stats.dataCompleteness': 'Data Completeness',
        'stats.averagePM25': 'Average PM2.5',
        'stats.imputedPoints': 'Imputed Points',
        'stats.missingPoints': 'Missing Points',
        'stats.anomalies': 'Anomalies',

        // Info Panel
        'info.title': '📌 Understanding the Data',
        'info.blueLine': 'Blue line:',
        'info.blueLineDesc': 'Original PM2.5 readings from Air4Thai sensors',
        'info.orangeLine': 'Orange line:',
        'info.orangeLineDesc': 'LSTM model predictions filling data gaps',
        'info.triangleMarkers': 'Triangle markers:',
        'info.triangleMarkersDesc': 'Detected anomalies (spikes, outliers)',
        'info.redAreas': 'Red shaded areas:',
        'info.redAreasDesc': 'Periods with missing data',

        // AQI Levels
        'aqi.levelGuide': 'AQI Level Guide (PM2.5)',
        'aqi.excellent': 'Excellent',
        'aqi.good': 'Good',
        'aqi.moderate': 'Moderate',
        'aqi.unhealthySensitive': 'Unhealthy (Sensitive)',

        // Models Page
        'models.title': '🧠 LSTM Models Status',
        'models.subtitle': 'Gap-fill capability and model information per station',
        'models.backToDashboard': '← Back to Dashboard',
        'models.trainAll': '🚀 Train All Models',
        'models.totalStations': 'Total Stations',
        'models.modelsTrained': 'Models Trained',
        'models.gapFillReady': 'Gap-Fill Ready',
        'models.coverage': 'Coverage',
        'models.filter': 'Filter:',
        'models.allStations': 'All Stations',
        'models.ready': '✅ Gap-Fill Ready',
        'models.notReady': '❌ Not Ready',
        'models.showing': 'Showing',
        'models.stations': 'stations',
        'models.model': 'Model:',
        'models.trained': '🧠 Trained',
        'models.notTrained': '— Not trained',
        'models.accuracy': 'Accuracy (R²):',
        'models.r2Score': 'R² Score:',
        'models.rmse': 'RMSE:',
        'models.mae': 'MAE:',
        'models.trainingSamples': 'Training Samples:',
        'models.validData': 'Valid Data',
        'models.imputed': 'Imputed',
        'models.missing': 'Missing',
        'models.total': 'Total',
        'models.retrain': '🔄 Retrain',
        'models.train': '🧠 Train',
        'models.viewChart': '📊 View Chart',
        'models.noStations': 'No stations found matching the filter.',

        // Chat Page
        'chat.title': '🤖 AI Air Quality Assistant',
        'chat.subtitle': 'Ask about air quality in Thai or English',
        'chat.dashboard': '📊 Dashboard',
        'chat.models': '🧠 Models',
        'chat.howToUse': '💬 How to Use',
        'chat.instruction1': '• Ask about air quality in Thai or English',
        'chat.instruction2': '• The system will convert your question to data and display results',
        'chat.instruction3': '• Supports PM2.5, PM10, AQI and other pollutants',
        'chat.exampleQueries': 'Example queries:',
        'chat.startConversation': 'Start a conversation by typing a question below',
        'chat.processing': 'Processing...',
        'chat.placeholder': 'Type your question here... (e.g., Show me PM2.5 for the last 7 days in Chiang Mai)',
        'chat.send': 'Send',
        'chat.clear': 'Clear',
        'chat.maxLength': 'Max length:',
        'chat.characters': 'characters',
        'chat.dataPoints': 'data points',
        'chat.trendChart': '📈 Trend Chart',
        'chat.trend': 'Trend:',
        'chat.increasing': '📈 Increasing',
        'chat.decreasing': '📉 Decreasing',
        'chat.stable': '➡️ Stable',
        'chat.insufficient': '❓ Insufficient',

        // Navbar
        'nav.dashboard': '📊 Dashboard',
        'nav.models': '🧠 Models',
        'nav.chat': '🤖 Chat',
        'nav.language': 'Language',
        'nav.theme': 'Theme',
        'nav.light': 'Light',
        'nav.dark': 'Dark',

        // Station Selector
        'station.select': 'Select Station',
        'station.loading': 'Loading stations...',
    },
    th: {
        // Dashboard
        'dashboard.title': '🌍 แดชบอร์ดติดตามคุณภาพอากาศ',
        'dashboard.subtitle': 'ข้อมูล PM2.5 แบบเรียลไทม์พร้อมการเติมช่องว่างด้วย LSTM',
        'dashboard.aiChat': '🤖 แชท AI',
        'dashboard.modelsStatus': '🧠 สถานะโมเดล',
        'dashboard.showAnomalies': 'แสดงความผิดปกติ',
        'dashboard.timePeriod': 'ช่วงเวลา',
        'dashboard.loadData': '📊 โหลดข้อมูล',
        'dashboard.refresh': '🔄 รีเฟรช',

        // Time periods
        'time.last24h': '24 ชั่วโมงที่ผ่านมา',
        'time.last3d': '3 วันที่ผ่านมา',
        'time.last7d': '7 วันที่ผ่านมา',
        'time.last14d': '14 วันที่ผ่านมา',
        'time.last30d': '30 วันที่ผ่านมา',

        // Stats
        'stats.dataCompleteness': 'ความสมบูรณ์ข้อมูล',
        'stats.averagePM25': 'ค่าเฉลี่ย PM2.5',
        'stats.imputedPoints': 'จุดที่เติม',
        'stats.missingPoints': 'จุดที่หายไป',
        'stats.anomalies': 'ความผิดปกติ',

        // Info Panel
        'info.title': '📌 ทำความเข้าใจข้อมูล',
        'info.blueLine': 'เส้นสีน้ำเงิน:',
        'info.blueLineDesc': 'ค่า PM2.5 จากเซ็นเซอร์ Air4Thai',
        'info.orangeLine': 'เส้นสีส้ม:',
        'info.orangeLineDesc': 'ค่าที่ทำนายโดยโมเดล LSTM เพื่อเติมช่องว่าง',
        'info.triangleMarkers': 'เครื่องหมายสามเหลี่ยม:',
        'info.triangleMarkersDesc': 'ความผิดปกติที่ตรวจพบ (spike, outlier)',
        'info.redAreas': 'พื้นที่สีแดง:',
        'info.redAreasDesc': 'ช่วงที่ข้อมูลหายไป',

        // AQI Levels
        'aqi.levelGuide': 'มาตรฐาน AQI (PM2.5)',
        'aqi.excellent': 'ดีเยี่ยม',
        'aqi.good': 'ดี',
        'aqi.moderate': 'ปานกลาง',
        'aqi.unhealthySensitive': 'ไม่ดีต่อสุขภาพ (ผู้ป่วย)',

        // Models Page
        'models.title': '🧠 สถานะโมเดล LSTM',
        'models.subtitle': 'ความสามารถในการเติมช่องว่างและข้อมูลโมเดลแต่ละสถานี',
        'models.backToDashboard': '← กลับไปแดชบอร์ด',
        'models.trainAll': '🚀 ฝึกโมเดลทั้งหมด',
        'models.totalStations': 'สถานีทั้งหมด',
        'models.modelsTrained': 'โมเดลที่ฝึกแล้ว',
        'models.gapFillReady': 'พร้อมเติมช่องว่าง',
        'models.coverage': 'ครอบคลุม',
        'models.filter': 'กรอง:',
        'models.allStations': 'สถานีทั้งหมด',
        'models.ready': '✅ พร้อมเติมช่องว่าง',
        'models.notReady': '❌ ยังไม่พร้อม',
        'models.showing': 'แสดง',
        'models.stations': 'สถานี',
        'models.model': 'โมเดล:',
        'models.trained': '🧠 ฝึกแล้ว',
        'models.notTrained': '— ยังไม่ได้ฝึก',
        'models.accuracy': 'ความแม่นยำ (R²):',
        'models.r2Score': 'คะแนน R²:',
        'models.rmse': 'RMSE:',
        'models.mae': 'MAE:',
        'models.trainingSamples': 'ตัวอย่างการฝึก:',
        'models.validData': 'ข้อมูลที่ใช้ได้',
        'models.imputed': 'เติมแล้ว',
        'models.missing': 'หายไป',
        'models.total': 'ทั้งหมด',
        'models.retrain': '🔄 ฝึกใหม่',
        'models.train': '🧠 ฝึก',
        'models.viewChart': '📊 ดูกราฟ',
        'models.noStations': 'ไม่พบสถานีที่ตรงกับตัวกรอง',

        // Chat Page
        'chat.title': '🤖 ผู้ช่วย AI ด้านคุณภาพอากาศ',
        'chat.subtitle': 'ถามเกี่ยวกับคุณภาพอากาศได้ทั้งภาษาไทยและอังกฤษ',
        'chat.dashboard': '📊 แดชบอร์ด',
        'chat.models': '🧠 โมเดล',
        'chat.howToUse': '💬 วิธีใช้งาน',
        'chat.instruction1': '• ถามคำถามเกี่ยวกับคุณภาพอากาศเป็นภาษาไทยหรืออังกฤษ',
        'chat.instruction2': '• ระบบจะแปลงคำถามเป็นข้อมูลและแสดงผลลัพธ์',
        'chat.instruction3': '• รองรับข้อมูล PM2.5, PM10, AQI และมลพิษอื่นๆ',
        'chat.exampleQueries': 'ตัวอย่างคำถาม:',
        'chat.startConversation': 'เริ่มต้นสนทนาด้วยการพิมพ์คำถามด้านล่าง',
        'chat.processing': 'กำลังประมวลผล...',
        'chat.placeholder': 'พิมพ์คำถามของคุณที่นี่... (เช่น ขอดูค่า PM2.5 ย้อนหลัง 7 วันของสถานีเชียงใหม่)',
        'chat.send': 'ส่ง',
        'chat.clear': 'ล้าง',
        'chat.maxLength': 'ความยาวสูงสุด:',
        'chat.characters': 'ตัวอักษร',
        'chat.dataPoints': 'จุดข้อมูล',
        'chat.trendChart': '📈 กราฟแนวโน้ม',
        'chat.trend': 'แนวโน้ม:',
        'chat.increasing': '📈 เพิ่มขึ้น',
        'chat.decreasing': '📉 ลดลง',
        'chat.stable': '➡️ คงที่',
        'chat.insufficient': '❓ ไม่เพียงพอ',

        // Navbar
        'nav.dashboard': '📊 แดชบอร์ด',
        'nav.models': '🧠 โมเดล',
        'nav.chat': '🤖 แชท',
        'nav.language': 'ภาษา',
        'nav.theme': 'ธีม',
        'nav.light': 'สว่าง',
        'nav.dark': 'มืด',

        // Station Selector
        'station.select': 'เลือกสถานี',
        'station.loading': 'กำลังโหลดสถานี...',
    }
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState(() => {
        // Try to load from localStorage
        const saved = localStorage.getItem('app-language')
        return saved || 'th'
    })

    useEffect(() => {
        localStorage.setItem('app-language', language)
        document.documentElement.lang = language
    }, [language])

    const t = (key) => {
        return translations[language]?.[key] || translations['en']?.[key] || key
    }

    const toggleLanguage = () => {
        setLanguage(prev => prev === 'en' ? 'th' : 'en')
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
