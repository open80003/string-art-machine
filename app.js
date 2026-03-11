// ==================== ملف app.js الكامل ====================
// نظام التحكم بآلة String Art - واجهة المستخدم
// الإصدار: 3.0 - متوافق مع EMQX

// ==================== المتغيرات العامة ====================
let mqttClient = null;
let currentFile = null;
let mqttReconnectCount = 0;

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
    console.log('📋 إعدادات الموقع:', CONFIG);
    
    // التحقق من الإعدادات
    const { errors, warnings } = validateConfig();
    
    if (errors.length > 0) {
        errors.forEach(error => {
            console.error(error);
            showToast(error, 'error');
        });
        return;
    }
    
    if (warnings.length > 0) {
        warnings.forEach(warning => {
            console.warn(warning);
            showToast(warning, 'warning');
        });
    }
    
    // الاتصال بـ MQTT
    connectMQTT();
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    // بدء تحديث الحالة
    startStatusUpdates();
    
    // التحقق من وجود عمل سابق
    checkForResume();
    
    console.log('✅ تم تهيئة الموقع بنجاح');
});

// ==================== الدوال الرئيسية ====================

// -------------------- الاتصال بـ MQTT --------------------
function connectMQTT() {
    if (!MQTT_URL) {
        console.error('❌ لم يتم تحديد خادم MQTT');
        updateConnectionStatus(false, 'لا يوجد خادم');
        showToast('❌ لم يتم تحديد خادم MQTT في الإعدادات', 'error');
        return;
    }
    
    const clientId = generateClientId();
    const brokerName = CONFIG.MQTT.USE_EMQX ? 'EMQX' : (CONFIG.MQTT.USE_HIVEMQ ? 'HiveMQ' : 'Mosquitto');
    
    console.log(`📡 محاولة الاتصال بخادم ${brokerName}: ${MQTT_URL}`);
    console.log(`📋 معرف الجلسة: ${clientId}`);
    
    // خيارات مخصصة حسب الخادم
    const options = {
        ...MQTT_OPTIONS,
        clientId: clientId,
        reconnectPeriod: 3000,
        connectTimeout: 10000,
    };
    
    // خيارات إضافية لـ EMQX
    if (CONFIG.MQTT.USE_EMQX) {
        options.protocolVersion = 4;
        console.log('✅ استخدام إعدادات محسنة لـ EMQX');
    }
    
    try {
        mqttClient = mqtt.connect(MQTT_URL, options);
    } catch (error) {
        console.error('❌ فشل إنشاء اتصال MQTT:', error);
        updateConnectionStatus(false, 'فشل الاتصال');
        showToast('❌ فشل إنشاء اتصال MQTT', 'error');
        return;
    }
    
    // حدث الاتصال الناجح
    mqttClient.on('connect', function(connack) {
        console.log('✅ متصل بخادم MQTT بنجاح!');
        console.log('📊 تفاصيل الاتصال:', connack);
        
        updateConnectionStatus(true, `متصل بـ ${brokerName}`);
        
        // الاشتراك في المواضيع
        subscribeToTopics();
        
        // إرسال رسالة ترحيب
        const welcomeMsg = {
            type: 'web_client_connected',
            machineId: CONFIG.MACHINE_ID,
            clientId: clientId,
            timestamp: Date.now(),
            browser: navigator.userAgent
        };
        
        mqttClient.publish(
            `${TOPICS.SYSTEM_INFO}/${CONFIG.MACHINE_ID}`, 
            JSON.stringify(welcomeMsg),
            { qos: 1 }
        );
        
        // طلب الحالة الحالية من ESP32
        setTimeout(() => {
            mqttClient.publish(
                `${TOPICS.STATUS_REQUEST}/${CONFIG.MACHINE_ID}`,
                JSON.stringify({ request: 'status', timestamp: Date.now() })
            );
        }, 1000);
        
        showToast(`✅ متصل بخادم ${brokerName}`, 'success');
    });
    
    // حدث الخطأ
    mqttClient.on('error', function(error) {
        console.error('❌ خطأ في MQTT:', error);
        updateConnectionStatus(false, 'خطأ في الاتصال');
        
        if (error.message) {
            showToast(`❌ خطأ: ${error.message}`, 'error');
        } else {
            showToast('❌ خطأ في الاتصال بالخادم', 'error');
        }
    });
    
    // حدث فقدان الاتصال
    mqttClient.on('offline', function() {
        console.log('📴 غير متصل - فقدان الاتصال بالخادم');
        updateConnectionStatus(false, 'غير متصل');
        showToast('📴 تم فقدان الاتصال بالخادم', 'warning');
    });
    
    // حدث إعادة الاتصال
    mqttClient.on('reconnect', function() {
        console.log('🔄 جاري إعادة الاتصال بالخادم...');
        updateConnectionStatus(false, 'جاري إعادة الاتصال');
    });
    
    // حدث استلام رسالة
    mqttClient.on('message', function(topic, message) {
        handleIncomingMessage(topic, message.toString());
    });
    
    // حدث إغلاق الاتصال
    mqttClient.on('close', function() {
        console.log('🔌 تم إغلاق الاتصال');
        updateConnectionStatus(false, 'اتصال مغلق');
    });
}

