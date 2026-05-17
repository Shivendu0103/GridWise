// src/lib/firebase.js
// ─────────────────────────────────────────────────────────
// Firebase SDK initialization
// Replace the firebaseConfig values with your actual project config.
// Get from: Firebase Console → Project Settings → Your apps → Web app
// ─────────────────────────────────────────────────────────

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, off, push, update, get, set, query, orderByChild, equalTo, limitToLast } from 'firebase/database';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
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

// ─────────────────────────────────────────────────────────
//  EMAIL / PASSWORD AUTH
// ─────────────────────────────────────────────────────────

/** Sign up with email and password. Returns { user } or throws. */
export async function signUpWithEmail(email, password) {
  if (DEMO_MODE) return { user: { uid: 'demo-user-email', email } };
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result;
}

/** Sign in with email and password. Returns { user } or throws. */
export async function signInWithEmail(email, password) {
  if (DEMO_MODE) return { user: { uid: 'demo-user-email', email } };
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result;
}

/** Sign out the current user. */
export async function logOut() {
  if (DEMO_MODE) return;
  await signOut(auth);
}

// ─────────────────────────────────────────────────────────
//  USER PROFILE (RTDB)
// ─────────────────────────────────────────────────────────

/**
 * Write (overwrite) a user profile to /users/{uid}.
 * Call after sign-up.
 */
export async function writeUserProfile(uid, profile) {
  if (DEMO_MODE) { console.log('[DEMO] writeUserProfile:', profile); return; }
  await set(ref(database, `/users/${uid}`), { ...profile, created_at: new Date().toISOString() });
}

/**
 * One-time fetch of /users/{uid}. Returns null if not found.
 */
export async function fetchUserProfile(uid) {
  if (DEMO_MODE) {
    return { uid, name: 'Demo User', email: 'demo@gridwise.in', role: 'citizen', zone_id: 'DL-01', energy_coins: 250 };
  }
  const snap = await get(ref(database, `/users/${uid}`));
  return snap.exists() ? { uid, ...snap.val() } : null;
}

/**
 * Update specific fields on a user profile (e.g. energy_coins).
 */
export async function updateUserProfile(uid, fields) {
  if (DEMO_MODE) return;
  await update(ref(database, `/users/${uid}`), fields);
}

// ─────────────────────────────────────────────────────────
//  CITIZEN REPORTS  (/citizen_reports)
// ─────────────────────────────────────────────────────────

export async function submitCitizenReport(report) {
  if (DEMO_MODE) { console.log('[DEMO] Citizen report:', report); return 'demo-report-id'; }
  const snap = await push(ref(database, '/citizen_reports'), {
    ...report,
    timestamp: new Date().toISOString(),
    status: 'pending',
  });
  return snap.key;
}

export function subscribeToCitizenReports(uid, callback) {
  if (DEMO_MODE) { callback([]); return () => {}; }
  const q = query(ref(database, '/citizen_reports'), orderByChild('userId'), equalTo(uid));
  const handler = (snap) => {
    const data = snap.val() || {};
    const reports = Object.entries(data)
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
    callback(reports);
  };
  onValue(q, handler);
  return () => off(q, 'value', handler);
}

// ─────────────────────────────────────────────────────────
//  NUDGES  (/nudges/{zoneId})
// ─────────────────────────────────────────────────────────

/** Subscribe to active nudges for a specific zone. */
export function subscribeToZoneNudges(zoneId, callback) {
  if (DEMO_MODE) {
    callback([{
      id: 'demo-nudge-1', icon: '❄️', appliance: 'Air Conditioner',
      message: 'Set your AC to 24°C for the next 2 hours to help balance the grid.',
      reward: 50, saving: '~0.8 kWh', peakHour: '18:00–21:00', validMinutes: 30,
    }]);
    return () => {};
  }
  const nudgesRef = ref(database, `/nudges/${zoneId}`);
  const handler = (snap) => {
    const data = snap.val() || {};
    const nudges = Object.entries(data)
      .map(([id, n]) => ({ id, ...n }))
      .filter(n => !n.expired);
    callback(nudges);
  };
  onValue(nudgesRef, handler);
  return () => off(nudgesRef, 'value', handler);
}

/** Record a nudge compliance event for a user. */
export async function recordNudgeCompliance(uid, nudge, accepted) {
  if (DEMO_MODE) return;
  await push(ref(database, `/users/${uid}/nudge_history`), {
    nudgeId: nudge.id,
    accepted,
    reward: accepted ? nudge.reward : 0,
    message: nudge.message,
    timestamp: new Date().toISOString(),
  });
  if (accepted && nudge.reward) {
    // Award coins: read current, increment, write back
    const snap = await get(ref(database, `/users/${uid}/energy_coins`));
    const current = snap.val() || 0;
    await update(ref(database, `/users/${uid}`), { energy_coins: current + nudge.reward });
  }
}

