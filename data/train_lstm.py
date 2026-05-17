import json
import numpy as np
import pandas as pd
import joblib
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"   # suppress TF info logs

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, Input
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error

print(f"TensorFlow version: {tf.__version__}")

# ── Load data --------------------------------------------─────────────────────
print("Loading dataset...")
with open("data/grid_history.json") as f:
    records = json.load(f)

df = pd.DataFrame(records)
df = df.sort_values(["zone_id", "timestamp"]).reset_index(drop=True)

# ── Build sequences per zone --------------------------------------------──────
SEQUENCE_LENGTH = 24   # use last 24 hours to predict next hour
FEATURES = ["load_pct", "hour", "is_weekend", "season_mult", "festival_mult"]

def make_sequences(zone_df, seq_len=24):
    """Turn a zone's time series into (X, y) sequence pairs."""
    scaler = MinMaxScaler()
    data = scaler.fit_transform(zone_df[FEATURES].values)

    X, y = [], []
    for i in range(seq_len, len(data)):
        X.append(data[i - seq_len:i])          # 24-hour window
        y.append(data[i, 0])                    # next hour's load_pct (index 0)

    return np.array(X), np.array(y), scaler

print("Building sequences for all zones...")
all_X, all_y = [], []
scalers = {}

for zone_id, zone_df in df.groupby("zone_id"):
    zone_df = zone_df.reset_index(drop=True)
    if len(zone_df) < SEQUENCE_LENGTH + 10:
        continue
    X_zone, y_zone, scaler = make_sequences(zone_df, SEQUENCE_LENGTH)
    all_X.append(X_zone)
    all_y.append(y_zone)
    scalers[zone_id] = scaler

X_all = np.concatenate(all_X, axis=0)
y_all = np.concatenate(all_y, axis=0)

print(f"Total sequences: {len(X_all):,}")
print(f"Sequence shape:  {X_all.shape}   (samples, timesteps, features)")

# ── Train / test split (last 15% = test) ─────────────────────────────────────
split = int(len(X_all) * 0.85)
X_train, X_test = X_all[:split], X_all[split:]
y_train, y_test = y_all[:split], y_all[split:]

print(f"Train: {len(X_train):,} | Test: {len(X_test):,}")

# ── Build LSTM model --------------------------------------------──────────────
print("Building LSTM model...")
model = Sequential([
    Input(shape=(SEQUENCE_LENGTH, len(FEATURES))),
    LSTM(64, return_sequences=True),
    Dropout(0.2),
    LSTM(32, return_sequences=False),
    Dropout(0.2),
    Dense(16, activation="relu"),
    Dense(1, activation="sigmoid"),   # output is 0–1 (normalised load_pct)
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss="mse",
    metrics=["mae"]
)
model.summary()

# ── Train --------------------------------------------─────────────────────────
os.makedirs("data/models", exist_ok=True)

callbacks = [
    EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
    ModelCheckpoint("data/models/lstm_best.keras", save_best_only=True, monitor="val_loss"),
]

print("Training LSTM (this takes a few minutes)...")
history = model.fit(
    X_train, y_train,
    epochs=50,
    batch_size=64,
    validation_split=0.15,
    callbacks=callbacks,
    verbose=1,
)

# ── Evaluate --------------------------------------------──────────────────────
y_pred = model.predict(X_test, verbose=0).flatten()
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
mae  = mean_absolute_error(y_test, y_pred)

print(f"\n-- LSTM Model Results ----------------------")
print(f"  RMSE : {rmse:.4f}  ({rmse*100:.2f}% load error)")
print(f"  MAE  : {mae:.4f}  ({mae*100:.2f}% load error)")
print(f"  Epochs trained: {len(history.history['loss'])}")
print(f"--------------------------------------------")

# ── Load baseline results to compare ─────────────────────────────────────────
try:
    with open("data/models/baseline_linear.json") as f:
        baseline = json.load(f)
    print(f"\n-- Comparison ------------------------------")
    print(f"  Baseline RMSE : {baseline['rmse']:.4f}")
    print(f"  LSTM RMSE     : {rmse:.4f}")
    improvement = (baseline['rmse'] - rmse) / baseline['rmse'] * 100
    if improvement > 5:
        print(f"  [WIN] LSTM is {improvement:.1f}% better -- use LSTM in production")
    elif improvement > 0:
        print(f"  [MARGINAL] LSTM is only {improvement:.1f}% better -- baseline may be sufficient")
    else:
        print(f"  [LOSS] Baseline wins -- keep using linear regression")
    print(f"--------------------------------------------")
except FileNotFoundError:
    print("Run train_baseline.py first to see comparison")

# ── Save everything --------------------------------------------───────────────
model.save("data/models/lstm_final.keras")
joblib.dump(scalers, "data/models/lstm_scalers.pkl")

# Save metadata
metadata = {
    "type":            "lstm",
    "sequence_length": SEQUENCE_LENGTH,
    "features":        FEATURES,
    "rmse":            round(float(rmse), 4),
    "mae":             round(float(mae), 4),
    "architecture":    "LSTM(64) -> Dropout(0.2) -> LSTM(32) -> Dropout(0.2) -> Dense(16) -> Dense(1)",
    "trained_samples": len(X_train),
    "epochs_run":      len(history.history["loss"]),
}
with open("data/models/lstm_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("\nSaved:")
print("  data/models/lstm_final.keras")
print("  data/models/lstm_scalers.pkl")
print("  data/models/lstm_metadata.json")