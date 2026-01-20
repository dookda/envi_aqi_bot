/**
 * Information Page - Methods & Statistics Documentation
 * Describes the technical approach used in this AQI monitoring application
 */
import { Card, Icon } from '../components/atoms'
import { useLanguage, useTheme } from '../contexts'

interface MethodCardProps {
    icon: string
    title: string
    titleTh: string
    description: string
    descriptionTh: string
    tags: string[]
    color: string
}

const MethodCard: React.FC<MethodCardProps> = ({ icon, title, titleTh, description, descriptionTh, tags, color }) => {
    const { lang } = useLanguage()
    const { isLight } = useTheme()

    const colorClasses: Record<string, { bg: string; border: string; icon: string; tagBg: string; tagText: string }> = {
        blue: {
            bg: isLight ? 'bg-blue-50' : 'bg-blue-900/20',
            border: isLight ? 'border-blue-200' : 'border-blue-800',
            icon: 'text-blue-500',
            tagBg: isLight ? 'bg-blue-100' : 'bg-blue-800/50',
            tagText: isLight ? 'text-blue-700' : 'text-blue-200'
        },
        purple: {
            bg: isLight ? 'bg-purple-50' : 'bg-purple-900/20',
            border: isLight ? 'border-purple-200' : 'border-purple-800',
            icon: 'text-purple-500',
            tagBg: isLight ? 'bg-purple-100' : 'bg-purple-800/50',
            tagText: isLight ? 'text-purple-700' : 'text-purple-200'
        },
        green: {
            bg: isLight ? 'bg-green-50' : 'bg-green-900/20',
            border: isLight ? 'border-green-200' : 'border-green-800',
            icon: 'text-green-500',
            tagBg: isLight ? 'bg-green-100' : 'bg-green-800/50',
            tagText: isLight ? 'text-green-700' : 'text-green-200'
        },
        orange: {
            bg: isLight ? 'bg-orange-50' : 'bg-orange-900/20',
            border: isLight ? 'border-orange-200' : 'border-orange-800',
            icon: 'text-orange-500',
            tagBg: isLight ? 'bg-orange-100' : 'bg-orange-800/50',
            tagText: isLight ? 'text-orange-700' : 'text-orange-200'
        },
        cyan: {
            bg: isLight ? 'bg-cyan-50' : 'bg-cyan-900/20',
            border: isLight ? 'border-cyan-200' : 'border-cyan-800',
            icon: 'text-cyan-500',
            tagBg: isLight ? 'bg-cyan-100' : 'bg-cyan-800/50',
            tagText: isLight ? 'text-cyan-700' : 'text-cyan-200'
        }
    }

    const c = colorClasses[color] || colorClasses.blue

    return (
        <div className={`rounded-xl border-2 p-5 transition-all hover:shadow-lg ${c.bg} ${c.border}`}>
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${isLight ? 'bg-white' : 'bg-gray-800'} shadow-sm`}>
                    <Icon name={icon} size="md" className={c.icon} />
                </div>
                <div className="flex-1">
                    <h3 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {lang === 'th' ? titleTh : title}
                    </h3>
                    <p className={`text-sm leading-relaxed mb-3 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                        {lang === 'th' ? descriptionTh : description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag, idx) => (
                            <span
                                key={idx}
                                className={`px-2 py-1 rounded-md text-xs font-medium ${c.tagBg} ${c.tagText}`}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

interface StatItemProps {
    label: string
    labelTh: string
    value: string
    icon: string
}

const StatItem: React.FC<StatItemProps> = ({ label, labelTh, value, icon }) => {
    const { lang } = useLanguage()
    const { isLight } = useTheme()

    return (
        <div className={`p-4 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-gray-800/50'}`}>
            <div className="flex items-center gap-3">
                <Icon name={icon} size="sm" className={isLight ? 'text-gray-500' : 'text-gray-400'} />
                <div>
                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                        {lang === 'th' ? labelTh : label}
                    </p>
                    <p className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {value}
                    </p>
                </div>
            </div>
        </div>
    )
}

export default function InfoPage(): React.ReactElement {
    const { lang } = useLanguage()
    const { isLight } = useTheme()

    const methods: MethodCardProps[] = [
        {
            icon: 'psychology',
            title: 'LSTM Neural Network',
            titleTh: 'โครงข่ายประสาทเทียม LSTM',
            description: 'Long Short-Term Memory (LSTM) is a type of recurrent neural network designed for sequence prediction. We use LSTM to forecast PM2.5 and other air quality parameters based on historical patterns. The model captures temporal dependencies in time-series data.',
            descriptionTh: 'Long Short-Term Memory (LSTM) เป็นโครงข่ายประสาทเทียมแบบ Recurrent ที่ออกแบบมาเพื่อทำนายลำดับข้อมูล เราใช้ LSTM ในการทำนายค่า PM2.5 และพารามิเตอร์คุณภาพอากาศอื่นๆ ตามรูปแบบในอดีต โมเดลสามารถจับความสัมพันธ์ด้านเวลาในข้อมูลอนุกรมเวลา',
            tags: ['TensorFlow', 'Keras', 'Time-Series', 'Deep Learning'],
            color: 'purple'
        },
        {
            icon: 'chat',
            title: 'RAG (Retrieval-Augmented Generation)',
            titleTh: 'RAG (การสร้างข้อความโดยเสริมด้วยการค้นคืน)',
            description: 'Our AI chatbot uses RAG to combine real-time AQI data with language model responses. When you ask a question, the system retrieves relevant air quality data from the database and uses it as context for generating accurate, data-driven responses.',
            descriptionTh: 'แชทบอท AI ของเราใช้ RAG เพื่อรวมข้อมูล AQI แบบเรียลไทม์เข้ากับการตอบของโมเดลภาษา เมื่อคุณถามคำถาม ระบบจะดึงข้อมูลคุณภาพอากาศที่เกี่ยวข้องจากฐานข้อมูลและใช้เป็นบริบทในการสร้างคำตอบที่ถูกต้องตามข้อมูลจริง',
            tags: ['LLM', 'Vector Search', 'Context Injection', 'NLP'],
            color: 'blue'
        },
        {
            icon: 'analytics',
            title: 'Gap Filling with LSTM Imputation',
            titleTh: 'การเติมข้อมูลช่องว่างด้วย LSTM',
            description: 'Missing data gaps are filled using trained LSTM models. When gaps are detected, the system uses the station\'s LSTM model to predict the missing PM2.5 values based on temporal patterns learned from historical data. This provides more accurate imputation than simple linear interpolation, especially for longer gaps.',
            descriptionTh: 'ช่องว่างข้อมูลที่ขาดหายจะถูกเติมโดยใช้โมเดล LSTM ที่ผ่านการฝึกแล้ว เมื่อตรวจพบช่องว่าง ระบบจะใช้โมเดล LSTM ของสถานีนั้นทำนายค่า PM2.5 ที่หายไปตามรูปแบบเวลาที่เรียนรู้จากข้อมูลในอดีต วิธีนี้ให้ความแม่นยำมากกว่า Linear Interpolation โดยเฉพาะสำหรับช่องว่างที่ยาว',
            tags: ['LSTM Imputation', 'Gap Detection', 'Automated Filling', 'Hourly Scan'],
            color: 'green'
        },
        {
            icon: 'bar_chart',
            title: 'Statistical Analysis',
            titleTh: 'การวิเคราะห์ทางสถิติ',
            description: 'We calculate key statistics including mean, median, standard deviation, min/max values, and percentiles (P25, P75, P95). These help understand the distribution and variability of air quality measurements across different time periods.',
            descriptionTh: 'เราคำนวณสถิติสำคัญ ได้แก่ ค่าเฉลี่ย ค่ามัธยฐาน ส่วนเบี่ยงเบนมาตรฐาน ค่าสูงสุด/ต่ำสุด และ Percentile (P25, P75, P95) สิ่งเหล่านี้ช่วยให้เข้าใจการกระจายและความแปรปรวนของการวัดคุณภาพอากาศในช่วงเวลาต่างๆ',
            tags: ['Mean', 'Std Dev', 'Percentiles', 'Trend Analysis'],
            color: 'orange'
        },
        {
            icon: 'air',
            title: 'AQI Calculation (Thailand Standard)',
            titleTh: 'การคำนวณ AQI (มาตรฐานประเทศไทย)',
            description: 'Air Quality Index is calculated using Thailand PCD (Pollution Control Department) standards. Each pollutant (PM2.5, PM10, O3, CO, NO2, SO2) is converted to a sub-index, and the highest sub-index becomes the overall AQI with corresponding health category.',
            descriptionTh: 'ดัชนีคุณภาพอากาศคำนวณโดยใช้มาตรฐานกรมควบคุมมลพิษ (คพ.) ของประเทศไทย มลพิษแต่ละตัว (PM2.5, PM10, O3, CO, NO2, SO2) จะถูกแปลงเป็นดัชนีย่อย และดัชนีย่อยที่สูงที่สุดจะกลายเป็น AQI รวมพร้อมระดับผลกระทบต่อสุขภาพ',
            tags: ['Thailand PCD', 'Sub-Index', 'Health Categories'],
            color: 'cyan'
        },
        {
            icon: 'show_chart',
            title: 'Spike Detection (Anomaly Detection)',
            titleTh: 'การตรวจจับค่าผิดปกติ (Spike Detection)',
            description: 'Spike detection uses statistical methods to identify abnormal data points. We calculate Z-scores (standard deviations from the mean) for each measurement. Points exceeding ±3 standard deviations are flagged as potential spikes. This helps identify sensor malfunctions, sudden pollution events, or data entry errors.',
            descriptionTh: 'การตรวจจับค่าผิดปกติใช้วิธีการทางสถิติในการระบุจุดข้อมูลที่ผิดปกติ เราคำนวณค่า Z-score (ส่วนเบี่ยงเบนมาตรฐานจากค่าเฉลี่ย) สำหรับการวัดแต่ละครั้ง จุดที่เกิน ±3 ส่วนเบี่ยงเบนมาตรฐานจะถูกระบุว่าเป็น Spike ที่อาจเกิดขึ้น ซึ่งช่วยระบุความผิดปกติของเซ็นเซอร์ เหตุการณ์มลพิษฉับพลัน หรือข้อผิดพลาดในการป้อนข้อมูล',
            tags: ['Z-Score', 'Standard Deviation', 'Outlier Detection', 'Data Quality'],
            color: 'purple'
        }
    ]

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gray-50' : 'bg-gray-900'}`}>
            <main className="container mx-auto px-4 py-6 max-w-6xl">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${isLight ? 'bg-blue-100' : 'bg-blue-900/30'}`}>
                            <Icon name="info" size="md" className="text-blue-500" />
                        </div>
                        <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            {lang === 'th' ? 'วิธีการและสถิติ' : 'Methods & Statistics'}
                        </h1>
                    </div>
                    <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                        {lang === 'th'
                            ? 'เอกสารอธิบายเทคนิคและวิธีการที่ใช้ในแอปพลิเคชันนี้'
                            : 'Technical documentation of the methods and techniques used in this application'}
                    </p>
                </div>

                {/* Quick Stats */}
                <Card className="p-6 mb-8">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="speed" size="sm" className="text-blue-500" />
                        {lang === 'th' ? 'ภาพรวมระบบ' : 'System Overview'}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatItem
                            label="Prediction Model"
                            labelTh="โมเดลทำนาย"
                            value="LSTM"
                            icon="psychology"
                        />
                        <StatItem
                            label="Forecast Horizon"
                            labelTh="ระยะทำนาย"
                            value="24 Hours"
                            icon="schedule"
                        />
                        <StatItem
                            label="Data Frequency"
                            labelTh="ความถี่ข้อมูล"
                            value="Hourly"
                            icon="update"
                        />
                        <StatItem
                            label="AI Chatbots"
                            labelTh="AI แชทบอท"
                            value="Qwen 2.5 / Model B"
                            icon="smart_toy"
                        />
                    </div>
                </Card>

                {/* AI Models Detail */}
                <Card className="p-6 mb-8">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="model_training" size="sm" className="text-purple-500" />
                        {lang === 'th' ? 'โมเดล AI ที่ใช้งาน' : 'AI Models in Use'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Ollama Model */}
                        <div className={`p-5 rounded-xl border-2 ${isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-800'}`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg ${isLight ? 'bg-white' : 'bg-gray-800'} shadow-sm`}>
                                    <Icon name="dns" size="md" className="text-blue-500" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                            Ollama (Local)
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isLight ? 'bg-green-100 text-green-700' : 'bg-green-800/50 text-green-300'}`}>
                                            {lang === 'th' ? 'ฟรี' : 'Free'}
                                        </span>
                                    </div>
                                    <p className={`text-sm font-mono mb-2 ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                                        qwen2.5:1.5b
                                    </p>
                                    <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                        {lang === 'th'
                                            ? 'โมเดลภาษาขนาดเล็กที่รันบนเครื่อง ตอบสนองเร็ว เหมาะสำหรับคำถามทั่วไป'
                                            : 'Lightweight local model with fast response time, suitable for general queries'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className={`px-2 py-1 rounded-md text-xs ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-800/50 text-blue-200'}`}>
                                            1.5B params
                                        </span>
                                        <span className={`px-2 py-1 rounded-md text-xs ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-800/50 text-blue-200'}`}>
                                            Self-hosted
                                        </span>
                                        <span className={`px-2 py-1 rounded-md text-xs ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-800/50 text-blue-200'}`}>
                                            Docker
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Model B */}
                        <div className={`p-5 rounded-xl border-2 ${isLight ? 'bg-purple-50 border-purple-200' : 'bg-purple-900/20 border-purple-800'}`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg ${isLight ? 'bg-white' : 'bg-gray-800'} shadow-sm`}>
                                    <Icon name="auto_awesome" size="md" className="text-purple-500" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                            Model B (Cloud)
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isLight ? 'bg-orange-100 text-orange-700' : 'bg-orange-800/50 text-orange-300'}`}>
                                            API
                                        </span>
                                    </div>
                                    <p className={`text-sm font-mono mb-2 ${isLight ? 'text-purple-600' : 'text-purple-400'}`}>
                                        haiku
                                    </p>
                                    <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                        {lang === 'th'
                                            ? 'โมเดลภาษาขั้นสูงบน Cloud มีความสามารถในการวิเคราะห์และตอบคำถามซับซ้อน'
                                            : 'Advanced cloud-based language model with strong analytical and complex reasoning capabilities'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className={`px-2 py-1 rounded-md text-xs ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-800/50 text-purple-200'}`}>
                                            Fast
                                        </span>
                                        <span className={`px-2 py-1 rounded-md text-xs ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-800/50 text-purple-200'}`}>
                                            Cloud API
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Methods Grid */}
                <div className="mb-8">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="science" size="sm" className="text-purple-500" />
                        {lang === 'th' ? 'วิธีการที่ใช้' : 'Methods Used'}
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {methods.map((method, idx) => (
                            <MethodCard key={idx} {...method} />
                        ))}
                    </div>
                </div>

                {/* AQI Scale Reference */}
                <Card className="p-6 mb-8">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="palette" size="sm" className="text-green-500" />
                        {lang === 'th' ? 'ดัชนี AQI ประเทศไทย' : 'Thailand AQI Scale'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {[
                            { range: '0-25', label: 'Excellent', labelTh: 'ดีมาก', color: 'bg-cyan-500', pm25: '0-15' },
                            { range: '26-50', label: 'Good', labelTh: 'ดี', color: 'bg-green-500', pm25: '16-25' },
                            { range: '51-100', label: 'Moderate', labelTh: 'ปานกลาง', color: 'bg-yellow-500', pm25: '26-37' },
                            { range: '101-200', label: 'Unhealthy', labelTh: 'เริ่มมีผลกระทบ', color: 'bg-orange-500', pm25: '38-75' },
                            { range: '>200', label: 'Hazardous', labelTh: 'มีผลกระทบ', color: 'bg-red-500', pm25: '>75' },
                        ].map((level, idx) => (
                            <div key={idx} className={`rounded-lg p-3 text-center text-white ${level.color}`}>
                                <p className="font-bold text-lg">{level.range}</p>
                                <p className="text-sm opacity-90">{lang === 'th' ? level.labelTh : level.label}</p>
                                <p className="text-xs mt-1 opacity-75">PM2.5: {level.pm25}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Data Flow Diagram */}
                <Card className="p-6 mb-8">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="schema" size="sm" className="text-orange-500" />
                        {lang === 'th' ? 'การไหลของข้อมูล' : 'Data Flow'}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {[
                            { icon: 'sensors', label: 'Sensors', labelTh: 'เซ็นเซอร์' },
                            { icon: 'arrow_forward', label: '', labelTh: '' },
                            { icon: 'cloud_upload', label: 'Data Upload', labelTh: 'อัปโหลด' },
                            { icon: 'arrow_forward', label: '', labelTh: '' },
                            { icon: 'storage', label: 'Database', labelTh: 'ฐานข้อมูล' },
                            { icon: 'arrow_forward', label: '', labelTh: '' },
                            { icon: 'psychology', label: 'LSTM Model', labelTh: 'โมเดล LSTM' },
                            { icon: 'arrow_forward', label: '', labelTh: '' },
                            { icon: 'dashboard', label: 'Dashboard', labelTh: 'แดชบอร์ด' }
                        ].map((step, idx) => (
                            <div key={idx} className="flex flex-col items-center">
                                <div className={`p-3 rounded-full ${step.label ? (isLight ? 'bg-blue-100' : 'bg-blue-900/30') : ''}`}>
                                    <Icon
                                        name={step.icon}
                                        size={step.label ? 'md' : 'sm'}
                                        className={step.label ? 'text-blue-500' : (isLight ? 'text-gray-400' : 'text-gray-600')}
                                    />
                                </div>
                                {step.label && (
                                    <p className={`text-xs mt-1 text-center ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                        {lang === 'th' ? step.labelTh : step.label}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>

                {/* LINE Notification Flow */}
                <Card className="p-6 mb-8">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="notifications_active" size="sm" className="text-green-500" />
                        {lang === 'th' ? 'ระบบแจ้งเตือน LINE' : 'LINE Notification System'}
                    </h2>

                    <p className={`text-sm mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                        {lang === 'th'
                            ? 'ระบบจะวิเคราะห์คุณภาพข้อมูลโดยอัตโนมัติเมื่อมีการอัปโหลด CSV และส่งการแจ้งเตือนผ่าน LINE เมื่อพบปัญหา'
                            : 'The system automatically analyzes data quality when CSV is uploaded and sends LINE notifications when issues are detected'}
                    </p>

                    {/* Main Flow Diagram */}
                    <div className={`rounded-xl p-6 mb-6 ${isLight ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' : 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-800'}`}>
                        {/* Step 1: CSV Upload */}
                        <div className="flex flex-col items-center mb-6">
                            <div className={`flex items-center gap-3 px-6 py-3 rounded-xl ${isLight ? 'bg-white shadow-md border border-gray-200' : 'bg-dark-800 border border-dark-600'}`}>
                                <div className="p-2 rounded-lg bg-blue-500">
                                    <Icon name="cloud_upload" className="text-white" />
                                </div>
                                <div>
                                    <p className={`font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                        {lang === 'th' ? 'อัปโหลด CSV' : 'CSV Upload'}
                                    </p>
                                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {lang === 'th' ? 'นำเข้าข้อมูลคุณภาพอากาศ' : 'Import air quality data'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Arrow Down */}
                        <div className="flex justify-center mb-4">
                            <Icon name="arrow_downward" className={isLight ? 'text-gray-400' : 'text-gray-600'} />
                        </div>

                        {/* Step 2: Data Analysis */}
                        <div className="flex flex-col items-center mb-6">
                            <div className={`flex items-center gap-3 px-6 py-3 rounded-xl ${isLight ? 'bg-white shadow-md border border-gray-200' : 'bg-dark-800 border border-dark-600'}`}>
                                <div className="p-2 rounded-lg bg-purple-500">
                                    <Icon name="analytics" className="text-white" />
                                </div>
                                <div>
                                    <p className={`font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                        {lang === 'th' ? 'วิเคราะห์ข้อมูล' : 'Data Analysis'}
                                    </p>
                                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {lang === 'th' ? 'ตรวจสอบคุณภาพข้อมูล' : 'Quality check & validation'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Arrow Down */}
                        <div className="flex justify-center mb-4">
                            <Icon name="arrow_downward" className={isLight ? 'text-gray-400' : 'text-gray-600'} />
                        </div>

                        {/* Step 3: Detection Split */}
                        <div className="flex flex-col md:flex-row justify-center items-stretch gap-4 mb-6">
                            {/* Spike Detection */}
                            <div className={`flex-1 flex items-center gap-3 px-5 py-4 rounded-xl ${isLight ? 'bg-red-50 border-2 border-red-200' : 'bg-red-900/20 border-2 border-red-800'}`}>
                                <div className="p-2 rounded-lg bg-red-500">
                                    <Icon name="show_chart" className="text-white" />
                                </div>
                                <div>
                                    <p className={`font-semibold ${isLight ? 'text-red-800' : 'text-red-300'}`}>
                                        {lang === 'th' ? 'ตรวจจับ Spike' : 'Spike Detection'}
                                    </p>
                                    <p className={`text-xs ${isLight ? 'text-red-600' : 'text-red-400'}`}>
                                        {lang === 'th' ? 'Z-Score > 3σ, 5x Jump Rule' : 'Z-Score > 3σ, 5x Jump Rule'}
                                    </p>
                                </div>
                            </div>

                            {/* Missing Data Detection */}
                            <div className={`flex-1 flex items-center gap-3 px-5 py-4 rounded-xl ${isLight ? 'bg-amber-50 border-2 border-amber-200' : 'bg-amber-900/20 border-2 border-amber-800'}`}>
                                <div className="p-2 rounded-lg bg-amber-500">
                                    <Icon name="data_alert" className="text-white" />
                                </div>
                                <div>
                                    <p className={`font-semibold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                                        {lang === 'th' ? 'ตรวจจับข้อมูลขาดหาย' : 'Missing Data Detection'}
                                    </p>
                                    <p className={`text-xs ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
                                        {lang === 'th' ? 'ช่องว่างในข้อมูลรายชั่วโมง' : 'Gaps in hourly data'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Merge Arrow */}
                        <div className="flex justify-center mb-4">
                            <div className="flex items-center gap-2">
                                <div className={`h-px w-16 md:w-24 ${isLight ? 'bg-gray-300' : 'bg-gray-600'}`} />
                                <Icon name="merge" className={isLight ? 'text-gray-400' : 'text-gray-600'} />
                                <div className={`h-px w-16 md:w-24 ${isLight ? 'bg-gray-300' : 'bg-gray-600'}`} />
                            </div>
                        </div>

                        {/* Arrow Down */}
                        <div className="flex justify-center mb-4">
                            <Icon name="arrow_downward" className={isLight ? 'text-gray-400' : 'text-gray-600'} />
                        </div>

                        {/* Step 4: Alert Generation */}
                        <div className="flex flex-col items-center mb-6">
                            <div className={`flex items-center gap-3 px-6 py-3 rounded-xl ${isLight ? 'bg-white shadow-md border border-gray-200' : 'bg-dark-800 border border-dark-600'}`}>
                                <div className="p-2 rounded-lg bg-orange-500">
                                    <Icon name="warning" className="text-white" />
                                </div>
                                <div>
                                    <p className={`font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                        {lang === 'th' ? 'สร้างการแจ้งเตือน' : 'Alert Generation'}
                                    </p>
                                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {lang === 'th' ? 'รวบรวมปัญหาและสร้างข้อความ' : 'Compile issues & generate message'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Arrow Down */}
                        <div className="flex justify-center mb-4">
                            <Icon name="arrow_downward" className={isLight ? 'text-gray-400' : 'text-gray-600'} />
                        </div>

                        {/* Step 5: LINE Push */}
                        <div className="flex flex-col items-center">
                            <div className={`flex items-center gap-3 px-6 py-4 rounded-xl ${isLight ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-green-600 to-emerald-600'} shadow-lg`}>
                                <div className="p-2 rounded-lg bg-white/20">
                                    <Icon name="send" className="text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">
                                        LINE Messaging API
                                    </p>
                                    <p className="text-xs text-white/80">
                                        {lang === 'th' ? 'ส่ง Push Notification ถึงผู้ดูแล' : 'Push Notification to Admins'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Alert Types */}
                    <h3 className={`font-semibold mb-3 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                        {lang === 'th' ? '🔔 ประเภทการแจ้งเตือน' : '🔔 Alert Types'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className={`p-4 rounded-lg border-l-4 border-red-500 ${isLight ? 'bg-red-50' : 'bg-red-900/20'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name="trending_up" className="text-red-500" size="sm" />
                                <span className={`font-medium ${isLight ? 'text-red-800' : 'text-red-300'}`}>
                                    {lang === 'th' ? 'Spike ผิดปกติ' : 'Anomaly Spikes'}
                                </span>
                            </div>
                            <p className={`text-sm ${isLight ? 'text-red-600' : 'text-red-400'}`}>
                                {lang === 'th'
                                    ? 'ค่าที่สูงกว่าปกติ > 3 SD หรือเพิ่มขึ้น 5 เท่าจากค่าก่อนหน้า'
                                    : 'Values > 3 SD from mean or 5x jump from previous'}
                            </p>
                        </div>

                        <div className={`p-4 rounded-lg border-l-4 border-amber-500 ${isLight ? 'bg-amber-50' : 'bg-amber-900/20'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name="hourglass_empty" className="text-amber-500" size="sm" />
                                <span className={`font-medium ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                                    {lang === 'th' ? 'ข้อมูลขาดหาย' : 'Missing Data'}
                                </span>
                            </div>
                            <p className={`text-sm ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
                                {lang === 'th'
                                    ? 'ช่องว่างในข้อมูลรายชั่วโมงที่ต้องเติมด้วย AI'
                                    : 'Gaps in hourly data requiring AI imputation'}
                            </p>
                        </div>

                        <div className={`p-4 rounded-lg border-l-4 border-gray-500 ${isLight ? 'bg-gray-50' : 'bg-gray-800/50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name="error_outline" className="text-gray-500" size="sm" />
                                <span className={`font-medium ${isLight ? 'text-gray-800' : 'text-gray-300'}`}>
                                    {lang === 'th' ? 'นำเข้าล้มเหลว' : 'Import Failures'}
                                </span>
                            </div>
                            <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                {lang === 'th'
                                    ? 'ข้อมูลที่ไม่สามารถนำเข้าได้เนื่องจากรูปแบบผิด'
                                    : 'Records that failed to import due to format issues'}
                            </p>
                        </div>
                    </div>

                    {/* Sample Message */}
                    <h3 className={`font-semibold mb-3 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                        {lang === 'th' ? '📱 ตัวอย่างข้อความแจ้งเตือน' : '📱 Sample Notification Message'}
                    </h3>
                    <div className={`p-4 rounded-xl font-mono text-sm ${isLight ? 'bg-gray-100 text-gray-700 border border-gray-200' : 'bg-dark-800 text-gray-300 border border-dark-600'}`}>
                        <pre className="whitespace-pre-wrap">
                            {`🚨 การแจ้งเตือนคุณภาพข้อมูล

📍 สถานี: Thara Public Park (119t)
📅 ช่วงเวลา: 2026-01-01 ถึง 2026-01-15

📊 สรุปการอัปโหลด:
• ข้อมูลทั้งหมด: 360 รายการ
• นำเข้าสำเร็จ: 358 รายการ

⚠️ พบปัญหาคุณภาพข้อมูล:
• 🔺 ค่าผิดปกติ (Spike): 3 จุด
   └─ 2026-01-05 14:00: PM2.5 = 285.3
• ⏳ ข้อมูลขาดหาย: 12 ชั่วโมง
• 📈 ความครอบคลุมข้อมูล: 96.7%

🤖 ระบบเติมค่าอัตโนมัติ: 8 จุด

📋 คำแนะนำ:
• ตรวจสอบค่าที่ผิดปกติในระบบ
• ตรวจสอบสาเหตุของข้อมูลขาดหาย`}
                        </pre>
                    </div>

                    {/* Configuration Info */}
                    <div className={`mt-6 p-4 rounded-lg ${isLight ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/20 border border-blue-800'}`}>
                        <div className="flex items-start gap-3">
                            <Icon name="settings" className="text-blue-500 mt-0.5" />
                            <div>
                                <p className={`font-medium mb-1 ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>
                                    {lang === 'th' ? 'การตั้งค่า' : 'Configuration'}
                                </p>
                                <p className={`text-sm ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                                    {lang === 'th'
                                        ? 'เพิ่ม LINE_ADMIN_USER_IDS ใน .env เพื่อรับการแจ้งเตือน โดยใช้ User ID ที่ได้จากการส่งข้อความหา Bot'
                                        : 'Add LINE_ADMIN_USER_IDS in .env to receive notifications. Get your User ID by sending a message to the bot.'}
                                </p>
                                <code className={`mt-2 inline-block px-3 py-1 rounded text-xs ${isLight ? 'bg-white text-blue-700 border border-blue-200' : 'bg-dark-700 text-blue-300'}`}>
                                    LINE_ADMIN_USER_IDS=Uxxxxxxxx,Uyyyyyyyy
                                </code>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* LINE OA QR Code */}
                <Card className="p-6 mb-8">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="qr_code_2" size="sm" className="text-green-500" />
                        {lang === 'th' ? 'เพิ่มเพื่อน LINE Official Account' : 'Add LINE Official Account'}
                    </h2>

                    <div className={`rounded-xl p-6 ${isLight ? 'bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200' : 'bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-800'}`}>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            {/* QR Code */}
                            <div className="flex-shrink-0">
                                <div className={`p-4 rounded-2xl ${isLight ? 'bg-white shadow-lg' : 'bg-gray-800 shadow-xl'}`}>
                                    <img
                                        src="https://qr-official.line.me/sid/L/786fusre.png"
                                        alt="LINE OA QR Code"
                                        className="w-48 h-48 object-contain"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="flex-1 text-center md:text-left">
                                <h3 className={`text-xl font-bold mb-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                                    🌍 AQI Bot
                                </h3>
                                <p className={`mb-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {lang === 'th'
                                        ? 'สแกน QR Code เพื่อเพิ่มเพื่อน และรับการแจ้งเตือนคุณภาพอากาศผ่าน LINE'
                                        : 'Scan QR Code to add as friend and receive air quality notifications via LINE'}
                                </p>

                                <div className={`space-y-2 text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <span className="text-green-500">✓</span>
                                        <span>{lang === 'th' ? 'แจ้งเตือนเมื่อพบค่าผิดปกติ (Spike)' : 'Alert when anomaly spikes detected'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <span className="text-green-500">✓</span>
                                        <span>{lang === 'th' ? 'แจ้งเตือนเมื่อพบข้อมูลขาดหาย (Gap)' : 'Alert when data gaps found'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <span className="text-green-500">✓</span>
                                        <span>{lang === 'th' ? 'สรุปคุณภาพข้อมูลหลังอัปโหลด' : 'Data quality summary after upload'}</span>
                                    </div>
                                </div>

                                <a
                                    href="https://line.me/R/ti/p/@786fusre"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-full font-semibold transition-all ${isLight
                                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
                                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-xl'}`}
                                >
                                    <Icon name="add" size="sm" />
                                    {lang === 'th' ? 'เพิ่มเพื่อน' : 'Add Friend'}
                                </a>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Technical Stack */}
                <Card className="p-6">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="code" size="sm" className="text-cyan-500" />
                        {lang === 'th' ? 'เทคโนโลยีที่ใช้' : 'Technology Stack'}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { category: 'Frontend', categoryTh: 'ฟรอนท์เอนด์', items: ['React 19.2', 'TypeScript 5.9', 'Tailwind CSS 4.1', 'Vite 7.2', 'ECharts 6.0', 'MapLibre GL'] },
                            { category: 'Backend', categoryTh: 'แบ็คเอนด์', items: ['FastAPI', 'Python 3.11', 'SQLAlchemy', 'Pydantic', 'LINE SDK'] },
                            { category: 'Database', categoryTh: 'ฐานข้อมูล', items: ['PostgreSQL 16', 'PostGIS 3.4'] },
                            { category: 'AI/ML', categoryTh: 'AI/ML', items: ['TensorFlow', 'Keras', 'Ollama (Qwen 2.5)', 'Model B API'] }
                        ].map((stack, idx) => (
                            <div key={idx} className={`p-4 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-gray-800/50'}`}>
                                <p className={`font-semibold mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                    {lang === 'th' ? stack.categoryTh : stack.category}
                                </p>
                                <div className="space-y-1">
                                    {stack.items.map((item, i) => (
                                        <p key={i} className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                            • {item}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </main>
        </div>
    )
}