// -------------------- الاشتراك في المواضيع --------------------
function subscribeToTopics() {
    if (!mqttClient || !mqttClient.connected) {
        console.log('⚠️ لا يمكن الاشتراك - MQTT غير متصل');
        return;
    }
    
    const machineId = CONFIG.MACHINE_ID;
    
    // قائمة المواضيع للاشتراك
    const topics = [
        `${TOPICS.STATUS}/${machineId}`,
        `${TOPICS.FILE_INFO}/${machineId}`,
        `${TOPICS.COMMAND_RESPONSE}/${machineId}`,
        `${TOPICS.ERROR_LOG}/${machineId}`,
        `${TOPICS.PONG}/${machineId}`,
        `${TOPICS.SYSTEM_INFO}/${machineId}`
    ];
    
    console.log('📥 محاولة الاشتراك في المواضيع:');
    
    topics.forEach(topic => {
        mqttClient.subscribe(topic, { qos: 1 }, function(err, granted) {
            if (!err) {
                console.log(`   ✅ مشترك في: ${topic}`);
                
                // طلب معلومات فورية بعد الاشتراك
                if (topic.includes(TOPICS.STATUS)) {
                    mqttClient.publish(
                        `${TOPICS.STATUS_REQUEST}/${machineId}`,
                        JSON.stringify({ request: 'initial_status' })
                    );
                } else if (topic.includes(TOPICS.FILE_INFO)) {
                    mqttClient.publish(
                        `${TOPICS.FILE_INFO}/request/${machineId}`,
                        JSON.stringify({ request: 'file_info' })
                    );
                }
            } else {
                console.log(`   ❌ فشل الاشتراك في: ${topic}`, err);
            }
        });
    });
    
    // إرسال ping للتأكد من الاتصال
    setTimeout(() => {
        mqttClient.publish(
            `${TOPICS.PING}/${machineId}`,
            JSON.stringify({ type: 'ping', timestamp: Date.now() })
        );
    }, 2000);
}

// -------------------- معالجة الرسائل الواردة --------------------
function handleIncomingMessage(topic, message) {
    console.log(`📩 رسالة واردة من: ${topic}`);
    console.log(`📝 المحتوى:`, message);
    
    try {
        const data = JSON.parse(message);
        
        // التحقق من أن الرسالة موجهة لهذه الآلة
        if (data.machineId && data.machineId !== CONFIG.MACHINE_ID) {
            console.log(`⏭️ تجاهل رسالة لآلة أخرى: ${data.machineId}`);
            return;
        }
        
        // معالجة حسب نوع الرسالة
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
            showToast(`⚠️ خطأ من الجهاز: ${data.message || 'خطأ غير معروف'}`, 'error');
        }
        else if (topic.includes(TOPICS.PONG)) {
            console.log('🏓 استجابة ping من ESP32');
            updateConnectionStatus(true, 'متصل (مستجيب)');
        }
        else if (topic.includes(TOPICS.SYSTEM_INFO)) {
            console.log('ℹ️ معلومات النظام:', data);
            if (data.status === 'online') {
                showToast('✅ ESP32 أصبح متصلاً', 'success');
            }
        }
        else {
            console.log('📨 رسالة غير معروفة:', topic, data);
        }
        
    } catch (error) {
        // إذا لم تكن JSON، تعامل كنص عادي
        console.log('📨 رسالة نصية:', message);
        
        if (topic.includes(TOPICS.STATUS)) {
            try {
                const simpleData = JSON.parse(message);
                updateMachineStatus(simpleData);
            } catch {
                // تجاهل
            }
        }
    }
}

// -------------------- إرسال الأوامر --------------------
function sendCommand(command) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل - تأكد من الاتصال بالخادم', 'error');
        return;
    }
    
    const topic = `${TOPICS.COMMAND}/${CONFIG.MACHINE_ID}`;
    const message = {
        command: command,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now(),
        source: 'web_interface'
    };
    
    console.log(`📤 إرسال أمر: ${command} إلى ${topic}`);
    
    mqttClient.publish(topic, JSON.stringify(message), { 
        qos: 1, 
        retain: false 
    }, function(err) {
        if (err) {
            console.error('❌ فشل إرسال الأمر:', err);
            showToast(`❌ فشل إرسال الأمر: ${command}`, 'error');
        } else {
            console.log('✅ تم إرسال الأمر بنجاح');
            showToast(`📤 تم إرسال الأمر: ${getCommandName(command)}`, 'success');
        }
    });
}

