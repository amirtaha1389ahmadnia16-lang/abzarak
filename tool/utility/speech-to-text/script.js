document.addEventListener('DOMContentLoaded', () => {
    // ==================== عناصر DOM ====================
    const langSelect = document.getElementById('langSelect');
    const continuousCheck = document.getElementById('continuousCheck');
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusBadge = document.getElementById('statusBadge');
    const vuFill = document.getElementById('vuFill');
    const outputText = document.getElementById('outputText');
    const statsSpan = document.getElementById('stats');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const infoMsg = document.getElementById('infoMsg');
    const toast = document.getElementById('toast');

    // ==================== متغیرها ====================
    let recognition = null;
    let isRecording = false;
    let finalTranscript = '';
    let interimTranscript = '';
    let mediaStream = null;
    let audioContext = null;
    let sourceNode = null;
    let analyserNode = null;
    let animationId = null;

    // ==================== توابع کمکی ====================
    function showToast(msg, isError = false) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function updateStats() {
        const text = outputText.value;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const chars = text.length;
        statsSpan.innerHTML = `<i class="fas fa-keyboard"></i> کلمات: ${words.toLocaleString('fa-IR')} | کاراکترها: ${chars.toLocaleString('fa-IR')}`;
    }

    function setStatus(status, isError = false) {
        if (isError) {
            statusBadge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${status}`;
            statusBadge.style.background = '#ef4444';
            statusBadge.style.color = 'white';
        } else {
            statusBadge.innerHTML = isRecording ? `<i class="fas fa-microphone"></i> ${status}` : `<i class="fas fa-microphone-slash"></i> ${status}`;
            statusBadge.style.background = '';
            statusBadge.style.color = '';
        }
        if (isRecording) {
            statusBadge.classList.add('recording');
        } else {
            statusBadge.classList.remove('recording');
        }
    }

    // شبیه‌سازی VU meter از طریق تحلیل صدای واقعی (اختیاری)
    async function startVUMeter(stream) {
        if (audioContext) await audioContext.close();
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyserNode);
        // تحلیلگر را به خروجی وصل نمی‌کنیم (فقط برای اندازه‌گیری)
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        function updateVU() {
            if (!isRecording || !analyserNode) return;
            analyserNode.getByteFrequencyData(dataArray);
            let max = 0;
            for (let i = 0; i < dataArray.length; i++) {
                if (dataArray[i] > max) max = dataArray[i];
            }
            let percent = (max / 255) * 100;
            vuFill.style.width = percent + '%';
            animationId = requestAnimationFrame(updateVU);
        }
        updateVU();
        await audioContext.resume();
    }

    function stopVUMeter() {
        if (animationId) cancelAnimationFrame(animationId);
        if (audioContext) {
            audioContext.close().catch(e => console.warn);
            audioContext = null;
        }
        vuFill.style.width = '0%';
    }

    // ==================== راه‌اندازی تشخیص گفتار ====================
    function initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setStatus('مرورگر پشتیبانی نمی‌کند', true);
            recordBtn.disabled = true;
            stopBtn.disabled = true;
            infoMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> مرورگر شما از Web Speech API پشتیبانی نمی‌کند. لطفاً از Chrome، Edge یا Safari استفاده کنید.';
            return null;
        }
        const recog = new SpeechRecognition();
        recog.continuous = continuousCheck.checked;
        recog.interimResults = true;
        recog.lang = langSelect.value;

        recog.onstart = () => {
            isRecording = true;
            recordBtn.disabled = true;
            stopBtn.disabled = false;
            setStatus('در حال گوش دادن...');
            infoMsg.innerHTML = '<i class="fas fa-microphone"></i> در حال ضبط... برای توقف کلیک کنید.';
            if (mediaStream) startVUMeter(mediaStream);
        };

        recog.onend = () => {
            if (isRecording && continuousCheck.checked) {
                // اگر ضبط پیوسته است و به طور غیرمنتظره تمام شد، دوباره شروع کن
                try {
                    recog.start();
                } catch (e) {
                    console.warn(e);
                    stopRecording();
                }
            } else {
                stopRecording();
            }
        };

        recog.onresult = (event) => {
            interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            // نمایش ترکیبی از متن نهایی + موقت
            let displayText = finalTranscript;
            if (interimTranscript) {
                displayText += '[' + interimTranscript + ']';
            }
            outputText.value = displayText.trim();
            updateStats();
            // اسکرول خودکار به انتها
            outputText.scrollTop = outputText.scrollHeight;
        };

        recog.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            let errorMsg = '';
            switch (event.error) {
                case 'not-allowed':
                    errorMsg = 'اجازه دسترسی به میکروفون داده نشد. لطفاً مجوز را صادر کنید.';
                    break;
                case 'network':
                    errorMsg = 'مشکل در اتصال به اینترنت.';
                    break;
                case 'no-speech':
                    errorMsg = 'صدایی تشخیص داده نشد.';
                    break;
                default:
                    errorMsg = 'خطا: ' + event.error;
            }
            showToast(errorMsg, true);
            setStatus('خطا', true);
            stopRecording();
        };

        return recog;
    }

    // ==================== توابع ضبط و توقف ====================
    async function startRecording() {
        if (recognition) {
            try { recognition.abort(); } catch(e) {}
        }
        finalTranscript = '';
        interimTranscript = '';
        outputText.value = '';
        updateStats();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStream = stream;
            recognition = initRecognition();
            if (!recognition) return;
            recognition.start();
        } catch (err) {
            console.error(err);
            let msg = 'خطا در دسترسی به میکروفون. لطفاً مجوز را بررسی کنید.';
            if (err.name === 'NotAllowedError') msg = 'اجازه دسترسی به میکروفون داده نشد.';
            else if (err.name === 'NotFoundError') msg = 'میکروفونی یافت نشد.';
            showToast(msg, true);
            setStatus('میکروفون در دسترس نیست', true);
        }
    }

    function stopRecording() {
        if (recognition) {
            try { recognition.stop(); } catch(e) {}
        }
        isRecording = false;
        recordBtn.disabled = false;
        stopBtn.disabled = true;
        setStatus('آماده');
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        stopVUMeter();
        infoMsg.innerHTML = '<i class="fas fa-info-circle"></i> ضبط متوقف شد. می‌توانید دوباره شروع کنید.';
        // حذف براکت‌های متن موقت از خروجی نهایی
        let finalText = outputText.value.replace(/\[[^\]]*\]/g, '').trim();
        outputText.value = finalText;
        finalTranscript = finalText;
        updateStats();
    }

    // ==================== رویدادهای دکمه‌ها ====================
    recordBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    stopBtn.addEventListener('click', () => {
        if (isRecording) stopRecording();
    });

    // تغییر تنظیمات در حین اجرا (زبان و حالت پیوسته) نیاز به بازآفرینی recognition دارد
    langSelect.addEventListener('change', () => {
        if (recognition && isRecording) {
            // در حین ضبط، اگر زبان عوض شد، ضبط را متوقف و دوباره شروع کن
            stopRecording();
            startRecording();
        } else if (recognition) {
            recognition.lang = langSelect.value;
        }
    });

    continuousCheck.addEventListener('change', () => {
        if (recognition && isRecording) {
            stopRecording();
            startRecording();
        }
    });

    copyBtn.addEventListener('click', () => {
        const text = outputText.value.trim();
        if (!text) return showToast('⚠️ متنی برای کپی وجود ندارد.');
        navigator.clipboard.writeText(text).then(() => showToast('📋 متن کپی شد.'));
    });

    downloadBtn.addEventListener('click', () => {
        const text = outputText.value.trim();
        if (!text) return showToast('⚠️ متنی برای دانلود وجود ندارد.');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `speech_to_text_${new Date().toISOString().slice(0,19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('⬇️ فایل TXT دانلود شد.');
    });

    clearBtn.addEventListener('click', () => {
        outputText.value = '';
        finalTranscript = '';
        interimTranscript = '';
        updateStats();
        showToast('🗑️ متن پاک شد.');
    });

    // ==================== بررسی اولیه پشتیبانی ====================
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        recordBtn.disabled = true;
        stopBtn.disabled = true;
        infoMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> مرورگر شما از تشخیص گفتار پشتیبانی نمی‌کند. لطفاً از Chrome، Edge یا Safari استفاده کنید.';
    } else {
        recordBtn.disabled = false;
        stopBtn.disabled = true;
    }

    // به‌روزرسانی آمار هنگام تغییر دستی متن (امکان ویرایش نیست چون خواندنی است، اما برای امنیت)
    outputText.addEventListener('input', updateStats);
});
