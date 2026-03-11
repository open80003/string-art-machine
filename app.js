// ==================== المتغيرات العامة ====================
let mqttClient = null;
let currentFile = null;
let machineStatus = {
    state: 'IDLE',
    currentNail: 0,
    nextNail: 0,
    progress: 0,
    totalCommands: 0,
    executedCommands: 0,
    lastUpdate: null
};

let fileInfo = {
    name: '-',
    totalCommands: 0,
    firstNail: -1,
    lastNail: -1,
    fileSize: 0
};

// ==================== تهيئة الموقع ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 بدء تشغيل موقع التحكم...');
    
    // التحقق من الإعدادات
    const errors = validateConfig();
    if (errors.length > 0) {
        errors.forEach(error => console.error(error));
        showToast('⚠️ مشكلة في الإعدادات - راجع console', 'warning');
    }
    
    // الاتصال بـ MQTT
    connectMQTT();
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    // بدء تحديث الحالة
    startStatusUpdates();
    
    // التحقق من وجود عمل سابق
    checkForResume();
});

// ==================== الاتصال بـ MQTT ====================
function connectMQTT() {
    if (!MQTT_URL) {
        console.error('❌ لم يتم تحديد خادم MQTT');
        updateConnectionStatus(false, 'لا يوجد خادم');
        return;
    }
    
    const clientId = generateClientId();
    console.log(`📡 محاولة الاتصال بـ ${MQTT_URL} (${clientId})`);
    
    mqttClient = mqtt.connect(MQTT_URL, {
        ...MQTT_OPTIONS,
        clientId: clientId
    });
    
    mqttClient.on('connect', function() {
        console.log('✅ متصل بخادم MQTT');
        updateConnectionStatus(true, 'متصل');
        
        // الاشتراك في المواضيع
        subscribeToTopics();
        
        // إرسال رسالة ترحيب
        mqttClient.publish(TOPICS.SYSTEM_INFO, JSON.stringify({
            type: 'web_client_connected',
            timestamp: Date.now()
        }));
    });
    
    mqttClient.on('error', function(error) {
        console.error('❌ خطأ في MQTT:', error);
        updateConnectionStatus(false, 'خطأ في الاتصال');
        showToast('خطأ في الاتصال بالخادم', 'error');
    });
    
    mqttClient.on('offline', function() {
        console.log('📴 غير متصل');
        updateConnectionStatus(false, 'غير متصل');
    });
    
    mqttClient.on('message', function(topic, message) {
        handleIncomingMessage(topic, message.toString());
    });
}

// ==================== الاشتراك في المواضيع ====================
function subscribeToTopics() {
    const topics = [
        TOPICS.STATUS,
        TOPICS.FILE_INFO,
        TOPICS.COMMAND_RESPONSE,
        TOPICS.ERROR_LOG
    ];
    
    topics.forEach(topic => {
        mqttClient.subscribe(topic, function(err) {
            if (!err) {
                console.log(`📥 مشترك في: ${topic}`);
            }
        });
    });
}

// ==================== معالجة الرسائل الواردة ====================
function handleIncomingMessage(topic, message) {
    console.log(`📩 رسالة واردة من ${topic}:`, message);
    
    try {
        const data = JSON.parse(message);
        
        switch(topic) {
            case TOPICS.STATUS:
                updateMachineStatus(data);
                break;
                
            case TOPICS.FILE_INFO:
                updateFileInfo(data);
                break;
                
            case TOPICS.COMMAND_RESPONSE:
                handleCommandResponse(data);
                break;
                
            case TOPICS.ERROR_LOG:
                handleError(data);
                break;
        }
    } catch (error) {
        console.log('رسالة نصية:', message);
        // إذا كانت رسالة نصية بسيطة
        if (topic === TOPICS.STATUS) {
            try {
                const simpleData = JSON.parse(message);
                updateMachineStatus(simpleData);
            } catch {
                // تجاهل
            }
        }
    }
}

// ==================== تحديث حالة الآلة ====================
function updateMachineStatus(status) {
    machineStatus = {...machineStatus, ...status, lastUpdate: Date.now()};
    
    // تحديث الواجهة
    document.getElementById('machine-state').textContent = getStateText(machineStatus.state);
    document.getElementById('current-nail').textContent = machineStatus.currentNail;
    document.getElementById('progress').textContent = machineStatus.progress + '%';
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString('ar-SA');
    
    document.getElementById('drawing-progress').style.width = machineStatus.progress + '%';
    document.getElementById('executed-commands').textContent = machineStatus.executedCommands;
    document.getElementById('total-commands').textContent = machineStatus.totalCommands;
    document.getElementById('drawing-current').textContent = machineStatus.currentNail;
    document.getElementById('drawing-next').textContent = machineStatus.nextNail;
    
    // تحديث أزرار التحكم
    updateButtonsBasedOnState(machineStatus.state);
}

