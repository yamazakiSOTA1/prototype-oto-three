// Firebase Realtime Database の初期化とイベント送受信の共通処理
//
// このファイルは、スマホ側・PC側の両方から読み込まれます。
// Firebase設定は自分のプロジェクト用に書き換えてください。

const firebaseConfig = {
  apiKey: "AIzaSyDAkToFqA7KcwZsRrB_AkLNbEB3eDA2-5Q",
  authDomain: "purototaipu3you.firebaseapp.com",
  databaseURL: "https://purototaipu3you-default-rtdb.firebaseio.com",
  projectId: "purototaipu3you",
  storageBucket: "purototaipu3you.firebasestorage.app",
  messagingSenderId: "293239432156",
  appId: "1:293239432156:web:5ca181fd9c5f6f08432519",
  measurementId: "G-CBDP8YS5L5"
};

let firebaseInitialized = false;
let firebaseDatabase = null;
let firebaseInitPromise = null;

function dispatchSlashEventLocally(eventData) {
  try {
    const payload = {
      ...eventData,
      source: 'local-fallback',
      timestamp: eventData.timestamp || Date.now(),
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('slashEventLocal', { detail: payload }));
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('slashEventLocalBus', JSON.stringify(payload));
    }
  } catch (error) {
    console.warn('local event dispatch failed', error);
  }
}

function loadFirebaseSdk() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.firebase) {
      resolve(window.firebase);
      return;
    }

    const scripts = [
      'https://www.gstatic.com/firebasejs/9.31.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/9.31.0/firebase-database-compat.js',
      'https://www.gstatic.com/firebasejs/9.31.0/firebase-auth-compat.js'
    ];

    const head = document.head || document.getElementsByTagName('head')[0];

    const loadScript = (src) => new Promise((scriptResolve, scriptReject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          scriptResolve();
          return;
        }
        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          scriptResolve();
        }, { once: true });
        existing.addEventListener('error', () => {
          scriptReject(new Error(`Failed to load ${src}`));
        }, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => {
        script.dataset.loaded = 'true';
        scriptResolve();
      };
      script.onerror = () => {
        scriptReject(new Error(`Failed to load ${src}`));
      };
      head.appendChild(script);
    });

    loadScript(scripts[0])
      .then(() => loadScript(scripts[1]))
      .then(() => {
        if (typeof window.firebase !== 'undefined') {
          resolve(window.firebase);
        } else {
          reject(new Error('Firebase SDK did not expose a global firebase object.'));
        }
      })
      .catch(reject);
  });
}

function initFirebase() {
  if (firebaseInitialized) {
    console.log('initFirebase: already initialized');
    return Promise.resolve(firebaseDatabase);
  }

  if (firebaseInitPromise) {
    console.log('initFirebase: reuse pending init');
    return firebaseInitPromise;
  }

  console.log('initFirebase: using REST transport for cross-device sync');
  firebaseDatabase = { mode: 'rest' };
  firebaseInitialized = true;
  firebaseInitPromise = Promise.resolve(firebaseDatabase);
  return firebaseInitPromise;
}

function writeSlashEvent(eventData) {
  console.log('writeSlashEvent: attempting to write', eventData);
  dispatchSlashEventLocally(eventData);
  return initFirebase().then(() => writeSlashEventViaRest(eventData));
}

function writeSlashEventViaRest(eventData) {
  const endpoint = `${firebaseConfig.databaseURL}/slashEvent.json`;
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData)
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        console.warn('Firebase REST write rejected', response.status, text);
        if (typeof window !== 'undefined' && typeof window.showPhoneError === 'function') {
          window.showPhoneError('Firebaseのルールで書き込みが拒否されました。');
        }
        throw new Error(`REST write failed: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      console.warn('Firebase REST fallback write failed.', error);
      if (typeof window !== 'undefined' && typeof window.showPhoneError === 'function') {
        window.showPhoneError('Firebase未接続: イベントは送信されません（デバッグ）。');
      }
      return { mocked: true, event: eventData };
    });
}

function subscribeSlashEvents(callback) {
  console.log('subscribeSlashEvents: starting REST polling');
  initFirebase().then(() => {
    subscribeSlashEventsViaRest(callback);
  });
}

function subscribeSlashEventsViaRest(callback) {
  const endpoint = `${firebaseConfig.databaseURL}/slashEvent.json`;
  let lastHandledTimestamp = 0;

  const poll = () => {
    fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          console.warn('Firebase REST read rejected', response.status, text);
          throw new Error(`REST read failed: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data) {
          return;
        }

        const events = Object.values(data).filter((current) => {
          return current && current.timestamp && current.timestamp > lastHandledTimestamp;
        });

        if (!events.length) {
          return;
        }

        events.sort((a, b) => a.timestamp - b.timestamp);
        const latestEvent = events[events.length - 1];
        lastHandledTimestamp = latestEvent.timestamp;
        callback(latestEvent);
      })
      .catch((error) => {
        console.warn('Firebase REST fallback poll failed.', error);
      });
  };

  poll();
  window.setInterval(poll, 250);
}
