// ==================== إعدادات MQTT المتقدمة ====================
// ✅ نسخة كاملة مع دعم EMQX

// قائمة بخوادم MQTT المتاحة
const MQTT_BROKERS = {
    EMQX: {
        name: 'EMQX',
        url: 'wss://broker.emqx.io:8084/mqtt',
        public: true,
        description: 'خادم EMQX - الأكثر استقراراً في المنطقة',
        status: 'مستقر ✅'
    },
    HIVEMQ: {
        name: 'HiveMQ',
        url: 'wss://broker.hivemq.com:8000/mqtt',
        public: true,
        description: 'خادم HiveMQ - قد تحدث مشاكل في الاتصال',
        status: 'غير مستقر ⚠️'
    },
    MOSQUITTO: {
        name: 'Mosquitto',
        url: 'wss://test.mosquitto.org:8081/mqtt',
        public: true,
        description: 'خادم اختبار مجاني - للاختبار فقط',
        status: 'تجريبي 🔧'
    }
};

// إعدادات الاتصال المحسنة
const MQTT_OPTIONS = {
    // إعدادات أساسية
    keepalive: 60,                    // 60 ثانية بين نبضات الحياة
    clean: true,                       // جلسة نظيفة
    connectTimeout: 30000,              // 30 ثانية مهلة الاتصال
    
    // إعادة الاتصال التلقائي
    reconnectPeriod: 5000,              // إعادة المحاولة كل 5 ثواني
    
    // مصادقة (إذا لزم الأمر)
    username: '',
    password: '',
    
    // آخر رسالة (Will message)
    will: {
        topic: 'stringart/lastwill',
        payload: JSON.stringify({ online: false, machineId: CONFIG.MACHINE_ID }),
        qos: 1,
        retain: false
    },
    
    // إعدادات متقدمة
    protocolVersion: 4,                 // MQTT 3.1.1
    resubscribe: true,                  // إعادة الاشتراك تلقائياً
    qos: 1                              // جودة الخدمة
};

// مواضيع MQTT المفصلة
const TOPICS = {
    // أوامر
    COMMAND: 'stringart/command',
    COMMAND_RESPONSE: 'stringart/command/response',
    
    // حالة الآلة
    STATUS: 'stringart/status',
    STATUS_REQUEST: 'stringart/status/request',
    
    // إدارة الملفات
    FILE_UPLOAD: 'stringart/file/upload',
    FILE_INFO: 'stringart/file/info',
    FILE_DELETE: 'stringart/file/delete',
    
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

// إنشاء معرف جلسة فريد للمتصفح
function generateClientId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return 'web_' + random + '_' + timestamp;
}

// التحقق من صحة الإعدادات
function validateConfig() {
    const errors = [];
    const warnings = [];
    
    // التحقق من MACHINE_ID
    if (!CONFIG.MACHINE_ID) {
        errors.push('❌ MACHINE_ID غير معرف');
    } else if (CONFIG.MACHINE_ID === 'machine_001') {
        warnings.push('⚠️ أنت تستخدم معرف الآلة الافتراضي');
    }
    
    // التحقق من اختيار خادم MQTT
    if (!CONFIG.MQTT.USE_EMQX && !CONFIG.MQTT.USE_HIVEMQ && !CONFIG.MQTT.USE_MOSQUITTO) {
        errors.push('❌ لم تختر أي خادم MQTT');
    }
    
    // تحذير إذا كان HiveMQ مفعلاً
    if (CONFIG.MQTT.USE_HIVEMQ) {
        warnings.push('⚠️ HiveMQ قد يسبب مشاكل في الاتصال - استخدم EMQX');
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

// تصدير الدوال والمتغيرات
const MQTT_CONFIG = {
    brokers: MQTT_BROKERS,
    options: MQTT_OPTIONS,
    topics: TOPICS,
    generateClientId,
    validateConfig,
    getActiveBrokerName
};
