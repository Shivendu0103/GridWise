# GridWise ML Backend

FastAPI server that serves next-hour load predictions from the trained linear regression model.

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## Running

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## Firebase (Optional)

To enable live RTDB zone data for lag features, place your Firebase service account key at:

```
data/serviceAccountKey.json
```

Download from: Firebase Console → Project Settings → Service accounts → Generate new private key.

Without it, the server uses static zone data from `data/zones.json`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — confirms model and Firebase status |
| `GET` | `/predict/all` | Predictions for all 20 zones (sorted by risk) |
| `GET` | `/predict/{zone_id}` | Single zone prediction (e.g. `/predict/DL-01`) |

## API Docs

Interactive docs available at `http://localhost:8000/docs` (Swagger UI).
