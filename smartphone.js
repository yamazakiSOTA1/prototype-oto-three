// スマホ側の斬撃送信と画面演出を担当するスクリプト
// DeviceMotion API で振りを検出し、Firebaseにイベントを書き込みます。
// state vars
let smartphoneAudio = null;
let currentAngle = 0;
let currentSpeed = 0;
let isMotionActive = false;
let lastSlashTime = 0;
let vibrationPermissionGranted = false;
let audioUnlocked = false;
let audioContext = null;
let masterGain = null;
let listening = false;

// tuning constants
const SHAKE_THRESHOLD = 15; // acceleration magnitude threshold
const COOLDOWN_MS = 700; // ms between allowed slashes
const MAX_SPEED = 1.5; // clamp for normalized speed
  // Create audio element and explicitly set src/load to improve diagnostics
  smartphoneAudio = new Audio();
  const srcPath = 'sounds/slash_start.mp3';
  try {
    // resolve to absolute URL to avoid relative-path ambiguities
    const absolute = new URL(srcPath, location.href).href;
    try {
      smartphoneAudio.src = absolute;
    } catch (e) {
      console.warn('could not set audio.src property:', e);
    }
    try {
      smartphoneAudio.setAttribute('src', absolute);
    } catch (e) {
      console.warn('could not set audio attribute src:', e);
    }
  } catch (e) {
    console.warn('could not resolve absolute audio URL:', e);
  }
  smartphoneAudio.preload = 'auto';
  // append audio to DOM (hidden) so some browsers allow playback
  try {
    smartphoneAudio.style.display = 'none';
    if (document.body) document.body.appendChild(smartphoneAudio);
  } catch (e) {
    console.warn('could not append audio element to DOM:', e);
  }

  try {
    if (typeof smartphoneAudio.load === 'function') smartphoneAudio.load();
  } catch (e) {
    console.warn('audio.load() failed:', e);
  }

  smartphoneAudio.addEventListener('error', (ev) => {
    console.error('smartphoneAudio error event:', ev);
    if (typeof window.showPhoneError === 'function') window.showPhoneError('オーディオ読み込みエラー');
  });
  smartphoneAudio.addEventListener('canplaythrough', () => {
    console.log('smartphoneAudio canplaythrough readyState=', smartphoneAudio.readyState);
  });
  smartphoneAudio.addEventListener('loadedmetadata', () => {
    console.log('smartphoneAudio loadedmetadata duration=', smartphoneAudio.duration);
  });

  function ensureAudioPrepared() {
    try {
      if (smartphoneAudio && smartphoneAudio.src) return;
      if (!smartphoneAudio) smartphoneAudio = new Audio();
      const absolute = new URL(srcPath, location.href).href;
      try { smartphoneAudio.src = absolute; } catch (e) { smartphoneAudio.setAttribute && smartphoneAudio.setAttribute('src', absolute); }
      smartphoneAudio.preload = 'auto';
      smartphoneAudio.style.display = 'none';
      if (document.body && !document.body.contains(smartphoneAudio)) document.body.appendChild(smartphoneAudio);
      if (typeof smartphoneAudio.load === 'function') smartphoneAudio.load();
    } catch (e) {
      console.warn('ensureAudioPrepared failed:', e);
    }
  }

  function ensureAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        console.warn('Web Audio API is not supported');
        return null;
      }
      audioContext = new AudioCtx();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.18;
      masterGain.connect(audioContext.destination);
    }
    return audioContext;
  }

  function playFallbackTone(speed) {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(620 + speed * 480, now);
    oscillator.frequency.exponentialRampToValueAtTime(180, now + 0.2);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gainNode);
    gainNode.connect(masterGain || ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  }

  function emitPhoneMessage(message) {
    if (typeof window.showPhoneError === 'function') {
      window.showPhoneError(message);
    } else {
      console.log(message);
    }
  }

  function enablePhoneAudio() {
    try {
      ensureAudioPrepared();
      ensureAudioContext();
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }

      if (!smartphoneAudio) {
        emitPhoneMessage('オーディオ要素の準備に失敗しました');
        return;
      }

      const originalVolume = smartphoneAudio.volume;
      try { smartphoneAudio.volume = 0.01; } catch (e) { console.warn('could not set temp volume', e); }
      const p = smartphoneAudio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          audioUnlocked = true;
          smartphoneAudio.pause();
          smartphoneAudio.currentTime = 0;
          smartphoneAudio.volume = originalVolume;
          emitPhoneMessage('音声が有効化されました');
        }).catch((err) => {
          console.warn('audio unlock via play() failed, falling back to tone:', err);
          audioUnlocked = true;
          playFallbackTone(0.9);
          emitPhoneMessage('音声を有効化しました。代替トーンで再生します。');
        });
      } else {
        audioUnlocked = true;
        smartphoneAudio.pause();
        smartphoneAudio.currentTime = 0;
        smartphoneAudio.volume = originalVolume;
        emitPhoneMessage('音声が有効化されました');
      }
    } catch (e) {
      console.error('enablePhoneAudio error:', e);
      emitPhoneMessage('音声の有効化中にエラーが発生しました');
    }
  }

  function bindUiElements() {
    console.log('bindUiElements start');
    try {
      const phoneFlash = document.getElementById('phoneFlash');
      const phoneError = document.getElementById('phoneError');
      const angleValue = document.getElementById('angleValue');
      const speedValue = document.getElementById('speedValue');
      const lightWave = document.getElementById('lightWave');
      const lightBurst = document.getElementById('lightBurst');
      const debugButton = document.getElementById('debugTriggerButton');

      function updatePhoneEffect(speed, angle) {
        if (angleValue) angleValue.textContent = `${Math.round(angle)}°`;
        if (speedValue) speedValue.textContent = speed.toFixed(2);

        if (lightWave) {
          lightWave.style.transform = `translateX(-50%) scaleX(${1 + speed * 0.12}) translateY(${ -speed * 24 }px)`;
          lightWave.style.opacity = `${0.35 + speed * 0.65}`;
          lightWave.style.height = `${120 + speed * 100}px`;
        }

        if (lightBurst) {
          lightBurst.style.opacity = `${0.18 + speed * 0.72}`;
          lightBurst.style.transform = `translateX(-50%) translateY(${ -speed * 18 }px) scale(${0.9 + speed * 0.4})`;
        }
      }

      function flashScreen() {
        if (!phoneFlash) return;
        phoneFlash.classList.add('active');
        setTimeout(() => phoneFlash.classList.remove('active'), 120);
      }

      function showPhoneError(message) {
        if (!phoneError) {
          console.warn('phoneError element not found:', message);
          return;
        }
        phoneError.textContent = message;
        phoneError.classList.add('visible');
        clearTimeout(showPhoneError.hideTimeout);
        showPhoneError.hideTimeout = setTimeout(() => phoneError.classList.remove('visible'), 4000);
      }

      if (debugButton) {
        debugButton.addEventListener('click', () => {
          const debugAngle = currentAngle || 0;
          const debugSpeed = currentSpeed || 0.85;
          simulateSlashDebug(debugAngle, debugSpeed);
        });
      }

      const enableAudioButton = document.getElementById('enableAudioButton');
      if (enableAudioButton) {
        enableAudioButton.addEventListener('click', () => {
          console.log('enableAudioButton clicked — attempting to unlock audio');
          enablePhoneAudio();
        });
      }

      const requestVibrationButton = document.getElementById('requestVibrationButton');
      if (requestVibrationButton) {
        requestVibrationButton.addEventListener('click', () => {
          requestVibrationPermission();
        });
      }

      const startMotionButton = document.getElementById('startMotionButton');
      if (startMotionButton) {
        startMotionButton.addEventListener('click', () => {
          requestMotionPermissionIfNeeded();
        });
      }

      window.smartphoneUpdateVisual = (speed, angle) => { updatePhoneEffect(speed, angle); flashScreen(); };
      window.showPhoneError = showPhoneError;
    } catch (e) {
      console.error('bindUiElements error:', e);
      const debugButtonFallback = document.getElementById('debugTriggerButton');
      if (debugButtonFallback) debugButtonFallback.addEventListener('click', () => { console.warn('debugTriggerButton fallback clicked; bindUiElements had an error:', e); simulateSlashDebug(currentAngle || 0, currentSpeed || 0.8); });
      const enableButtonFallback = document.getElementById('enableAudioButton');
      if (enableButtonFallback) enableButtonFallback.addEventListener('click', () => { console.warn('enableAudioButton fallback clicked; bindUiElements had an error:', e); try { ensureAudioPrepared(); } catch (ex) { console.error('ensureAudioPrepared failed in fallback:', ex); } });
    }
  }

  // initialize UI bindings immediately
  try { bindUiElements(); } catch (e) { console.error('bindUiElements init failed:', e); }

