// ==================== ملف app.js الكامل ====================

// ==================== المتغيرات العامة ====================
let mqttClient = null;
let mqttReconnectCount = 0;
let connectionCheckInterval = null;

let machineStatus = {
    state: 'IDLE',
    currentNail: 0,
    nextNail: 0,
    progress: 0,
    totalCommands: 0,
    executedCommands: 0,
    lastUpdate: null,
    rssi: 0
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
    console.log('📋 معرف الآلة:', CONFIG.MACHINE_ID);
    
    // التحقق من الإعدادات
    const { errors, warnings } = validateConfig();
    
    if (errors.length > 0) {
        errors.forEach(error => {
            console.error(error);
            showToast(error, 'error');
        });
        return;
    }
    
    // الاتصال بـ MQTT
    connectMQTT();
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    // بدء تحديث الحالة
    startStatusUpdates();
    
    // فحص الاتصال بشكل دوري
    startConnectionCheck();
    
    console.log('✅ تم تهيئة الموقع بنجاح');
});


        // ==================== الاتصال بـ MQTT (نسخة EMQX فقط) ====================
function connectMQTT() {
    if (!MQTT_URL) {
        console.error('❌ لم يتم تحديد خادم MQTT');
        updateConnectionStatus(false, 'لا يوجد خادم');
        return;
    }
    
    const clientId = generateClientId();
    console.log(`📡 محاولة الاتصال بـ EMQX: ${MQTT_URL}`);
    console.log(`📋 معرف الجلسة: ${clientId}`);
    
    // إنهاء الاتصال القديم إذا وجد
    if (mqttClient) {
        try {
            mqttClient.end(true);
        } catch (e) {
            // تجاهل الأخطاء
        }
    }
    
    // إعدادات مخصصة لـ EMQX
    const options = {
        ...MQTT_OPTIONS,
        clientId: clientId,
        reconnectPeriod: 3000,
        connectTimeout: 15000,  // زيادة المهلة
        protocolVersion: 4,      // MQTT 3.1.1
        
        // إعدادات خاصة بـ EMQX
        keepalive: 60,
        clean: true,
        
        // تجربة إعادة الاتصال بشكل متكرر
        reconnectPeriod: 2000
    };
    
    try {
        mqttClient = mqtt.connect(MQTT_URL, options);
    } catch (error) {
        console.error('❌ فشل إنشاء اتصال MQTT:', error);
        updateConnectionStatus(false, 'فشل الاتصال');
        return;
    }
    
    // حدث الاتصال الناجح
    mqttClient.on('connect', function() {
        console.log('✅ متصل بـ EMQX بنجاح!');
        updateConnectionStatus(true, 'متصل');
        
        // الاشتراك في المواضيع
        subscribeToTopics();
        
        // إرسال رسالة ترحيب
        publishWelcome();
        
        showToast('✅ متصل بالخادم', 'success');
    });
    
    // حدث الخطأ
    mqttClient.on('error', function(error) {
        console.error('❌ خطأ MQTT:', error);
        updateConnectionStatus(false, 'خطأ في الاتصال');
    });
    
    // حدث فقدان الاتصال
    mqttClient.on('offline', function() {
        console.log('📴 فقدان الاتصال بالخادم');
        updateConnectionStatus(false, 'غير متصل');
    });
    
    // حدث إعادة الاتصال
    mqttClient.on('reconnect', function() {
        console.log('🔄 جاري إعادة الاتصال بـ EMQX...');
        updateConnectionStatus(false, 'جاري إعادة الاتصال');
    });
    
    // حدث استلام رسالة
    mqttClient.on('message', function(topic, message) {
        handleIncomingMessage(topic, message.toString());
    });
    
    // حدث إغلاق الاتصال
    mqttClient.on('close', function() {
        console.log('🔌 تم إغلاق الاتصال');
    });
}

