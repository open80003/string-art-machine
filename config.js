// ==================== إعدادات الموقع ====================
// ⚠️ قم بتعديل هذه القيم حسب مشروعك

const CONFIG = {
    // معرف الآلة (يجب أن يطابق المعرف في كود ESP32)
    MACHINE_ID: 'machine_001',
    
    // إعدادات MQTT (اختر واحداً من الخيارات أدناه)
    MQTT: {
        // الخيار 1: HiveMQ (مجاني - موصى به)
        USE_HIVEMQ: true,
        HIVEMQ_URL: 'wss://broker.hivemq.com:8000/mqtt',
        
        // الخيار 2: EMQX (مجاني)
        USE_EMQX: false,
        EMQX_URL: 'wss://broker.emqx.io:8084/mqtt',
        
        // الخيار 3: Mosquitto (مجاني)
        USE_MOSQUITTO: false,
        MOSQUITTO_URL: 'wss://test.mosquitto.org:8081/mqtt',
        
        // إعدادات مشتركة
        TOPICS: {
            COMMAND: 'stringart/command',      // إرسال الأوامر
            STATUS: 'stringart/status',         // استقبال الحالة
            FILE: 'stringart/file',              // إرسال الملفات
            MANUAL: 'stringart/manual'           // أوامر التحكم اليدوي
        }
    },
    
    // إعدادات Firebase (بديل عن MQTT - استخدم واحداً فقط)
    FIREBASE: {
        USE_FIREBASE: false,                     // true إذا أردت استخدام Firebase
        DATABASE_URL: 'https://your-project.firebaseio.com',
        API_KEY: 'your-api-key'
    },
    
    // إعدادات الموقع
    UI: {
        REFRESH_INTERVAL: 1000,                  // تحديث كل ثانية
        MAX_FILE_SIZE: 50 * 1024,                 // 50 كيلوبايت
        TOTAL_NAILS: 250,
        STEPS_PER_NAIL: 16
    }
};

// لا تغير هذا - يحدد أي MQTT سنستخدم
let MQTT_URL = '';

if (CONFIG.MQTT.USE_HIVEMQ) {
    MQTT_URL = CONFIG.MQTT.HIVEMQ_URL;
} else if (CONFIG.MQTT.USE_EMQX) {
    MQTT_URL = CONFIG.MQTT.EMQX_URL;
} else if (CONFIG.MQTT.USE_MOSQUITTO) {
    MQTT_URL = CONFIG.MQTT.MOSQUITTO_URL;
}