// ==================== تحديث معلومات الملف ====================
function updateFileInfo(info) {
    fileInfo = {...fileInfo, ...info};
    
    document.getElementById('file-name').textContent = fileInfo.name;
    document.getElementById('file-commands').textContent = fileInfo.totalCommands;
    document.getElementById('file-first').textContent = fileInfo.firstNail;
    document.getElementById('file-last').textContent = fileInfo.lastNail;
    document.getElementById('file-size').textContent = fileInfo.fileSize;
    
    // تفعيل زر الحذف إذا كان هناك ملف
    document.getElementById('delete-file-btn').disabled = (fileInfo.totalCommands === 0);
}

// ==================== تحديث حالة الاتصال ====================
function updateConnectionStatus(connected, text) {
    const led = document.getElementById('connection-led');
    const statusText = document.getElementById('connection-text');
    
    if (connected) {
        led.classList.add('connected');
        statusText.textContent = 'متصل';
    } else {
        led.classList.remove('connected');
        statusText.textContent = text || 'غير متصل';
    }
}

// ==================== تحديث الأزرار حسب الحالة ====================
function updateButtonsBasedOnState(state) {
    const isDrawing = (state === 'DRAWING');
    const isDrilling = (state === 'DRILLING');
    const isPaused = (state === 'PAUSED');
    const isIdle = (state === 'IDLE');
    
    // أزرار الرسم
    document.getElementById('start-drawing-btn').disabled = !isIdle || fileInfo.totalCommands === 0;
    document.getElementById('pause-drawing-btn').disabled = !isDrawing;
    document.getElementById('stop-drawing-btn').disabled = !(isDrawing || isDrilling || isPaused);
    
    // أزرار التثقيب
    document.getElementById('start-drilling-btn').disabled = !isIdle;
    document.getElementById('pause-drilling-btn').disabled = !isDrilling;
    document.getElementById('stop-drilling-btn').disabled = !(isDrawing || isDrilling || isPaused);
}

// ==================== إرسال أمر ====================
function sendCommand(command) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    const message = {
        command: command,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    mqttClient.publish(TOPICS.COMMAND, JSON.stringify(message));
    console.log('📤 أمر مرسل:', command);
    showToast(`تم إرسال الأمر: ${command}`, 'success');
}

// ==================== رفع ملف ====================
document.getElementById('file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // التحقق من الحجم
    if (file.size > CONFIG.UI.MAX_FILE_SIZE) {
        showToast('حجم الملف كبير جداً (الحد الأقصى 50 كيلوبايت)', 'error');
        return;
    }
    
    // قراءة الملف
    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        
        // التحقق من صحة المحتوى
        if (!validateFileContent(content)) {
            showToast('الملف غير صالح - تأكد من الأرقام (0-249) مفصولة بفواصل', 'error');
            return;
        }
        
        // إرسال الملف
        uploadFile(file.name, content);
    };
    
    reader.readAsText(file);
});

// ==================== التحقق من صحة الملف ====================
function validateFileContent(content) {
    const numbers = content.split(',').map(n => parseInt(n.trim()));
    
    for (let num of numbers) {
        if (isNaN(num) || num < 0 || num > 249) {
            return false;
        }
    }
    
    if (numbers.length > 4000) {
        return false;
    }
    
    return true;
}

// ==================== رفع الملف إلى ESP32 ====================
function uploadFile(fileName, content) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    const message = {
        name: fileName,
        content: content,
        timestamp: Date.now()
    };
    
    mqttClient.publish(TOPICS.FILE_UPLOAD, JSON.stringify(message));
    showToast('جاري رفع الملف...', 'success');
}

// ==================== حذف الملف ====================
function deleteFile() {
    if (!confirm('هل أنت متأكد من حذف ملف الرسم؟')) {
        return;
    }
    
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    mqttClient.publish(TOPICS.FILE_DELETE, JSON.stringify({
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    }));
    
    showToast('جاري حذف الملف...', 'warning');
}

// ==================== التحكم اليدوي ====================
function manualMove(amount) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    const steps = amount * CONFIG.UI.STEPS_PER_NAIL;
    mqttClient.publish(TOPICS.MANUAL_MOVE, JSON.stringify({
        steps: steps,
        timestamp: Date.now()
    }));
    
    const direction = amount > 0 ? 'للأمام' : 'للخلف';
    showToast(`تحريك ${Math.abs(amount)} مسمار ${direction}`, 'success');
}

function manualServo(servoId, action) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    mqttClient.publish(TOPICS.MANUAL_SERVO, JSON.stringify({
        servo: servoId,
        action: action,
        timestamp: Date.now()
    }));
}

