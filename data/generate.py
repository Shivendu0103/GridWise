import json
import random
import math
import numpy as np
from datetime import datetime, timedelta

ZONES = [
    {"id": "zone_001", "name": "Delhi Central",       "state": "Delhi",        "capacity_mw": 450},
    {"id": "zone_002", "name": "Delhi North",          "state": "Delhi",        "capacity_mw": 320},
    {"id": "zone_003", "name": "Mumbai Suburban",      "state": "Maharashtra",  "capacity_mw": 600},
    {"id": "zone_004", "name": "Mumbai Industrial",    "state": "Maharashtra",  "capacity_mw": 800},
    {"id": "zone_005", "name": "Chennai North",        "state": "Tamil Nadu",   "capacity_mw": 380},
    {"id": "zone_006", "name": "Chennai South",        "state": "Tamil Nadu",   "capacity_mw": 290},
    {"id": "zone_007", "name": "Bengaluru Central",    "state": "Karnataka",    "capacity_mw": 500},
    {"id": "zone_008", "name": "Bengaluru Industrial", "state": "Karnataka",    "capacity_mw": 420},
    {"id": "zone_009", "name": "Kolkata Central",      "state": "West Bengal",  "capacity_mw": 350},
    {"id": "zone_010", "name": "Kolkata Port",         "state": "West Bengal",  "capacity_mw": 280},
    {"id": "zone_011", "name": "Hyderabad Central",    "state": "Telangana",    "capacity_mw": 410},
    {"id": "zone_012", "name": "Pune Industrial",      "state": "Maharashtra",  "capacity_mw": 360},
    {"id": "zone_013", "name": "Ahmedabad North",      "state": "Gujarat",      "capacity_mw": 310},
    {"id": "zone_014", "name": "Ludhiana Central",     "state": "Punjab",       "capacity_mw": 250},
    {"id": "zone_015", "name": "Ludhiana Industrial",  "state": "Punjab",       "capacity_mw": 320},
    {"id": "zone_016", "name": "Jaipur Central",       "state": "Rajasthan",    "capacity_mw": 270},
    {"id": "zone_017", "name": "Lucknow Central",      "state": "Uttar Pradesh","capacity_mw": 300},
    {"id": "zone_018", "name": "Patna Central",        "state": "Bihar",        "capacity_mw": 180},
    {"id": "zone_019", "name": "Bhopal Central",       "state": "Madhya Pradesh","capacity_mw": 220},
    {"id": "zone_020", "name": "Raikot Village",       "state": "Punjab",       "capacity_mw": 15},
]

# Indian festival dates (month, day) — load spikes on these days
FESTIVAL_DATES = {
    (1, 26): 1.12,   # Republic Day
    (3, 25): 1.18,   # Holi
    (8, 15): 1.10,   # Independence Day
    (10, 24): 1.22,  # Diwali approximate
    (11, 1): 1.15,   # Post-Diwali
    (12, 31): 1.14,  # New Year's Eve
}

# Summer months get higher base load (AC usage)
def season_multiplier(month):
    if month in [4, 5, 6]:   return 1.20   # peak summer
    if month in [3, 7]:       return 1.10   # shoulder
    if month in [12, 1, 2]:   return 0.92   # winter
    return 1.0

def load_curve(hour):
    """Realistic Indian grid load pattern by hour."""
    base = (
        0.35
        + 0.12 * math.sin((hour - 6) * math.pi / 12)
        + 0.30 * math.exp(-0.5 * ((hour - 19) / 2.5) ** 2)   # 7pm peak
        + 0.10 * math.exp(-0.5 * ((hour - 8) / 1.5) ** 2)    # 8am peak
    )
    return min(max(base, 0.20), 0.98)

def get_status(pct):
    if pct >= 0.90: return "critical"
    if pct >= 0.78: return "warning"
    if pct <= 0.35: return "underload"
    return "normal"

def generate_dataset(days=90):
    records = []
    now = datetime.now()

    for zone in ZONES:
        is_industrial = "Industrial" in zone["name"]
        is_village    = "Village"    in zone["name"]

        for day_offset in range(days - 1, -1, -1):
            dt_day = now - timedelta(days=day_offset)
            month    = dt_day.month
            weekday  = dt_day.weekday()   # 0=Mon, 6=Sun
            is_weekend = weekday >= 5
            s_mult   = season_multiplier(month)
            f_mult   = FESTIVAL_DATES.get((month, dt_day.day), 1.0)

            for hour in range(24):
                dt = dt_day.replace(hour=hour, minute=0, second=0, microsecond=0)
                base = load_curve(hour)

                # Zone-type adjustments
                if is_industrial:
                    # Flatter curve, less evening peak
                    base = base * 0.55 + 0.35
                elif is_village:
                    # Low overall with sharp evening spike
                    base = base * 0.4 + 0.15
                    base += 0.15 * math.exp(-0.5 * ((hour - 20) / 1.5) ** 2)

                # Season + festival
                base *= s_mult * f_mult

                # Weekend dip
                if is_weekend:
                    base *= 0.82 if not is_industrial else 0.65

                # Gaussian noise
                noise = np.random.normal(0, 0.03)
                load_pct = float(np.clip(base + noise, 0.10, 1.05))
                load_mw  = round(load_pct * zone["capacity_mw"], 2)

                records.append({
                    # Features for ML
                    "zone_id":       zone["id"],
                    "zone_name":     zone["name"],
                    "capacity_mw":   zone["capacity_mw"],
                    "hour":          hour,
                    "day_of_week":   weekday,
                    "month":         month,
                    "is_weekend":    int(is_weekend),
                    "is_industrial": int(is_industrial),
                    "is_village":    int(is_village),
                    "season_mult":   round(s_mult, 3),
                    "festival_mult": round(f_mult, 3),
                    # Target
                    "load_pct":      round(load_pct, 4),
                    "load_mw":       load_mw,
                    "status":        get_status(load_pct),
                    # Timestamp
                    "timestamp":     int(dt.timestamp() * 1000),
                    "date":          dt.strftime("%Y-%m-%d"),
                    "datetime":      dt.strftime("%Y-%m-%d %H:%M"),
                })

    print(f"Generated {len(records)} records ({days} days × 24 hours × {len(ZONES)} zones)")
    return records

if __name__ == "__main__":
    print("Generating 90-day dataset...")
    records = generate_dataset(days=90)

    with open("data/grid_history.json", "w") as f:
        json.dump(records, f, indent=2)

    print(f"Saved to data/grid_history.json")
    print(f"Total records: {len(records):,}")
    print(f"Zones: {len(ZONES)}")
    print(f"Sample record:\n{json.dumps(records[0], indent=2)}")