function subscribeToTopics() {
    if (!mqttClient || !mqttClient.connected) {
        console.log('⚠️ لا يمكن الاشتراك - MQTT غير متصل');
        return;
    }
    
    const machineId = CONFIG.MACHINE_ID;
    
    // مواضيع للاشتراك (معرف الآلة في نهاية الموضوع)
    const topics = [
        `${TOPICS.STATUS}/${machineId}`,
        `${TOPICS.FILE_INFO}/${machineId}`,
        `${TOPICS.COMMAND_RESPONSE}/${machineId}`,
        `${TOPICS.ERROR_LOG}/${machineId}`,
        `${TOPICS.PONG}/${machineId}`,
        `${TOPICS.SYSTEM_INFO}/${machineId}`
    ];
    
    console.log('📥 الاشتراك في المواضيع:');
    
    topics.forEach(topic => {
        mqttClient.subscribe(topic, { qos: 1 }, function(err) {
            if (!err) {
                console.log(`   ✅ ${topic}`);
                
                // طلب معلومات فورية
                if (topic.includes(TOPICS.STATUS)) {
                    requestStatus();
                } else if (topic.includes(TOPICS.FILE_INFO)) {
                    requestFileInfo();
                }
            } else {
                console.log(`   ❌ ${topic}`);
            }
        });
    });
}

function publishWelcome() {
    if (!mqttClient || !mqttClient.connected) return;
    
    const topic = `${TOPICS.SYSTEM_INFO}/${CONFIG.MACHINE_ID}`;
    const message = {
        type: 'web_client_connected',
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now(),
        browser: navigator.userAgent
    };
    
    mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
}

// ==================== دوال الطلبات ====================

