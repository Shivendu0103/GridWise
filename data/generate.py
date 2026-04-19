"""
GridWise Data Generator
=======================
Simulates realistic load curves for 20 Indian grid zones and pushes
live updates to Firebase Realtime Database.

Usage:
    python generate.py [--once] [--overload] [--interval 5]

Requirements:
    pip install firebase-admin numpy

Setup:
    1. Download your Firebase service account JSON from:
       Firebase Console → Project Settings → Service Accounts → Generate new key
    2. Save it as data/serviceAccountKey.json
    3. Set FIREBASE_DATABASE_URL in your environment or edit the constant below
"""

import argparse
import json
import math
import os
import random
import time
from datetime import datetime

import numpy as np

try:
    import firebase_admin
    from firebase_admin import credentials, db
    FIREBASE_AVAILABLE = True
except ImportError:
    print("[WARN] firebase-admin not installed. Run: pip install firebase-admin")
    FIREBASE_AVAILABLE = False

# ──────────────────────────────────────────────────────────
#  CONFIGURATION
# ──────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "https://gridwise-india-default-rtdb.firebaseio.com")
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
ZONES_PATH = os.path.join(os.path.dirname(__file__), "zones.json")

# Indian load curve peaks:  morning 8–10, evening 18–22
PEAK_HOURS = {
    "morning": (8, 10),
    "evening": (18, 22)
}

OVERLOAD_THRESHOLD = 85   # % — triggers alert
CRITICAL_THRESHOLD = 95   # % — critical alert


# ──────────────────────────────────────────────────────────
#  LOAD SIMULATION
# ──────────────────────────────────────────────────────────
def load_curve(hour: float) -> float:
    """
    Returns a base load percentage (0–100) for a given hour.
    Models Indian residential + industrial pattern:
      - Trough ~3 AM (25%)
      - Morning peak ~9 AM (65%)
      - Midday dip ~14:00 (55%)
      - Evening peak ~20:00 (85%)
    """
    # Sinusoidal base
    base = 45 + 20 * math.sin((hour - 3) * math.pi / 12)

    # Morning boost
    if PEAK_HOURS["morning"][0] <= hour <= PEAK_HOURS["morning"][1]:
        base += 12 * math.exp(-0.5 * ((hour - 9) / 1.5) ** 2)

    # Evening peak — India's demand spike from AC + lighting
    if PEAK_HOURS["evening"][0] <= hour <= PEAK_HOURS["evening"][1]:
        base += 22 * math.exp(-0.5 * ((hour - 19.5) / 1.8) ** 2)

    return max(15.0, min(99.0, base))


def simulate_zone_load(zone: dict, hour: float, overload_zone: str | None = None) -> dict:
    """Generate current metrics for a zone."""
    base = load_curve(hour)

    # Zone-specific variance: industrial zones run higher
    if "Industrial" in zone["name"] or "Power" in zone["name"]:
        base += random.uniform(5, 12)
    elif "Desert" in zone["name"] or zone["state"] in ("Assam", "Andhra Pradesh"):
        base -= random.uniform(5, 10)

    # Add noise
    noise = random.gauss(0, 3)
    current_load = round(max(15.0, min(99.0, base + noise)), 1)

    # Force overload for demo
    if overload_zone and zone["zoneId"] == overload_zone:
        current_load = round(random.uniform(89, 96), 1)

    # Compute derived metrics
    capacity_mw = zone["capacity_MW"]
    active_mw = round(capacity_mw * current_load / 100, 1)
    frequency_hz = round(50.0 + random.gauss(0, 0.05), 3)  # India grid: 50 Hz ± deviation
    voltage_kv = round(220 + random.gauss(0, 2), 1)

    # Status classification
    if current_load >= CRITICAL_THRESHOLD:
        status = "critical"
    elif current_load >= OVERLOAD_THRESHOLD:
        status = "overload"
    elif current_load <= 30:
        status = "surplus"
    elif current_load <= 50:
        status = "low"
    else:
        status = "normal"

    return {
        "currentLoad": current_load,
        "activeMW": active_mw,
        "capacityMW": capacity_mw,
        "frequencyHz": frequency_hz,
        "voltageKV": voltage_kv,
        "status": status,
        "lastUpdated": datetime.utcnow().isoformat() + "Z"
    }


