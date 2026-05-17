"""Fix Unicode box-drawing characters in train_lstm.py that break Windows CP1252."""
import re

path = "data/train_lstm.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace every non-ASCII character in print statements that causes CP1252 issues
replacements = [
    ("\u2500\u2500 Comparison \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", "-- Comparison ------------------------------"),
    ("\u2705 LSTM is", "[WIN] LSTM is"),
    ("\u2014 use LSTM in production", "-- use LSTM in production"),
    ("\u26a0\ufe0f  LSTM is only", "[MARGINAL] LSTM is only"),
    ("\u2014 baseline may be sufficient", "-- baseline may be sufficient"),
    ("\u274c Baseline wins \u2014 keep using linear regression", "[LOSS] Baseline wins -- keep using linear regression"),
    ("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", "--------------------------------------------"),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed train_lstm.py")