/** Subscribe to a user's nudge compliance history. */
export function subscribeToNudgeHistory(uid, callback) {
  if (DEMO_MODE) {
    callback([
      { id: 'nh1', accepted: true, reward: 50, message: 'Set AC to 24°C', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: 'nh2', accepted: false, reward: 0, message: 'Shift washing machine cycle', timestamp: new Date(Date.now() - 86400000).toISOString() },
    ]);
    return () => {};
  }
  const histRef = ref(database, `/users/${uid}/nudge_history`);
  const handler = (snap) => {
    const data = snap.val() || {};
    const history = Object.entries(data)
      .map(([id, n]) => ({ id, ...n }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);
    callback(history);
  };
  onValue(histRef, handler);
  return () => off(histRef, 'value', handler);
}

// ─────────────────────────────────────────────────────────
//  ZONE LOAD  (/zones/{zoneId})
// ─────────────────────────────────────────────────────────

/** Subscribe to a single zone's real-time data. */
export function subscribeToZoneLoad(zoneId, callback) {
  if (DEMO_MODE) {
    const mockLoad = 55 + Math.random() * 30;
    callback({ zoneId, currentLoad: mockLoad, status: mockLoad > 85 ? 'overload' : 'normal', capacityMW: 2000 });
    const interval = setInterval(() => {
      const load = 55 + Math.random() * 30;
      callback({ zoneId, currentLoad: load, status: load > 85 ? 'overload' : 'normal', capacityMW: 2000 });
    }, 5000);
    return () => clearInterval(interval);
  }
  const zoneRef = ref(database, `/zones/${zoneId}`);
  const handler = (snap) => { if (snap.exists()) callback({ zoneId, ...snap.val() }); };
  onValue(zoneRef, handler);
  return () => off(zoneRef, 'value', handler);
}

// ─────────────────────────────────────────────────────────
//  LEADERBOARD  (/users) — top energy_coins in a zone
// ─────────────────────────────────────────────────────────

/** Subscribe to top-5 citizens in a zone by energy_coins. */
export function subscribeToZoneLeaderboard(zoneId, callback) {
  if (DEMO_MODE) {
    callback([
      { uid: 'u1', name: 'Priya S.', energy_coins: 1840 },
      { uid: 'u2', name: 'Rahul M.', energy_coins: 1650 },
      { uid: 'u3', name: 'Anika R.', energy_coins: 1420 },
      { uid: 'u4', name: 'Dev K.', energy_coins: 980 },
      { uid: 'u5', name: 'Sneha P.', energy_coins: 750 },
    ]);
    return () => {};
  }
  // Query users in same zone sorted by energy_coins
  const q = query(ref(database, '/users'), orderByChild('zone_id'), equalTo(zoneId));
  const handler = (snap) => {
    const data = snap.val() || {};
    const users = Object.entries(data)
      .map(([uid, u]) => ({ uid, ...u }))
      .sort((a, b) => (b.energy_coins || 0) - (a.energy_coins || 0))
      .slice(0, 5);
    callback(users);
  };
  onValue(q, handler);
  return () => off(q, 'value', handler);
}

// ─────────────────────────────────────────────────────────
//  ML PREDICTIONS  (/predictions) — operator only
// ─────────────────────────────────────────────────────────

export function subscribeToPredictions(callback) {
  if (DEMO_MODE) {
    callback([
      { zoneId: 'DL-01', zone: 'Delhi Central', risk: 'high', confidence: 87, peakAt: '19:30', predictedLoad: 91, rmse: 5.44 },
      { zoneId: 'MH-01', zone: 'Mumbai Metro', risk: 'medium', confidence: 71, peakAt: '20:00', predictedLoad: 78, rmse: 5.44 },
      { zoneId: 'UP-01', zone: 'Lucknow Region', risk: 'low', confidence: 61, peakAt: '21:00', predictedLoad: 63, rmse: 5.44 },
    ]);
    return () => {};
  }
  const predictionsRef = ref(database, '/predictions');
  const handler = (snap) => {
    const data = snap.val() || {};
    const predictions = Object.entries(data).map(([id, p]) => ({ id, ...p }));
    callback(predictions);
  };
  onValue(predictionsRef, handler);
  return () => off(predictionsRef, 'value', handler);
}