# ──────────────────────────────────────────────────────────
#  FIREBASE PUSH
# ──────────────────────────────────────────────────────────
def init_firebase():
    if not FIREBASE_AVAILABLE:
        return None
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"[ERROR] Service account key not found at {SERVICE_ACCOUNT_PATH}")
        print("  Download from: Firebase Console → Project Settings → Service Accounts")
        return None
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
        print(f"[OK] Firebase connected to {DATABASE_URL}")
        return True
    except Exception as e:
        print(f"[ERROR] Firebase init failed: {e}")
        return None


def push_zone_update(zone_id: str, metrics: dict, firebase_ok: bool):
    """Push metrics to /zones/{zoneId} in RTDB."""
    if firebase_ok:
        try:
            db.reference(f"/zones/{zone_id}").update(metrics)
        except Exception as e:
            print(f"  [WARN] Push failed for {zone_id}: {e}")
    else:
        # Local-only mode — just print
        pass


def push_alert(zone: dict, metrics: dict, firebase_ok: bool):
    """Write an alert to /alerts/ when zone is overloaded."""
    alert = {
        "zoneId": zone["zoneId"],
        "zoneName": zone["name"],
        "state": zone["state"],
        "load": metrics["currentLoad"],
        "status": metrics["status"],
        "activeMW": metrics["activeMW"],
        "capacityMW": metrics["capacityMW"],
        "timestamp": metrics["lastUpdated"],
        "resolved": False
    }
    if firebase_ok:
        try:
            db.reference("/alerts").push(alert)
        except Exception as e:
            print(f"  [WARN] Alert push failed: {e}")
    return alert


# ──────────────────────────────────────────────────────────
#  MAIN LOOP
# ──────────────────────────────────────────────────────────
def run(interval: int, once: bool, overload_zone: str | None):
    with open(ZONES_PATH) as f:
        zones = json.load(f)["zones"]

    firebase_ok = init_firebase() is not None

    print(f"\n{'='*55}")
    print(f"  GridWise Data Generator")
    print(f"  Zones: {len(zones)} | Interval: {interval}s | Firebase: {'YES' if firebase_ok else 'LOCAL ONLY'}")
    print(f"  Overload zone: {overload_zone or 'none'}")
    print(f"{'='*55}\n")

    iteration = 0
    while True:
        now = datetime.now()
        hour = now.hour + now.minute / 60.0
        iteration += 1

        print(f"\n[{now.strftime('%H:%M:%S')}] Tick #{iteration}")
        alerts_triggered = []

        for zone in zones:
            metrics = simulate_zone_load(zone, hour, overload_zone)
            push_zone_update(zone["zoneId"], metrics, firebase_ok)

            status_emoji = {
                "critical": "🔴", "overload": "🟠",
                "normal": "🟢", "low": "🟡", "surplus": "🔵"
            }.get(metrics["status"], "⚪")

            print(f"  {status_emoji} {zone['zoneId']:8s} {zone['name']:22s} "
                  f"{metrics['currentLoad']:5.1f}% | {metrics['activeMW']:6.0f} MW | "
                  f"{metrics['status']}")

            # Trigger alert
            if metrics["status"] in ("overload", "critical"):
                alert = push_alert(zone, metrics, firebase_ok)
                alerts_triggered.append(alert)

        if alerts_triggered:
            print(f"\n  ⚡ ALERTS TRIGGERED: {len(alerts_triggered)}")
            for a in alerts_triggered:
                print(f"     → {a['zoneName']} ({a['zoneId']}) — {a['load']}% — {a['status'].upper()}")

        if once:
            print("\n[DONE] --once flag set. Exiting.")
            break

        print(f"\n  Next update in {interval}s... (Ctrl+C to stop)")
        time.sleep(interval)


# ──────────────────────────────────────────────────────────
#  ENTRY POINT
# ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GridWise live data generator")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--interval", type=int, default=5, help="Update interval in seconds")
    parser.add_argument("--overload", type=str, default=None, metavar="ZONE_ID",
                        help="Force a specific zone to overload (e.g. UP-01)")
    args = parser.parse_args()

    try:
        run(interval=args.interval, once=args.once, overload_zone=args.overload)
    except KeyboardInterrupt:
        print("\n\n[STOPPED] Generator shut down.")
