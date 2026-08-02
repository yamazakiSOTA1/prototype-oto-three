// PC側のCanvas演出とFirebase受信を担当するスクリプト
// 受信した斬撃イベントに合わせて画面全体の演出を表示します。

let pcCanvas = null;
let pcCtx = null;
let pcDebug = null;
let lastRenderTime = 0;
let slashEffects = [];
let sparkEffects = [];
let ringEffects = [];
let flashAmount = 0;
let shakeAmount = 0;
let lastReceivedTimestamp = 0;
let pcAudio = null;
let connectionStatusEl = null;
let lastPlayedEventKey = null;

function setConnectionStatus(message) {
  if (connectionStatusEl) {
    connectionStatusEl.textContent = `接続状態: ${message}`;
  }
}

function initPcApp() {
  prepareAudio();
  setupCanvas();
  pcDebug = document.getElementById('pcDebug');
  connectionStatusEl = document.getElementById('connectionStatus');
  setConnectionStatus('初期化中');
  window.addEventListener('slashEventLocal', (event) => {
    handleSlashEvent(event.detail);
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'slashEventLocalBus' && event.newValue) {
      try {
        handleSlashEvent(JSON.parse(event.newValue));
      } catch (error) {
        console.warn('local storage slash event parse failed', error);
      }
    }
  });
  const pcDebugButton = document.getElementById('pcDebugButton');
  if (pcDebugButton) {
    pcDebugButton.addEventListener('click', () => {
      const testEvent = {
        angle: 270,
        speed: 0.85,
        timestamp: Date.now(),
      };
      triggerPcVisual(testEvent);
      updatePcDebug(testEvent);
    });
  }
  initFirebase().then((database) => {
    if (database) {
      setConnectionStatus('RESTポーリング中');
    } else {
      setConnectionStatus('ローカルフォールバック');
    }
    subscribeSlashEvents(handleSlashEvent);
  });
  requestAnimationFrame(renderFrame);
}

function prepareAudio() {
  pcAudio = new Audio('sounds/slash_end.mp3');
  pcAudio.preload = 'auto';
  pcAudio.volume = 0.5;
}

function setupCanvas() {
  // canvas をピクセル比に合わせて設定し、リサイズに対応します。
  pcCanvas = document.getElementById('pcCanvas');
  pcCtx = pcCanvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  if (!pcCanvas) {
    return;
  }
  pcCanvas.width = window.innerWidth * window.devicePixelRatio;
  pcCanvas.height = window.innerHeight * window.devicePixelRatio;
  pcCanvas.style.width = '100%';
  pcCanvas.style.height = '100vh';
  pcCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function handleSlashEvent(eventData) {
  console.log('PC received slash event', eventData);
  if (!eventData || !eventData.timestamp) {
    updatePcDebug('無効なイベントを受信しました');
    return;
  }

  const eventKey = eventData.id || `${eventData.timestamp}-${eventData.angle}-${eventData.speed}`;
  if (eventKey === lastPlayedEventKey) {
    console.log('duplicate event ignored by key');
    return;
  }

  if (eventData.timestamp <= lastReceivedTimestamp) {
    console.log('duplicate event ignored by timestamp');
    return;
  }

  lastReceivedTimestamp = eventData.timestamp;
  lastPlayedEventKey = eventKey;
  flashAmount = 1;
  shakeAmount = 12;
  updatePcDebug(eventData);
  const hint = document.getElementById('pcHint');
  if (hint) {
    hint.textContent = `斬撃受信: angle ${Math.round(eventData.angle || 0)}°, strength ${(eventData.speed || 0).toFixed(2)}`;
    hint.style.color = '#fff7b2';
    setTimeout(() => {
      hint.style.color = '';
    }, 450);
  }
  triggerPcVisual(eventData);
}

function triggerPcVisual(eventData) {
  const speed = Math.min(1, Math.max(0, eventData.speed || 0));
  const angle = eventData.angle || 0;
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  playSlashEndSound(speed);
  createSlashEffect(angle, speed, centerX, centerY);
  const hint = document.getElementById('pcHint');
  if (hint) {
    hint.textContent = `斬撃受信: angle ${Math.round(angle)}°, strength ${speed.toFixed(2)}`;
  }
}

function updatePcDebug(eventData) {
  if (!pcDebug) {
    return;
  }

  if (!eventData || !eventData.timestamp) {
    pcDebug.textContent = 'デバッグ情報: 受信イベントなし';
    return;
  }

  const angle = Math.round(eventData.angle || 0);
  const speed = (eventData.speed || 0).toFixed(2);
  const timestamp = eventData.timestamp;
  const time = new Date(timestamp).toLocaleTimeString();
  const latency = Date.now() - timestamp;

  pcDebug.textContent = `デバッグ情報\nangle: ${angle}°\nspeed: ${speed}\n送信時刻: ${time}\n受信遅延: ${latency}ms`;
}

function playSlashEndSound(speed) {
  if (!pcAudio) {
    return;
  }
  pcAudio.volume = 0.35 + speed * 0.65;
  pcAudio.currentTime = 0;
  pcAudio.play().catch(() => {
    // 自動再生制限がある場合にも静かに失敗
  });
}

function createSlashEffect(angle, speed, centerX, centerY) {
  slashEffects.push(createSlash(angle, speed, window.innerWidth, window.innerHeight));

  const sparkCount = 24 + Math.round(speed * 24);
  for (let i = 0; i < sparkCount; i += 1) {
    sparkEffects.push(createSpark(centerX, centerY, speed));
  }

  ringEffects.push(createShockWave(centerX, centerY, speed));

  flashAmount = Math.min(1, flashAmount + 0.8 + speed * 0.18);
  shakeAmount = Math.min(18, shakeAmount + 8 + speed * 16);
}

function renderFrame(timestamp) {
  if (!pcCtx) {
    requestAnimationFrame(renderFrame);
    return;
  }

  const deltaMs = Math.min(40, timestamp - lastRenderTime);
  lastRenderTime = timestamp;

  updateEffects(deltaMs);
  drawScene(deltaMs);
  requestAnimationFrame(renderFrame);
}

function updateEffects(deltaMs) {
  slashEffects = slashEffects.filter((effect) => {
    effect.update(deltaMs);
    return !effect.isFinished;
  });

  sparkEffects = sparkEffects.filter((spark) => {
    spark.update(deltaMs);
    return !spark.isFinished;
  });

  ringEffects = ringEffects.filter((ring) => {
    ring.update(deltaMs);
    return !ring.isFinished;
  });

  flashAmount = Math.max(0, flashAmount - deltaMs * 0.0025);
  shakeAmount = Math.max(0, shakeAmount - deltaMs * 0.04);
}

function drawScene(deltaMs) {
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  pcCtx.save();
  pcCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  drawBackground(pcCtx, canvasWidth, canvasHeight);

  const shakeX = (Math.random() - 0.5) * shakeAmount;
  const shakeY = (Math.random() - 0.5) * shakeAmount;
  pcCtx.translate(shakeX, shakeY);

  ringEffects.forEach((ring) => ring.draw(pcCtx));
  sparkEffects.forEach((spark) => spark.draw(pcCtx));
  slashEffects.forEach((slash) => slash.draw(pcCtx));

  pcCtx.restore();
  drawFlashOverlay(pcCtx, canvasWidth, canvasHeight);
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.max(width, height) * 0.72);
  gradient.addColorStop(0, '#080d14');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawFlashOverlay(ctx, width, height) {
  if (flashAmount <= 0.001) {
    return;
  }

  ctx.save();
  ctx.fillStyle = `rgba(220, 250, 255, ${flashAmount * 0.65})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
