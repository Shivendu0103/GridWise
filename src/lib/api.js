// src/lib/api.js
// ─────────────────────────────────────────────────────────
// API client for the GridWise FastAPI ML backend
// ─────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Fetch predictions for ALL 20 zones.
 * Returns { predictions: [...], generated_at, model }
 */
export async function fetchPredictions() {
  const res = await fetch(`${API_BASE}/predict/all`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * Fetch prediction for a single zone.
 * Returns { zone_id, zone_name, predicted_load_pct, risk, confidence, ... }
 */
export async function fetchZonePrediction(zoneId) {
  const res = await fetch(`${API_BASE}/predict/${encodeURIComponent(zoneId)}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * Check if the ML backend is running.
 * Returns { status, model_loaded, firebase_connected }
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