function requestMotionPermissionIfNeeded() {
  if (typeof DeviceMotionEvent === 'undefined') {
    if (typeof window.showPhoneError === 'function') {
      window.showPhoneError('この端末では振動検出が利用できません。');
    }
    return;
  }

  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then((permissionState) => {
        if (permissionState === 'granted') {
          startMotionListener();
        } else {
          if (typeof window.showPhoneError === 'function') {
            window.showPhoneError('モーション許可が拒否されました。設定から許可してください。');
          }
        }
      })
      .catch((error) => {
        console.error('Motion permission error:', error);
        if (typeof window.showPhoneError === 'function') {
          window.showPhoneError('モーション許可の取得に失敗しました。');
        }
      });
  } else {
    startMotionListener();
  }
}

function startMotionListener() {
  if (listening) {
    return;
  }

  window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
  listening = true;
  isMotionActive = true;
  if (typeof window.showPhoneError === 'function') {
    window.showPhoneError('モーション検出を開始しました。スマホを振ってください。');
  }
}

function handleDeviceMotion(event) {
  const acceleration = event.accelerationIncludingGravity || event.acceleration;
  if (!acceleration) {
    return;
  }

  const x = acceleration.x || 0;
  const y = acceleration.y || 0;
  const z = acceleration.z || 0;

  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const now = Date.now();
  const normalizedSpeed = normalizeSpeed(magnitude);
  const angle = computeAngle(x, y);

  currentAngle = angle;
  currentSpeed = normalizedSpeed;

  smartphoneUpdateVisual(currentSpeed, currentAngle);

  if (magnitude > SHAKE_THRESHOLD && now - lastSlashTime > COOLDOWN_MS) {
    lastSlashTime = now;
    sendSlashEvent(currentAngle, currentSpeed, now);
  }
}