function manualDrill(on) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    mqttClient.publish(TOPICS.MANUAL_DRILL, JSON.stringify({
        state: on ? 'ON' : 'OFF',
        timestamp: Date.now()
    }));
    
    showToast(on ? 'تشغيل المثقاب' : 'إيقاف المثقاب', 'success');
}

// ==================== المعايرة ====================
function calibrate() {
    if (!confirm('هل قمت بتدوير اللوحة يدوياً حتى أصبح القلم بين المسمار 0 والمسمار 1؟')) {
        return;
    }
    
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    mqttClient.publish(TOPICS.CALIBRATE, JSON.stringify({
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    }));
    
    showToast('جاري المعايرة...', 'success');
}

// ==================== حفظ الإعدادات ====================
function saveSettings() {
    const settings = {
        motorSpeed: parseInt(document.getElementById('motor-speed').value),
        motorAcceleration: parseInt(document.getElementById('motor-accel').value),
        penInAngle: parseInt(document.getElementById('pen-in-angle').value),
        penOutAngle: parseInt(document.getElementById('pen-out-angle').value),
        penUpAngle: parseInt(document.getElementById('pen-up-angle').value),
        penDownAngle: parseInt(document.getElementById('pen-down-angle').value),
        drillUpAngle: parseInt(document.getElementById('drill-up-angle').value),
        drillDownAngle: parseInt(document.getElementById('drill-down-angle').value),
        drillTimeMs: parseInt(document.getElementById('drill-time').value),
        wrapTimeMs: parseInt(document.getElementById('wrap-time').value)
    };
    
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    mqttClient.publish(TOPICS.SETTINGS_UPDATE, JSON.stringify(settings));
    showToast('تم حفظ الإعدادات', 'success');
}

// ==================== اختبار سيرفو ====================
function testServo(servoId, angle) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('الجهاز غير متصل', 'error');
        return;
    }
    
    mqttClient.publish(TOPICS.MANUAL_SERVO, JSON.stringify({
        servo: servoId,
        action: 'test',
        angle: angle,
        timestamp: Date.now()
    }));
    
    showToast(`اختبار سيرفو ${servoId} - زاوية ${angle}°`, 'success');
}

// ==================== التحقق من وجود عمل سابق ====================
function checkForResume() {
    // يمكن إضافة منطق للتحقق من وجود تقدم محفوظ
}

// ==================== إظهار صفحة معينة ====================
function showPage(pageId) {
    // إخفاء كل الصفحات
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // إظهار الصفحة المطلوبة
    document.getElementById(pageId + '-page').classList.add('active');
    
    // تحديث الأزرار النشطة
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.classList.add('active');
}

// ==================== إظهار رسالة ====================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== الحصول على نص الحالة ====================
function getStateText(state) {
    const states = {
        'BOOT': 'بدء التشغيل',
        'IDLE': 'في الانتظار',
        'CALIBRATION': 'معايرة',
        'DRILLING': 'تثقيب',
        'DRAWING': 'رسم',
        'PAUSED': 'متوقف مؤقتاً',
        'ERROR': 'خطأ'
    };
    return states[state] || state;
}

// ==================== بدء تحديث الحالة ====================
function startStatusUpdates() {
    setInterval(() => {
        if (mqttClient && mqttClient.connected) {
            mqttClient.publish(TOPICS.STATUS + '/request', JSON.stringify({
                machineId: CONFIG.MACHINE_ID,
                request: 'status'
            }));
        }
    }, CONFIG.UI.REFRESH_INTERVAL);
}

// ==================== إعداد مستمعي الأحداث ====================
function setupEventListeners() {
    // سحب وإفلات الملفات
    const uploadArea = document.getElementById('upload-area');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-color)';
        uploadArea.style.background = 'rgba(102, 126, 234, 0.05)';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border-color)';
        uploadArea.style.background = 'transparent';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border-color)';
        uploadArea.style.background = 'transparent';
        
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.txt')) {
            document.getElementById('file-input').files = e.dataTransfer.files;
            document.getElementById('file-input').dispatchEvent(new Event('change'));
        } else {
            showToast('الرجاء اختيار ملف .txt', 'error');
        }
    });
}

// ==================== معالجة استجابة الأوامر ====================
function handleCommandResponse(response) {
    console.log('استجابة الأمر:', response);
    
    if (response.success) {
        showToast(response.message || 'تم تنفيذ الأمر بنجاح', 'success');
    } else {
        showToast(response.message || 'فشل تنفيذ الأمر', 'error');
    }
}

// ==================== معالجة الأخطاء ====================
function handleError(error) {
    console.error('خطأ من الجهاز:', error);
    showToast(error.message || 'حدث خطأ في الجهاز', 'error');
}