// -------------------- رفع الملف --------------------
function uploadFile(fileName, content) {
    if (!mqttClient || !mqttClient.connected) {
        showToast('❌ الجهاز غير متصل', 'error');
        return;
    }
    
    // تقسيم المحتوى إذا كان كبيراً
    const maxChunkSize = 8000; // 8 كيلوبايت لكل جزء
    const totalChunks = Math.ceil(content.length / maxChunkSize);
    
    if (totalChunks > 1) {
        console.log(`📦 تقسيم الملف إلى ${totalChunks} أجزاء`);
        uploadFileInChunks(fileName, content, maxChunkSize);
        return;
    }
    
    // رفع ملف صغير مباشرة
    const topic = `${TOPICS.FILE_UPLOAD}/${CONFIG.MACHINE_ID}`;
    const message = {
        name: fileName,
        content: content,
        machineId: CONFIG.MACHINE_ID,
        timestamp: Date.now(),
        size: content.length,
        chunk: 1,
        totalChunks: 1
    };
    
    mqttClient.publish(topic, JSON.stringify(message), { 
        qos: 2,  // جودة عالية للملفات
        retain: false 
    }, function(err) {
        if (err) {
            showToast('❌ فشل رفع الملف', 'error');
        } else {
            showToast('📤 جاري رفع الملف...', 'info');
            
            // انتظر تأكيد الاستلام
            setTimeout(() => {
                mqttClient.publish(
                    `${TOPICS.FILE_INFO}/request/${CONFIG.MACHINE_ID}`,
                    JSON.stringify({ request: 'upload_status' })
                );
            }, 2000);
        }
    });
}

// -------------------- رفع الملف مقسماً --------------------
function uploadFileInChunks(fileName, content, chunkSize) {
    const totalChunks = Math.ceil(content.length / chunkSize);
    let currentChunk = 0;
    
    function sendNextChunk() {
        if (currentChunk >= totalChunks) {
            showToast('✅ تم رفع جميع أجزاء الملف', 'success');
            return;
        }
        
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, content.length);
        const chunk = content.substring(start, end);
        
        const topic = `${TOPICS.FILE_UPLOAD}/${CONFIG.MACHINE_ID}`;
        const message = {
            name: fileName,
            content: chunk,
            machineId: CONFIG.MACHINE_ID,
            timestamp: Date.now(),
            chunk: currentChunk + 1,
            totalChunks: totalChunks,
            isLastChunk: (currentChunk + 1 === totalChunks)
        };
        
        mqttClient.publish(topic, JSON.stringify(message), { qos: 2 }, function(err) {
            if (err) {
                showToast(`❌ فشل رفع الجزء ${currentChunk + 1}`, 'error');
            } else {
                console.log(`📤 تم رفع الجزء ${currentChunk + 1}/${totalChunks}`);
                currentChunk++;
                
                // انتظر قليلاً قبل إرسال الجزء التالي
                setTimeout(sendNextChunk, 500);
            }
        });
    }
    
    showToast(`📤 جاري رفع الملف (${totalChunks} أجزاء)...`, 'info');
    sendNextChunk();
}

