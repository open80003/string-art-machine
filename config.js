// ==================== إعدادات الموقع ====================
const CONFIG = {
    // معرف الآلة - يجب أن يطابق المعرف في كود ESP32
    MACHINE_ID: 'machine_001',
    
    // إعدادات MQTT - استخدام EMQX (الأكثر استقراراً)
    MQTT: {
    USE_HIVEMQ: false,        // عطل HiveMQ
    USE_EMQX: true,           // فعّل EMQX
    USE_MOSQUITTO: false,
    
    EMQX_URL: 'wss://broker.emqx.io:8084/mqtt',  // الرابط الصحيح
}
    
    // إعدادات الموقع والواجهة
    UI: {
        REFRESH_INTERVAL: 1000,           // تحديث كل ثانية
        MAX_FILE_SIZE: 50 * 1024,          // 50 كيلوبايت كحد أقصى
        TOTAL_NAILS: 250,                   // إجمالي المسامير
        STEPS_PER_NAIL: 16                  // خطوات بين كل مسمار
    }
};

// تحديد عنوان MQTT النشط تلقائياً
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
