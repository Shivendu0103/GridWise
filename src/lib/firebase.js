// src/lib/firebase.js
// ─────────────────────────────────────────────────────────
// Firebase SDK initialization
// Replace the firebaseConfig values with your actual project config.
// Get from: Firebase Console → Project Settings → Your apps → Web app
// ─────────────────────────────────────────────────────────

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, off, push, update } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import zonesJson from '../../data/zones.json';

// ──────────────────────────────────────────────────────────
//  DEMO MODE — active when .env is not configured or init fails
// ──────────────────────────────────────────────────────────
const CONFIGURED = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here'
);

let DEMO_MODE_FLAG = !CONFIGURED;

// ──────────────────────────────────────────────────────────
//  FIREBASE INIT (only when configured — with full error catch)
// ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null, database = null, auth = null, messaging = null;

if (CONFIGURED) {
  try {
    app      = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth     = getAuth(app);
    try { messaging = getMessaging(app); } catch { /* FCM optional */ }
  } catch (err) {
    console.warn('[GridWise] Firebase init failed — falling back to DEMO MODE:', err.message);
    DEMO_MODE_FLAG = true;
    database = null;
    auth = null;
    messaging = null;
  }
}

if (DEMO_MODE_FLAG) {
  console.info('[GridWise] Running in DEMO MODE — using simulated data. Add real Firebase config to .env to connect.');
}

export const DEMO_MODE = DEMO_MODE_FLAG;
export { database, auth, messaging };

// ─────────────────────────────────────────────────────────
//  AUTH HELPERS
// ─────────────────────────────────────────────────────────

/** Sign in anonymously (for citizen reports). Returns the user object. */
export async function signInAnon() {
  if (DEMO_MODE) return { uid: 'demo-user-123', isAnonymous: true };
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (err) {
    console.error('[Auth] Anonymous sign-in failed:', err);
    return null;
  }
}

/** Subscribe to auth changes */
export function onAuth(callback) {
  if (DEMO_MODE) {
    callback({ uid: 'demo-user-123', isAnonymous: true });
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

// ─────────────────────────────────────────────────────────
//  REALTIME DB HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Subscribe to all zone readings in real-time.
 */
export function subscribeToZones(callback) {
  if (DEMO_MODE) {
    // Initial load from JSON
    const zones = {};
    zonesJson.zones.forEach(z => { zones[z.zoneId] = { ...z, status: 'normal' }; });
    callback(zones);

    // Simulate minor live updates every 5s
    const interval = setInterval(() => {
      const updated = { ...zones };
      Object.keys(updated).forEach(id => {
        const noise = (Math.random() - 0.5) * 5;
        updated[id].currentLoad = Math.max(10, Math.min(99, updated[id].currentLoad + noise));
        updated[id].status = updated[id].currentLoad > 85 ? 'overload' : 'normal';
      });
      callback(updated);
    }, 5000);
    return () => clearInterval(interval);
  }

  const zonesRef = ref(database, '/zones');
  let seededFallback = false;
  const handler = (snapshot) => {
    const data = snapshot.val();
    if (data && Object.keys(data).length > 0) {
      callback(data);
    } else if (!seededFallback) {
      // Database empty — show local JSON as fallback until seed.py populates it
      seededFallback = true;
      const fallback = {};
      zonesJson.zones.forEach(z => { fallback[z.zoneId] = { ...z, status: 'normal', currentLoad: 40 + Math.random() * 40 }; });
      callback(fallback);
      console.info('[GridWise] Database empty — using local zone data. Run `python data/seed.py` to populate.');
    }
  };
  onValue(zonesRef, handler);
  return () => off(zonesRef, 'value', handler);
}

/**
 * Subscribe to active alerts (unresolved).
 */
export function subscribeToAlerts(callback) {
  if (DEMO_MODE) {
    // Return a mock alert if anything is high
    callback([
      { id: 'm1', zoneId: 'UP-02', zoneName: 'Kanpur Industrial', load: 92, status: 'critical', timestamp: new Date().toISOString(), resolved: false }
    ]);
    return () => {};
  }

  const alertsRef = ref(database, '/alerts');
  const handler = (snapshot) => {
    const data = snapshot.val() || {};
    const alerts = Object.entries(data)
      .map(([id, alert]) => ({ id, ...alert }))
      .filter(a => !a.resolved)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    callback(alerts);
  };
  onValue(alertsRef, handler);
  return () => off(alertsRef, 'value', handler);
}

export async function resolveAlert(alertId) {
  if (DEMO_MODE) return;
  await update(ref(database, `/alerts/${alertId}`), { resolved: true });
}

export async function submitReport(report) {
  if (DEMO_MODE) {
    console.log('[DEMO] Report submitted:', report);
    return;
  }
  const reportsRef = ref(database, '/reports');
  await push(reportsRef, { ...report, timestamp: new Date().toISOString(), status: 'pending' });
}

export function subscribeToReports(callback) {
  if (DEMO_MODE) {
    callback([]);
    return () => {};
  }
  const reportsRef = ref(database, '/reports');
  const handler = (snapshot) => {
    const data = snapshot.val() || {};
    const reports = Object.entries(data)
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    callback(reports);
  };
  onValue(reportsRef, handler);
  return () => off(reportsRef, 'value', handler);
}

export function subscribeToWallet(userId, callback) {
  if (DEMO_MODE) {
    callback({ coins: 1450, transactions: { 't1': { amount: 50, reason: 'Demo Reward', timestamp: new Date().toISOString() } } });
    return () => {};
  }
  const walletRef = ref(database, `/users/${userId}/wallet`);
  const handler = (snapshot) => callback(snapshot.val() || { coins: 0, transactions: {} });
  onValue(walletRef, handler);
  return () => off(walletRef, 'value', handler);
}

export async function awardCoins(userId, amount, reason) {
  if (DEMO_MODE) return;
  const walletRef = ref(database, `/users/${userId}/wallet`);
  const snap = await new Promise((res) => onValue(walletRef, res, { onlyOnce: true }));
  const current = snap.val()?.coins || 0;
  await update(walletRef, { coins: current + amount });
  await push(ref(database, `/users/${userId}/wallet/transactions`), { amount, reason, timestamp: new Date().toISOString(), type: 'earn' });
}

// ─────────────────────────────────────────────────────────
//  FCM HELPERS  (Web Push)
// ─────────────────────────────────────────────────────────

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export async function requestFCMToken() {
  if (!messaging || DEMO_MODE) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    return await getToken(messaging, { vapidKey: VAPID_KEY });
  } catch (err) {
    console.warn('[FCM] Token error:', err);
    return null;
  }
}

export function onFCMMessage(callback) {
  if (!messaging || DEMO_MODE) return () => {};
  return onMessage(messaging, callback);
}