function requestStatus() {
    if (!mqttClient || !mqttClient.connected) return;
    
    const topic = `${TOPICS.STATUS_REQUEST}/${CONFIG.MACHINE_ID}`;
    const message = {
        request: 'status',
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
}

function requestFileInfo() {
    if (!mqttClient || !mqttClient.connected) return;
    
    const topic = `${TOPICS.FILE_REQUEST}/${CONFIG.MACHINE_ID}`;
    const message = {
        request: 'file_info',
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
}

// ==================== إرسال الأوامر ====================

function sendCommand(command) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const topic = `${TOPICS.COMMAND}/${CONFIG.MACHINE_ID}`;
    const message = {
        command: command,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    console.log(`📤 إرسال أمر: ${command} إلى ${topic}`);
    
    mqttClient.publish(topic, JSON.stringify(message), { qos: 1 }, function(err) {
        if (err) {
            console.error('❌ فشل إرسال الأمر:', err);
            showToast(`❌ فشل إرسال الأمر`, 'error');
        } else {
            console.log('✅ تم إرسال الأمر');
            showToast(`📤 تم إرسال الأمر`, 'success');
        }
    });
}

// ==================== رفع الملف ====================

function uploadFile(fileName, content) {
    console.log('📤 محاولة رفع ملف:', fileName);
    console.log('   - حجم الملف:', content.length, 'بايت');
    
    if (!mqttClient || !mqttClient.connected) {
        console.error('❌ MQTT غير متصل!');
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const topic = `${TOPICS.FILE_UPLOAD}/${CONFIG.MACHINE_ID}`;
    console.log('   - موضوع الإرسال:', topic);
    
    const message = {
        name: fileName,
        content: content,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now(),
        size: content.length
    };
    
    mqttClient.publish(topic, JSON.stringify(message), { qos: 2 }, function(err) {
        if (err) {
            console.error('❌ فشل إرسال الملف:', err);
            showToast('❌ فشل رفع الملف', 'error');
        } else {
            console.log('✅ تم إرسال الملف بنجاح!');
            showToast('📤 جاري رفع الملف...', 'info');
            
            // طلب معلومات الملف بعد ثانيتين
            setTimeout(() => {
                requestFileInfo();
            }, 2000);
        }
    });
}

function deleteFile() {
    if (!confirm('هل أنت متأكد من حذف ملف الرسم؟')) return;
    
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const topic = `${TOPICS.FILE_DELETE}/${CONFIG.MACHINE_ID}`;
    const message = {
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
    showToast('📤 جاري حذف الملف...', 'warning');
}

// ==================== معالجة الرسائل الواردة ====================

function handleIncomingMessage(topic, message) {
    console.log(`📩 رسالة من: ${topic}`);
    
    try {
        const data = JSON.parse(message);
        
        // التحقق من أن الرسالة موجهة لهذه الآلة
        if (data.machineId && data.machineId !== CONFIG.MACHINE_ID) {
            return;
        }
        
        if (topic.includes(TOPICS.STATUS)) {
            updateMachineStatus(data);
        }
        else if (topic.includes(TOPICS.FILE_INFO)) {
            updateFileInfo(data);
            showToast('📄 تم تحديث معلومات الملف', 'info');
        }
        else if (topic.includes(TOPICS.COMMAND_RESPONSE)) {
            handleCommandResponse(data);
        }
        else if (topic.includes(TOPICS.ERROR_LOG)) {
            handleError(data);
        }
        else if (topic.includes(TOPICS.SYSTEM_INFO)) {
            console.log('ℹ️ معلومات النظام:', data);
        }
        
    } catch (error) {
        console.log('📨 رسالة نصية:', message);
    }
}

// ==================== دوال التحديث ====================

function updateMachineStatus(status) {
    machineStatus = { ...machineStatus, ...status, lastUpdate: Date.now() };
    
    document.getElementById('machine-state').textContent = getStateText(machineStatus.state);
    document.getElementById('current-nail').textContent = machineStatus.currentNail;
    document.getElementById('progress').textContent = machineStatus.progress + '%';
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString('ar-SA');
    
    document.getElementById('drawing-progress').style.width = machineStatus.progress + '%';
    document.getElementById('executed-commands').textContent = machineStatus.executedCommands;
    document.getElementById('total-commands').textContent = machineStatus.totalCommands;
    document.getElementById('drawing-current').textContent = machineStatus.currentNail;
    document.getElementById('drawing-next').textContent = machineStatus.nextNail;
    
    updateButtonsBasedOnState(machineStatus.state);
}

function updateFileInfo(info) {
    fileInfo = { ...fileInfo, ...info };
    
    document.getElementById('file-name').textContent = fileInfo.name;
    document.getElementById('file-commands').textContent = fileInfo.totalCommands;
    document.getElementById('file-first').textContent = fileInfo.firstNail;
    document.getElementById('file-last').textContent = fileInfo.lastNail;
    document.getElementById('file-size').textContent = fileInfo.fileSize;
    
    document.getElementById('delete-file-btn').disabled = (fileInfo.totalCommands === 0);
}

function updateConnectionStatus(connected, text) {
    const led = document.getElementById('connection-led');
    const statusText = document.getElementById('connection-text');
    
    if (connected) {
        led.classList.add('connected');
        statusText.textContent = text || 'متصل';
    } else {
        led.classList.remove('connected');
        statusText.textContent = text || 'غير متصل';
    }
}

function updateButtonsBasedOnState(state) {
    const isDrawing = (state === 'DRAWING');
    const isDrilling = (state === 'DRILLING');
    const isPaused = (state === 'PAUSED');
    const isIdle = (state === 'IDLE');
    
    const startBtn = document.getElementById('start-drawing-btn');
    const pauseBtn = document.getElementById('pause-drawing-btn');
    const stopBtn = document.getElementById('stop-drawing-btn');
    
    if (startBtn) startBtn.disabled = !isIdle || fileInfo.totalCommands === 0;
    if (pauseBtn) pauseBtn.disabled = !isDrawing;
    if (stopBtn) stopBtn.disabled = !(isDrawing || isDrilling || isPaused);
    
    const startDrillBtn = document.getElementById('start-drilling-btn');
    const pauseDrillBtn = document.getElementById('pause-drilling-btn');
    const stopDrillBtn = document.getElementById('stop-drilling-btn');
    
    if (startDrillBtn) startDrillBtn.disabled = !isIdle;
    if (pauseDrillBtn) pauseDrillBtn.disabled = !isDrilling;
    if (stopDrillBtn) stopDrillBtn.disabled = !(isDrawing || isDrilling || isPaused);
}

// ==================== التحكم اليدوي ====================

function manualMove(amount) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const steps = amount * CONFIG.UI.STEPS_PER_NAIL;
    const topic = `${TOPICS.MANUAL_MOVE}/${CONFIG.MACHINE_ID}`;
    const message = {
        steps: steps,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message));
    
    const direction = amount > 0 ? 'للأمام' : 'للخلف';
    showToast(`🖐️ تحريك ${Math.abs(amount)} مسمار ${direction}`, 'success');
}

function manualServo(servoId, action) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const topic = `${TOPICS.MANUAL_SERVO}/${CONFIG.MACHINE_ID}`;
    const message = {
        servo: servoId,
        action: action,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message));
}

function manualDrill(on) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const topic = `${TOPICS.MANUAL_DRILL}/${CONFIG.MACHINE_ID}`;
    const message = {
        state: on ? 'ON' : 'OFF',
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message));
    showToast(on ? '🔴 تشغيل المثقاب' : '⚫ إيقاف المثقاب', 'success');
}

