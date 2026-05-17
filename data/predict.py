import json
import numpy as np
import joblib
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

from datetime import datetime
import tensorflow as tf

def predict_next_hour(zone_id, recent_24h_loads):
    """
    Given a zone_id and the last 24 hours of load_pct values,
    returns predicted next-hour load_pct and confidence.

    recent_24h_loads: list of 24 floats, e.g. [0.65, 0.70, ...]
    """
    # Load LSTM
    model   = tf.keras.models.load_model("data/models/lstm_final.keras")
    scalers = joblib.load("data/models/lstm_scalers.pkl")

    if zone_id not in scalers:
        raise ValueError(f"No scaler found for {zone_id}")

    scaler = scalers[zone_id]
    now    = datetime.now()

    # Build feature sequence for last 24 hours
    sequence = []
    for i, load in enumerate(recent_24h_loads[-24:]):
        hour       = (now.hour - (23 - i)) % 24
        is_weekend = int(now.weekday() >= 5)
        season     = 1.20 if now.month in [4,5,6] else 1.10 if now.month in [3,7] else 0.92 if now.month in [12,1,2] else 1.0
        festival   = 1.0
        sequence.append([load, hour, is_weekend, season, festival])

    # Scale and predict
    seq_scaled = scaler.transform(np.array(sequence))
    X = seq_scaled.reshape(1, 24, 5)
    pred_scaled = model.predict(X, verbose=0)[0][0]

    # Inverse scale just the load_pct column
    dummy = np.zeros((1, 5))
    dummy[0, 0] = pred_scaled
    pred_load = scaler.inverse_transform(dummy)[0][0]
    pred_load = float(np.clip(pred_load, 0.0, 1.05))

    # Confidence: inverse of recent variance
    variance   = float(np.var(recent_24h_loads[-6:]))
    confidence = round(max(0.5, min(0.99, 1.0 - variance * 10)), 2)

    return {
        "zone_id":         zone_id,
        "predicted_load":  round(pred_load, 4),
        "predicted_pct":   f"{round(pred_load * 100, 1)}%",
        "risk":            "critical" if pred_load > 0.90 else "warning" if pred_load > 0.78 else "normal",
        "confidence":      confidence,
        "predicted_for":   f"{(now.hour + 1) % 24}:00",
    }


if __name__ == "__main__":
    # Test with fake recent data for zone_001
    test_loads = [0.45, 0.42, 0.40, 0.38, 0.36, 0.35,
                  0.42, 0.58, 0.65, 0.68, 0.66, 0.64,
                  0.62, 0.63, 0.65, 0.67, 0.70, 0.74,
                  0.82, 0.88, 0.91, 0.89, 0.84, 0.78]

    result = predict_next_hour("zone_001", test_loads)
    print(json.dumps(result, indent=2))