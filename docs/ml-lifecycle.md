# ML Lifecycle Mapping (Project Structure)

This repo follows the same end-to-end flow as the "ML engineering lifecycle" diagram:

## 1) Goal definition
- What: Detect phishing risk for URLs, email text, OCR-extracted image text, and file attachments.
- Where it shows up: UI pages, API responses (`label`, `score`, `reasons`).

## 2) Data collection + preparation
- Synthetic dataset generation:
  - `backend/scripts/generate_dataset.py` creates:
    - `backend/data/urls_1m.csv`
    - `backend/data/emails_1m.csv`
- Optional runtime data:
  - Scan history stored in MongoDB (or in-memory fallback):
    - `backend/services/db.py`
    - endpoints: `GET /api/history`, `GET /api/report/<id>`

## 3) Feature engineering
- URL features:
  - `backend/services/feature_extraction.py` (`extract_url_features`)
- Email/OCR text features:
  - TF-IDF vectorizers created during training in `backend/scripts/train_models.py`

## 4) Model training
- `backend/scripts/train_models.py`
  - trains URL + Email models (plus OCR-text + file model)
  - writes artifacts to `backend/models/`:
    - `*.joblib` models/vectorizers
    - `model_benchmark.csv`, `aux_model_metrics.csv`
    - histogram plots `*_accuracy_hist.png`

## 5) Model evaluation
- CSV metrics produced by training:
  - `backend/models/model_benchmark.csv`
  - `backend/models/aux_model_metrics.csv`
- UI graphs:
  - `frontend/src/pages/Analysis.jsx` (Recharts)
- API for graphs:
  - `GET /api/analysis/metrics` in `backend/app.py`

## 6) Model serving
- Flask API:
  - Entry: `backend/app.py` (port `5001`)
  - Prediction logic: `backend/services/model_service.py`

## 7) Model deployment
- Local development deployment:
  - Backend: `python backend/app.py`
  - Frontend: `npm run dev` in `frontend/` (port `5174`)
  - Extension: load unpacked `extension/` in Chrome

## 8) Monitoring + maintenance
- Basic monitoring:
  - `GET /api/health` and `GET /api/stats`
  - history endpoints for recent scans
- Maintenance loop:
  - re-run dataset + training scripts to refresh models
  - retrain artifacts in `backend/models/` are loaded by the API on startup