// -------------------- حذف الملف --------------------
function deleteFile() {
    if (!confirm('هل أنت متأكد من حذف ملف الرسم؟')) {
        return;
    }
    
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

// -------------------- التحكم اليدوي --------------------
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

// -------------------- المعايرة --------------------
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

// -------------------- حفظ الإعدادات --------------------
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

// -------------------- اختبار سيرفو --------------------
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

// ==================== دوال التحديث ====================

// -------------------- تحديث حالة الآلة --------------------
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

// -------------------- تحديث معلومات الملف --------------------
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

// -------------------- تحديث حالة الاتصال --------------------
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

// -------------------- تحديث الأزرار حسب الحالة --------------------
function updateButtonsBasedOnState(state) {
    const isDrawing = (state === 'DRAWING');
    const isDrilling = (state === 'DRILLING');
    const isPaused = (state === 'PAUSED');
    const isIdle = (state === 'IDLE');
    
    // أزرار الرسم
    const startBtn = document.getElementById('start-drawing-btn');
    const pauseBtn = document.getElementById('pause-drawing-btn');
    const stopBtn = document.getElementById('stop-drawing-btn');
    
    if (startBtn) startBtn.disabled = !isIdle || fileInfo.totalCommands === 0;
    if (pauseBtn) pauseBtn.disabled = !isDrawing;
    if (stopBtn) stopBtn.disabled = !(isDrawing || isDrilling || isPaused);
    
    // أزرار التثقيب
    const startDrillBtn = document.getElementById('start-drilling-btn');
    const pauseDrillBtn = document.getElementById('pause-drilling-btn');
    const stopDrillBtn = document.getElementById('stop-drilling-btn');
    
    if (startDrillBtn) startDrillBtn.disabled = !isIdle;
    if (pauseDrillBtn) pauseDrillBtn.disabled = !isDrilling;
    if (stopDrillBtn) stopDrillBtn.disabled = !(isDrawing || isDrilling || isPaused);
}

// ==================== دوال المساعدة ====================

// -------------------- إظهار صفحة معينة --------------------
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

// -------------------- إظهار رسالة --------------------
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// -------------------- الحصول على نص الحالة --------------------
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

// -------------------- بدء تحديث الحالة --------------------
function startStatusUpdates() {
    setInterval(() => {
        if (mqttClient && mqttClient.connected) {
            mqttClient.publish(
                `${TOPICS.STATUS_REQUEST}/${CONFIG.MACHINE_ID}`,
                JSON.stringify({ 
                    request: 'status', 
                    timestamp: Date.now() 
                })
            );
        }
    }, CONFIG.UI.REFRESH_INTERVAL);
}

// -------------------- إعداد مستمعي الأحداث --------------------
function setupEventListeners() {
    // سحب وإفلات الملفات
    const uploadArea = document.getElementById('upload-area');
    
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
                document.getElementById('file-input').files = e.dataTransfer.files;
                document.getElementById('file-input').dispatchEvent(new Event('change'));
            } else {
                showToast('❌ الرجاء اختيار ملف .txt', 'error');
            }
        });
    }
    
    // مستمع اختيار الملف
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // التحقق من الحجم
            if (file.size > CONFIG.UI.MAX_FILE_SIZE) {
                showToast('❌ حجم الملف كبير جداً (الحد الأقصى 50 كيلوبايت)', 'error');
                return;
            }
            
            // قراءة الملف
            const reader = new FileReader();
            reader.onload = function(event) {
                const content = event.target.result;
                
                // التحقق من صحة المحتوى
                if (!validateFileContent(content)) {
                    showToast('❌ الملف غير صالح - تأكد من الأرقام (0-249) مفصولة بفواصل', 'error');
                    return;
                }
                
                // إرسال الملف
                uploadFile(file.name, content);
            };
            
            reader.readAsText(file);
        });
    }
}

// -------------------- التحقق من صحة محتوى الملف --------------------
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

// -------------------- التحقق من وجود عمل سابق --------------------
function checkForResume() {
    // يمكن إضافة منطق للتحقق من وجود تقدم محفوظ
    // هذا يعتمد على استجابة ESP32
}

// -------------------- معالجة استجابة الأوامر --------------------
function handleCommandResponse(response) {
    console.log('📨 استجابة الأمر:', response);
    
    if (response.success) {
        showToast(response.message || '✅ تم تنفيذ الأمر بنجاح', 'success');
    } else {
        showToast(response.message || '❌ فشل تنفيذ الأمر', 'error');
    }
}

// -------------------- معالجة الأخطاء --------------------
function handleError(error) {
    console.error('⚠️ خطأ من الجهاز:', error);
    
    let errorMessage = 'حدث خطأ في الجهاز';
    if (error.message) {
        errorMessage = error.message;
    } else if (error.code) {
        errorMessage = `خطأ ${error.code}`;
    }
    
    showToast(`⚠️ ${errorMessage}`, 'error');
}

// -------------------- ترجمة أسماء الأوامر --------------------
function getCommandName(command) {
    const commands = {
        'START_DRAWING': 'بدء الرسم',
        'START_DRILLING': 'بدء التثقيب',
        'PAUSE': 'إيقاف مؤقت',
        'RESUME': 'استئناف',
        'STOP': 'إيقاف',
        'CALIBRATE': 'معايرة',
        'DELETE_FILE': 'حذف الملف'
    };
    return commands[command] || command;
}

// -------------------- التحقق من حالة الاتصال --------------------
function checkConnection() {
    if (!mqttClient) {
        return { 
            connected: false, 
            reason: 'no_client',
            message: 'لم يتم إنشاء اتصال'
        };
    }
    
    return {
        connected: mqttClient.connected,
        broker: CONFIG.MQTT.USE_EMQX ? 'EMQX' : (CONFIG.MQTT.USE_HIVEMQ ? 'HiveMQ' : 'Mosquitto'),
        clientId: mqttClient.options?.clientId,
        reconnectCount: mqttReconnectCount || 0,
        url: MQTT_URL
    };
}

// -------------------- إعادة تعيين الاتصال --------------------
function reconnectMQTT() {
    if (mqttClient) {
        mqttClient.end(true, () => {
            console.log('🔌 تم إنهاء الاتصال القديم');
            connectMQTT();
        });
    } else {
        connectMQTT();
    }
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
window.reconnectMQTT = reconnectMQTT;
window.checkConnection = checkConnection;
