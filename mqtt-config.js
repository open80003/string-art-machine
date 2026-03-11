// ==================== إعدادات MQTT المتقدمة ====================

// قائمة بخوادم MQTT المتاحة
const MQTT_BROKERS = {
    EMQX: {
        name: 'EMQX',
        url: 'wss://broker.emqx.io:8084/mqtt',
        public: true,
        description: 'خادم EMQX - الأكثر استقراراً',
        status: 'مستقر ✅'
    },
    HIVEMQ: {
        name: 'HiveMQ',
        url: 'wss://broker.hivemq.com:8000/mqtt',
        public: true,
        description: 'خادم HiveMQ',
        status: 'متوسط ⚠️'
    },
    MOSQUITTO: {
        name: 'Mosquitto',
        url: 'wss://test.mosquitto.org:8081/mqtt',
        public: true,
        description: 'خادم اختبار مجاني',
        status: 'تجريبي 🔧'
    }
};

// إعدادات الاتصال المحسنة
const MQTT_OPTIONS = {
    // إعدادات أساسية
    keepalive: 60,
    clean: true,
    connectTimeout: 30000,
    
    // إعادة الاتصال التلقائي
    reconnectPeriod: 5000,
    
    // بروتوكول WebSocket
    protocolVersion: 4,  // MQTT 3.1.1
    
    // مصادقة (فارغة للخوادم العامة)
    username: '',
    password: '',
    
    // آخر رسالة (Will message)
    will: {
        topic: 'stringart/lastwill',
        payload: JSON.stringify({ online: false }),
        qos: 1,
        retain: false
    }
};

// مواضيع MQTT (بنية موحدة مع ESP32)
const TOPICS = {
    // أوامر
    COMMAND: 'stringart/command',
    COMMAND_RESPONSE: 'stringart/response',
    
    // حالة الآلة
    STATUS: 'stringart/status',
    STATUS_REQUEST: 'stringart/status/request',
    
    // إدارة الملفات
    FILE_UPLOAD: 'stringart/file/upload',
    FILE_INFO: 'stringart/file/info',
    FILE_DELETE: 'stringart/file/delete',
    FILE_REQUEST: 'stringart/file/request',
    
    // التحكم اليدوي
    MANUAL_MOVE: 'stringart/manual/move',
    MANUAL_SERVO: 'stringart/manual/servo',
    MANUAL_DRILL: 'stringart/manual/drill',
    
    // الإعدادات
    SETTINGS_UPDATE: 'stringart/settings/update',
    SETTINGS_GET: 'stringart/settings/get',
    
    // النظام
    CALIBRATE: 'stringart/calibrate',
    SYSTEM_INFO: 'stringart/system',
    ERROR_LOG: 'stringart/errors',
    
    // اتصال
    PING: 'stringart/ping',
    PONG: 'stringart/pong'
};

// إنشاء معرف جلسة فريد
function generateClientId() {
    return 'web_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

// التحقق من صحة الإعدادات
function validateConfig() {
    const errors = [];
    const warnings = [];
    
    if (!CONFIG.MACHINE_ID) {
        errors.push('❌ MACHINE_ID غير معرف');
    }
    
    if (!CONFIG.MQTT.USE_EMQX && !CONFIG.MQTT.USE_HIVEMQ && !CONFIG.MQTT.USE_MOSQUITTO) {
        errors.push('❌ لم يتم تفعيل أي خادم MQTT');
    }
    
    return { errors, warnings };
}

// الحصول على اسم الخادم النشط
function getActiveBrokerName() {
    if (CONFIG.MQTT.USE_EMQX) return 'EMQX';
    if (CONFIG.MQTT.USE_HIVEMQ) return 'HiveMQ';
    if (CONFIG.MQTT.USE_MOSQUITTO) return 'Mosquitto';
    return 'غير معروف';
}