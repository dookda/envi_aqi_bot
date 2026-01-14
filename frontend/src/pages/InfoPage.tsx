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
                            label="AI Providers"
                            labelTh="ผู้ให้บริการ AI"
                            value="2 (Ollama, Claude)"
                            icon="smart_toy"
                        />
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
                        {lang === 'th' ? 'มาตราส่วน AQI ประเทศไทย' : 'Thailand AQI Scale'}
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

                {/* Technical Stack */}
                <Card className="p-6">
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        <Icon name="code" size="sm" className="text-cyan-500" />
                        {lang === 'th' ? 'เทคโนโลยีที่ใช้' : 'Technology Stack'}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { category: 'Frontend', categoryTh: 'ฟรอนท์เอนด์', items: ['React', 'TypeScript', 'Tailwind CSS', 'Recharts'] },
                            { category: 'Backend', categoryTh: 'แบ็คเอนด์', items: ['FastAPI', 'Python', 'SQLAlchemy', 'Pydantic'] },
                            { category: 'Database', categoryTh: 'ฐานข้อมูล', items: ['PostgreSQL', 'PostGIS', 'TimescaleDB'] },
                            { category: 'AI/ML', categoryTh: 'AI/ML', items: ['TensorFlow', 'Keras', 'Ollama', 'Claude API'] }
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
