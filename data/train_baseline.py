import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.preprocessing import LabelEncoder
import joblib
import os

print("Loading dataset...")
with open("data/grid_history.json") as f:
    records = json.load(f)

df = pd.DataFrame(records)
print(f"Dataset shape: {df.shape}")

# ── Features ──────────────────────────────────────────────────────────────────
# Encode zone_id as integer
le = LabelEncoder()
df["zone_encoded"] = le.fit_transform(df["zone_id"])

# Add lag feature: previous hour's load (most predictive single feature)
df = df.sort_values(["zone_id", "timestamp"]).reset_index(drop=True)
df["load_pct_lag1"] = df.groupby("zone_id")["load_pct"].shift(1)
df["load_pct_lag2"] = df.groupby("zone_id")["load_pct"].shift(2)
df["load_pct_lag3"] = df.groupby("zone_id")["load_pct"].shift(3)

# Drop rows where lag is NaN (first few rows per zone)
df = df.dropna(subset=["load_pct_lag1", "load_pct_lag2", "load_pct_lag3"])

FEATURES = [
    "hour",
    "day_of_week",
    "month",
    "is_weekend",
    "is_industrial",
    "is_village",
    "season_mult",
    "festival_mult",
    "zone_encoded",
    "load_pct_lag1",
    "load_pct_lag2",
    "load_pct_lag3",
]
TARGET = "load_pct"

X = df[FEATURES].values
y = df[TARGET].values

# ── Train / test split (time-aware — last 10 days as test) ────────────────────
split_date = df["date"].unique()[-10]   # last 10 days = test
train_mask = df["date"] < split_date
test_mask  = df["date"] >= split_date

X_train, y_train = X[train_mask], y[train_mask]
X_test,  y_test  = X[test_mask],  y[test_mask]

print(f"Train: {len(X_train):,} samples | Test: {len(X_test):,} samples")

# ── Train ─────────────────────────────────────────────────────────────────────
print("Training linear regression...")
model = LinearRegression()
model.fit(X_train, y_train)

# ── Evaluate ──────────────────────────────────────────────────────────────────
y_pred = model.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
mae  = mean_absolute_error(y_test, y_pred)
r2   = model.score(X_test, y_test)

print(f"\n-- Baseline Model Results ------------------")
print(f"  RMSE : {rmse:.4f}  ({rmse*100:.2f}% load error)")
print(f"  MAE  : {mae:.4f}  ({mae*100:.2f}% load error)")
print(f"  R2   : {r2:.4f}")
print(f"--------------------------------------------")

# Feature importance (linear model coefficients)
print("\nTop features by absolute coefficient:")
coef_df = pd.DataFrame({
    "feature": FEATURES,
    "coefficient": model.coef_
}).reindex(pd.Series(np.abs(model.coef_)).sort_values(ascending=False).index)
print(coef_df.to_string(index=False))

# ── Save model + metadata ─────────────────────────────────────────────────────
os.makedirs("data/models", exist_ok=True)

# Save with joblib for Python inference
joblib.dump(model, "data/models/baseline_linear.pkl")

# Save as JSON for Cloud Function inference
model_json = {
    "type":        "linear_regression",
    "features":    FEATURES,
    "coef":        model.coef_.tolist(),
    "intercept":   float(model.intercept_),
    "rmse":        round(rmse, 4),
    "mae":         round(mae, 4),
    "r2":          round(r2, 4),
    "zone_classes": le.classes_.tolist(),
    "trained_on":  f"{len(X_train):,} samples, 80-day window",
}
with open("data/models/baseline_linear.json", "w") as f:
    json.dump(model_json, f, indent=2)

# Save label encoder
joblib.dump(le, "data/models/zone_label_encoder.pkl")

print("\nSaved:")
print("  data/models/baseline_linear.pkl   (Python inference)")
print("  data/models/baseline_linear.json  (Cloud Function inference)")
print("  data/models/zone_label_encoder.pkl")