function calibrate() {
    if (!confirm('هل قمت بتدوير اللوحة يدوياً حتى أصبح القلم بين المسمار 0 والمسمار 1؟')) {
        return;
    }
    
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const topic = `${TOPICS.CALIBRATE}/${CONFIG.MACHINE_ID}`;
    const message = {
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message));
    showToast('📤 جاري المعايرة...', 'success');
}

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
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const topic = `${TOPICS.SETTINGS_UPDATE}/${CONFIG.MACHINE_ID}`;
    const message = {
        ...settings,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
    showToast('⚙️ تم حفظ الإعدادات', 'success');
}

function testServo(servoId, angle) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    const topic = `${TOPICS.MANUAL_SERVO}/${CONFIG.MACHINE_ID}`;
    const message = {
        servo: servoId,
        action: 'test',
        angle: angle,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now()
    };
    
    mqttClient.publish(topic, JSON.stringify(message));
    showToast(`🔄 اختبار سيرفو ${servoId} - زاوية ${angle}°`, 'success');
}

// ==================== دوال المساعدة ====================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    document.getElementById(pageId + '-page').classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.classList.add('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

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

function startStatusUpdates() {
    setInterval(() => {
        if (mqttClient && mqttClient.connected) {
            requestStatus();
        }
    }, CONFIG.UI.REFRESH_INTERVAL);
}

function startConnectionCheck() {
    connectionCheckInterval = setInterval(() => {
        if (mqttClient && !mqttClient.connected) {
            updateConnectionStatus(false, 'غير متصل');
        }
    }, 2000);
}

function setupEventListeners() {
    // منطقة سحب وإفلات الملفات
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    if (uploadArea) {
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
                handleFileSelect(file);
            } else {
                showToast('❌ الرجاء اختيار ملف .txt', 'error');
            }
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                handleFileSelect(file);
            }
        });
    }
}

function handleFileSelect(file) {
    console.log('📁 تم اختيار ملف:', file.name);
    console.log('   - الحجم:', file.size, 'بايت');
    
    if (file.size > CONFIG.UI.MAX_FILE_SIZE) {
        showToast('❌ حجم الملف كبير جداً (الحد الأقصى 50 كيلوبايت)', 'error');
        return;
    }
    
    if (!file.name.endsWith('.txt')) {
        showToast('❌ الملف يجب أن يكون .txt', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        
        if (!validateFileContent(content)) {
            showToast('❌ الملف غير صالح - الأرقام يجب أن تكون بين 0-249', 'error');
            return;
        }
        
        uploadFile(file.name, content);
    };
    
    reader.readAsText(file);
}

function validateFileContent(content) {
    const numbers = content.split(',').map(n => parseInt(n.trim()));
    
    for (let num of numbers) {
        if (isNaN(num) || num < 0 || num > 249) {
            return false;
        }
    }
    
    return numbers.length <= 4000;
}

function handleCommandResponse(response) {
    console.log('📨 استجابة:', response);
    
    if (response.success) {
        showToast('✅ ' + (response.message || 'تم بنجاح'), 'success');
    } else {
        showToast('❌ ' + (response.message || 'فشل'), 'error');
    }
}

function handleError(error) {
    console.error('⚠️ خطأ:', error);
    showToast('⚠️ ' + (error.message || 'حدث خطأ في الجهاز'), 'error');
}

// ==================== دوال التشخيص ====================

window.checkConnection = function() {
    console.log('🔍 تشخيص الاتصال:');
    console.log('   - MQTT client:', mqttClient ? 'موجود' : 'غير موجود');
    console.log('   - متصل؟', mqttClient ? (mqttClient.connected ? '✅' : '❌') : '❌');
    console.log('   - معرف الآلة:', CONFIG.MACHINE_ID);
    console.log('   - الخادم:', getActiveBrokerName());
    console.log('   - الرابط:', MQTT_URL);
    
    if (mqttClient && !mqttClient.connected) {
        console.log('🔄 محاولة إعادة الاتصال...');
        connectMQTT();
    }
}

window.testFileUpload = function() {
    document.getElementById('file-input').click();
}

// تصدير الدوال العامة
window.showPage = showPage;
window.sendCommand = sendCommand;
window.deleteFile = deleteFile;
window.manualMove = manualMove;
window.manualServo = manualServo;
window.manualDrill = manualDrill;
window.calibrate = calibrate;
window.saveSettings = saveSettings;
window.testServo = testServo;