function normalizeSpeed(magnitude) {
  const raw = Math.max(0, magnitude - SHAKE_THRESHOLD) / 15;
  return Math.min(MAX_SPEED, Math.max(0, raw));
}

function computeAngle(x, y) {
  const radians = Math.atan2(x, y);
  const degrees = (radians * 180) / Math.PI;
  return (degrees + 360) % 360;
}

function sendSlashEvent(angle, speed, timestamp) {
  playSlashStartSound(speed);

  const eventData = {
    angle,
    speed,
    timestamp,
  };

  writeSlashEvent(eventData);
}

function playSlashStartSound(speed) {
  ensureAudioPrepared();
  ensureAudioContext();

  if (audioUnlocked && smartphoneAudio) {
    smartphoneAudio.volume = 0.35 + speed * 0.6;
    try {
      smartphoneAudio.currentTime = 0;
    } catch (e) {
      console.warn('could not set currentTime on audio:', e);
    }

    console.log('Attempting to play slash_start.mp3, volume=', smartphoneAudio.volume);
    const playPromise = smartphoneAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        console.log('slash_start.mp3 再生開始');
      }).catch((error) => {
        console.error('slash_start.mp3 再生エラー:', error);
        playFallbackTone(speed);
      });
    } else {
      console.log('play() did not return a promise. audio.readyState=', smartphoneAudio.readyState);
    }
  } else {
    playFallbackTone(speed);
  }

  triggerPhoneVibration(speed);
}

function simulateSlashDebug(angle, speed) {
  console.log('simulateSlashDebug called', { angle, speed });
  currentAngle = angle;
  currentSpeed = speed;
  smartphoneUpdateVisual(speed, angle);
  // ensure audio is prepared and handlers attached before attempting playback
  ensureAudioPrepared();
  sendSlashEvent(angle, speed, Date.now());
}

function requestVibrationPermission() {
  const vibrateFn = navigator.vibrate || null;
  console.log('vibration support check', {
    hasNavigator: !!navigator,
    hasVibrate: typeof vibrateFn === 'function',
    userAgent: navigator.userAgent,
  });

  if (typeof vibrateFn !== 'function') {
    if (typeof window.showPhoneError === 'function') {
      window.showPhoneError('このブラウザでは振動 API が使えません。');
    }
    return;
  }

  try {
    const success = vibrateFn.call(navigator, [40, 30, 40]);
    const isSupported = typeof success === 'boolean' ? success : true;
    vibrationPermissionGranted = isSupported;

    if (isSupported) {
      if (typeof window.showPhoneError === 'function') {
        window.showPhoneError('振動をテストしました。もし振動しなければ、ブラウザの制限を確認してください。');
      }
    } else {
      if (typeof window.showPhoneError === 'function') {
        window.showPhoneError('振動を実行できませんでした。ブラウザ設定を確認してください。');
      }
    }

    console.log('vibration test result', success);
  } catch (error) {
    console.error('vibration permission failed:', error);
    if (typeof window.showPhoneError === 'function') {
      window.showPhoneError('振動のテスト中にエラーが発生しました。');
    }
  }
}

function triggerPhoneVibration(speed) {
  const vibrateFn = navigator.vibrate || null;
  if (!vibrateFn || !vibrationPermissionGranted) {
    return;
  }

  const duration = 30 + Math.round(speed * 70);
  const pattern = [duration, 20, Math.max(10, duration - 10)];
  try {
    vibrateFn.call(navigator, pattern);
  } catch (error) {
    console.warn('vibrate call failed:', error);
  }
}
