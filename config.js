// ==================== إعدادات الموقع ====================
// ✅ نسخة كاملة ومعدلة لتعمل مع EMQX

const CONFIG = {
    // معرف الآلة (يجب أن يطابق المعرف في كود ESP32)
    MACHINE_ID: 'machine_001',
    
    // إعدادات MQTT - استخدام EMQX
    MQTT: {
        USE_HIVEMQ: false,        // عطل HiveMQ
        USE_EMQX: true,           // فعّل EMQX (مستقر)
        USE_MOSQUITTO: false,     // عطل Mosquitto
        
        // روابط الخوادم
        HIVEMQ_URL: 'wss://broker.hivemq.com:8000/mqtt',
        EMQX_URL: 'wss://broker.emqx.io:8084/mqtt',  // EMQX عبر WebSocket
        MOSQUITTO_URL: 'wss://test.mosquitto.org:8081/mqtt',
        
        // مواضيع MQTT الأساسية
        TOPICS: {
            COMMAND: 'stringart/command',
            STATUS: 'stringart/status',
            FILE: 'stringart/file',
            MANUAL: 'stringart/manual',
            SETTINGS: 'stringart/settings',
            RESPONSE: 'stringart/response'
        }
    },
    
    // إعدادات Firebase (معطل - غير مستخدم)
    FIREBASE: {
        USE_FIREBASE: false,
        DATABASE_URL: 'https://your-project.firebaseio.com',
        API_KEY: 'your-api-key'
    },
    
    // إعدادات الموقع والواجهة
    UI: {
        REFRESH_INTERVAL: 1000,           // تحديث كل ثانية
        MAX_FILE_SIZE: 50 * 1024,          // 50 كيلوبايت كحد أقصى
        TOTAL_NAILS: 250,                   // إجمالي المسامير
        STEPS_PER_NAIL: 16                  // خطوات بين كل مسمار
    }
};

// تحديد عنوان MQTT النشط (تلقائي)
let MQTT_URL = '';

if (CONFIG.MQTT.USE_EMQX) {
    MQTT_URL = CONFIG.MQTT.EMQX_URL;
    console.log('✅ استخدام خادم EMQX');
} else if (CONFIG.MQTT.USE_HIVEMQ) {
    MQTT_URL = CONFIG.MQTT.HIVEMQ_URL;
    console.log('⚠️ استخدام خادم HiveMQ');
} else if (CONFIG.MQTT.USE_MOSQUITTO) {
    MQTT_URL = CONFIG.MQTT.MOSQUITTO_URL;
    console.log('⚠️ استخدام خادم Mosquitto');
}
