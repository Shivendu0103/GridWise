"""
GridWise Seed Script
====================
Seeds Firebase Realtime Database with initial zone metadata from zones.json.
Run this ONCE before starting the data generator.

Usage:
    python seed.py

Requirements:
    pip install firebase-admin
"""

import json
import os

try:
    import firebase_admin
    from firebase_admin import credentials, db
except ImportError:
    print("[ERROR] Install firebase-admin: pip install firebase-admin")
    exit(1)

DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "https://gridwise-india-default-rtdb.firebaseio.com")
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
ZONES_PATH = os.path.join(os.path.dirname(__file__), "zones.json")

def main():
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"[ERROR] Place your Firebase service account key at:\n  {SERVICE_ACCOUNT_PATH}")
        return

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
    print(f"[OK] Connected to {DATABASE_URL}")

    with open(ZONES_PATH) as f:
        data = json.load(f)

    zones = data["zones"]
    zones_ref = db.reference("/zones")

    print(f"[INFO] Seeding {len(zones)} zones...")
    for zone in zones:
        zone_data = {
            "zoneId": zone["zoneId"],
            "name": zone["name"],
            "state": zone["state"],
            "city": zone["city"],
            "capacityMW": zone["capacity_MW"],
            "lat": zone["lat"],
            "lng": zone["lng"],
            "bounds": zone["bounds"],
            # Initial live metrics
            "currentLoad": zone["currentLoad"],
            "activeMW": round(zone["capacity_MW"] * zone["currentLoad"] / 100, 1),
            "status": "normal",
            "frequencyHz": 50.0,
            "voltageKV": 220.0,
            "lastUpdated": "2026-04-19T00:00:00Z"
        }
        zones_ref.child(zone["zoneId"]).set(zone_data)
        print(f"  ✓ {zone['zoneId']} — {zone['name']}")

    # Seed empty collections
    db.reference("/alerts").set({})
    db.reference("/reports").set({})
    db.reference("/predictions").set({})
    db.reference("/users").set({})

    print(f"\n[DONE] Database seeded successfully!")
    print("  Next step: run python generate.py to start live data simulation")

if __name__ == "__main__":
    main()
