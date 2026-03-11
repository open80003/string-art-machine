// ==================== إعدادات الموقع ====================
// ✅ نسخة معدلة - تستخدم EMQX فقط

const CONFIG = {
    // معرف الآلة - يجب أن يطابق المعرف في كود ESP32
    MACHINE_ID: 'machine_001',
    
    // إعدادات MQTT - EMQX فقط (الأكثر استقراراً)
    MQTT: {
        USE_EMQX: true,           // ✅ EMQX مفعل
        EMQX_URL: 'wss://broker.emqx.io:8084/mqtt',  // رابط EMQX الصحيح
        
        // ملاحظة: تم إزالة HiveMQ و Mosquitto تماماً
    },
    
    // إعدادات الموقع والواجهة
    UI: {
        REFRESH_INTERVAL: 1000,           // تحديث كل ثانية
        MAX_FILE_SIZE: 100 * 1024,         // 100 كيلوبايت (للملفات الكبيرة)
        TOTAL_NAILS: 250,                   // إجمالي المسامير
        STEPS_PER_NAIL: 16                  // خطوات بين كل مسمار
    }
};

// تحديد عنوان MQTT النشط - EMQX فقط
const MQTT_URL = CONFIG.MQTT.EMQX_URL;
console.log('✅ استخدام خادم EMQX:', MQTT_URL);
console.log('❌ تم تعطيل HiveMQ تماماً');
