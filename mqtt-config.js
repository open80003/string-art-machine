// ==================== إعدادات MQTT المتقدمة ====================
// ✅ نسخة معدلة - EMQX فقط

// قائمة بخوادم MQTT - EMQX فقط
const MQTT_BROKERS = {
    EMQX: {
        name: 'EMQX',
        url: 'wss://broker.emqx.io:8084/mqtt',
        public: true,
        description: 'خادم EMQX - الأكثر استقراراً',
        status: 'مستقر ✅'
    }
    // ❌ تمت إزالة HiveMQ و Mosquitto
};

// إعدادات الاتصال المحسنة
const MQTT_OPTIONS = {
    // إعدادات أساسية
    keepalive: 60,
    clean: true,
    connectTimeout: 30000,
    
    // إعادة الاتصال التلقائي
    reconnectPeriod: 3000,        // 3 ثواني بين المحاولات
    
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
    },
    
    // إعدادات إضافية للاستقرار
    resubscribe: true,
    qos: 1
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
    
    if (!CONFIG.MQTT.USE_EMQX) {
        errors.push('❌ EMQX غير مفعل - يجب تفعيله');
    }
    
    return { errors, warnings };
}

// الحصول على اسم الخادم النشط
function getActiveBrokerName() {
    return 'EMQX';  // دائماً EMQX
}
