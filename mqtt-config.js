// ==================== إعدادات MQTT المتقدمة ====================

// قائمة بخوادم MQTT مجانية (اختر واحداً)
const MQTT_BROKERS = {
    HIVEMQ: {
        name: 'HiveMQ',
        url: 'wss://broker.hivemq.com:8000/mqtt',
        public: true,
        description: 'خادم عام مجاني - موصى به'
    },
    EMQX: {
        name: 'EMQX',
        url: 'wss://broker.emqx.io:8084/mqtt',
        public: true,
        description: 'خادم عام مجاني - سريع'
    },
    MOSQUITTO: {
        name: 'Mosquitto',
        url: 'wss://test.mosquitto.org:8081/mqtt',
        public: true,
        description: 'خادم اختبار مجاني'
    }
};

// إعدادات الاتصال
const MQTT_OPTIONS = {
    // الحفاظ على الاتصال
    keepalive: 60,
    clean: true,
    connectTimeout: 30000,
    
    // إعادة الاتصال التلقائي
    reconnectPeriod: 5000,
    
    // مصادقة (إذا لزم الأمر)
    username: '',
    password: '',
    
    // آخر رسالة
    will: {
        topic: 'stringart/lastwill',
        payload: JSON.stringify({ online: false }),
        qos: 0,
        retain: false
    }
};

// ==================== إعدادات المواضيع (Topics) ====================
const TOPICS = {
    // الأوامر
    COMMAND: 'stringart/command',
    COMMAND_RESPONSE: 'stringart/command/response',
    
    // الحالة
    STATUS: 'stringart/status',
    
    // الملفات
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
    
    // المعايرة
    CALIBRATE: 'stringart/calibrate',
    
    // النظام
    SYSTEM_INFO: 'stringart/system',
    ERROR_LOG: 'stringart/errors'
};

// ==================== إنشاء معرف جلسة فريد ====================
function generateClientId() {
    return 'webclient_' + Math.random().toString(36).substring(2, 15) + 
           '_' + Date.now().toString(36);
}

// ==================== التحقق من صحة الإعدادات ====================
function validateConfig() {
    const errors = [];
    
    if (!CONFIG.MACHINE_ID) {
        errors.push('❌ MACHINE_ID غير معرف');
    }
    
    if (!CONFIG.MQTT.USE_HIVEMQ && !CONFIG.MQTT.USE_EMQX && 
        !CONFIG.MQTT.USE_MOSQUITTO && !CONFIG.FIREBASE.USE_FIREBASE) {
        errors.push('❌ لم تختر أي طريقة اتصال');
    }
    
    return errors;
}