"""
GridWise FastAPI Backend — ML Prediction Server
================================================
Loads the trained linear regression model and serves next-hour load
predictions for all 20 grid zones.

Run:
    uvicorn main:app --reload --port 8000
"""

import os
import json
import math
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import asynccontextmanager

import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ─── Firebase Admin SDK ─────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, db as rtdb

# ─── Paths ──────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

MODEL_PATH = os.path.join(PROJECT_ROOT, "data", "models", "baseline_linear.pkl")
MODEL_META_PATH = os.path.join(PROJECT_ROOT, "data", "models", "baseline_linear.json")
ENCODER_PATH = os.path.join(PROJECT_ROOT, "data", "models", "zone_label_encoder.pkl")
ZONES_PATH = os.path.join(PROJECT_ROOT, "data", "zones.json")
SERVICE_ACCOUNT_PATH = os.path.join(PROJECT_ROOT, "data", "serviceAccountKey.json")

DATABASE_URL = "https://gridwise-1ece4-default-rtdb.asia-southeast1.firebasedatabase.app"

logger = logging.getLogger("gridwise-api")
logging.basicConfig(level=logging.INFO)

# ─── Globals ────────────────────────────────────────────────────
model = None
label_encoder = None
model_meta = None
zones_data = None
firebase_initialised = False

# Map from the live RTDB zone IDs (DL-01 etc.) to the training zone IDs
# (zone_001 etc.) so the label encoder can encode them.
RTDB_TO_TRAINING_ZONE = {}
TRAINING_TO_RTDB_ZONE = {}


def _build_zone_mappings():
    """
    The model was trained on zone_001..zone_020 from generate.py.
    The live dashboard uses DL-01, MH-01, etc. from zones.json.
    We create a stable bidirectional mapping by pairing them in order.
    """
    global RTDB_TO_TRAINING_ZONE, TRAINING_TO_RTDB_ZONE

    # Training zone IDs in the order the encoder learned them
    training_ids = list(label_encoder.classes_)  # zone_001..zone_020

    # Live zone IDs from zones.json, in file order
    live_ids = [z["zoneId"] for z in zones_data["zones"]]

    for live_id, train_id in zip(live_ids, training_ids):
        RTDB_TO_TRAINING_ZONE[live_id] = train_id
        TRAINING_TO_RTDB_ZONE[train_id] = live_id


# ─── Feature engineering helpers ────────────────────────────────
def season_multiplier(month: int) -> float:
    if month in [4, 5, 6]:
        return 1.20
    if month in [3, 7]:
        return 1.10
    if month in [12, 1, 2]:
        return 0.92
    return 1.0


def festival_multiplier(month: int, day: int) -> float:
    festivals = {
        (1, 26): 1.12,
        (3, 25): 1.18,
        (8, 15): 1.10,
        (10, 24): 1.22,
        (11, 1): 1.15,
        (12, 31): 1.14,
    }
    return festivals.get((month, day), 1.0)


def zone_is_industrial(zone_name: str) -> int:
    return 1 if "Industrial" in zone_name else 0


def zone_is_village(zone_name: str) -> int:
    return 1 if "Village" in zone_name else 0


# ─── Startup / shutdown ────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, label_encoder, model_meta, zones_data, firebase_initialised

    # Load model
    logger.info("Loading linear regression model …")
    model = joblib.load(MODEL_PATH)
    label_encoder = joblib.load(ENCODER_PATH)
    with open(MODEL_META_PATH) as f:
        model_meta = json.load(f)
    with open(ZONES_PATH) as f:
        zones_data = json.load(f)

    _build_zone_mappings()
    logger.info(f"Model loaded — {len(label_encoder.classes_)} zone classes, RMSE {model_meta['rmse']}")

    # Initialise Firebase Admin
    if os.path.exists(SERVICE_ACCOUNT_PATH):
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
        firebase_initialised = True
        logger.info("Firebase Admin SDK initialised (service account)")
    else:
        # Try default credentials (GCE / Cloud Run)
        try:
            firebase_admin.initialize_app(options={"databaseURL": DATABASE_URL})
            firebase_initialised = True
            logger.info("Firebase Admin SDK initialised (default credentials)")
        except Exception as e:
            logger.warning(f"Firebase Admin not available — will use synthetic data: {e}")
            firebase_initialised = False

    yield  # app runs here

    logger.info("Shutting down …")


# ─── App ────────────────────────────────────────────────────────
app = FastAPI(
    title="GridWise ML API",
    description="Serves next-hour load predictions from the trained linear regression model.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "https://gridwise-1ece4.web.app",
        "https://gridwise-1ece4.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helpers ────────────────────────────────────────────────────
def _get_zone_meta(zone_id: str):
    """Return the zones.json entry for a live zone ID."""
    for z in zones_data["zones"]:
        if z["zoneId"] == zone_id:
            return z
    return None


def _read_zone_from_rtdb(zone_id: str) -> dict | None:
    """Read current zone data from Firebase RTDB."""
    if not firebase_initialised:
        return None
    try:
        data = rtdb.reference(f"/zones/{zone_id}").get()
        return data
    except Exception as e:
        logger.error(f"RTDB read failed for {zone_id}: {e}")
        return None


def _predict_zone(zone_id: str) -> dict:
    """
    Build the feature vector for `zone_id`, run inference, return prediction dict.
    """
    zone_meta = _get_zone_meta(zone_id)
    if zone_meta is None:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")

    now = datetime.now()
    next_hour = (now.hour + 1) % 24

    # Determine the training zone ID for the label encoder
    training_zone_id = RTDB_TO_TRAINING_ZONE.get(zone_id)
    if training_zone_id is None:
        raise HTTPException(status_code=404, detail=f"No training mapping for zone {zone_id}")

    zone_encoded = int(label_encoder.transform([training_zone_id])[0])

    # Read live data from RTDB for lag features
    rtdb_data = _read_zone_from_rtdb(zone_id)
    current_load_pct = None
    if rtdb_data and "currentLoad" in rtdb_data:
        current_load_pct = rtdb_data["currentLoad"] / 100.0  # stored as 0–100, model expects 0–1

    # Fallback: use zones.json static data
    if current_load_pct is None:
        current_load_pct = zone_meta.get("currentLoad", 50) / 100.0

    # Lag features — without historical DB we approximate with jitter
    lag1 = current_load_pct
    lag2 = current_load_pct + np.random.normal(0, 0.01)
    lag3 = current_load_pct + np.random.normal(0, 0.015)

    zone_name = zone_meta.get("name", "")
    capacity_mw = zone_meta.get("capacity_MW", 1000)

    # Feature order must match training:
    # hour, day_of_week, month, is_weekend, is_industrial, is_village,
    # season_mult, festival_mult, zone_encoded, load_pct_lag1, load_pct_lag2, load_pct_lag3
    features = np.array([[
        next_hour,
        now.weekday(),
        now.month,
        int(now.weekday() >= 5),
        zone_is_industrial(zone_name),
        zone_is_village(zone_name),
        season_multiplier(now.month),
        festival_multiplier(now.month, now.day),
        zone_encoded,
        lag1,
        lag2,
        lag3,
    ]])

    predicted_load_pct = float(model.predict(features)[0])
    predicted_load_pct = max(0.05, min(1.05, predicted_load_pct))  # clamp
    predicted_load_mw = round(predicted_load_pct * capacity_mw, 1)

    # Risk classification
    if predicted_load_pct >= 0.90:
        risk = "critical"
    elif predicted_load_pct >= 0.78:
        risk = "warning"
    else:
        risk = "normal"

    # Confidence heuristic — based on how far the lag values agree
    variance = float(np.var([lag1, lag2, lag3]))
    confidence = round(max(0.55, min(0.97, 1.0 - variance * 20)), 2)

    return {
        "zone_id": zone_id,
        "zone_name": zone_meta.get("name", ""),
        "predicted_load_pct": round(predicted_load_pct * 100, 1),
        "predicted_load_mw": predicted_load_mw,
        "current_load_pct": round(current_load_pct * 100, 1),
        "risk": risk,
        "confidence": round(confidence * 100),
        "predicted_for": f"{str(next_hour).zfill(2)}:00",
        "capacity_mw": capacity_mw,
        "model_info": {
            "type": "linear_regression",
            "rmse": model_meta["rmse"],
            "r2": model_meta["r2"],
        },
    }


# ─── Endpoints ──────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "firebase_connected": firebase_initialised,
        "zones_loaded": len(zones_data["zones"]) if zones_data else 0,
    }


@app.get("/predict/all")
def predict_all():
    """Predict next-hour load for all 20 zones in parallel."""
    zone_ids = [z["zoneId"] for z in zones_data["zones"]]
    results = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_zone = {executor.submit(_predict_zone, zid): zid for zid in zone_ids}
        for future in as_completed(future_to_zone):
            zid = future_to_zone[future]
            try:
                results.append(future.result())
            except Exception as e:
                logger.error(f"Prediction failed for {zid}: {e}")

    # Sort by risk severity (critical first) then by predicted load desc
    risk_order = {"critical": 0, "warning": 1, "normal": 2}
    results.sort(key=lambda r: (risk_order.get(r["risk"], 3), -r["predicted_load_pct"]))

    return {
        "predictions": results,
        "generated_at": datetime.now().isoformat(),
        "model": {
            "type": "linear_regression",
            "rmse": model_meta["rmse"],
            "r2": model_meta["r2"],
        },
    }


@app.get("/predict/{zone_id}")
def predict_zone(zone_id: str):
    """Predict next-hour load for a single zone."""
    return _predict_zone(zone_id)
