# PhishGuard AI - Real-Time Phishing Detection

A full-stack AI/ML phishing detection system with Flask backend, MongoDB storage, a polished multi-page React dashboard, and a Chrome extension for real-time URL monitoring.

## What you get
- URL, email, image OCR, and file attachment scanning
- ML pipeline with URL models + DistilBERT email model, histogram plots, and benchmark CSVs
- Scan history and reports stored in MongoDB (with in-memory fallback)
- Chrome extension (MV3) with real-time alerts
- Multi-page dashboard with threat analytics and exportable reports

## Quick start
### Backend
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python scripts/train_models.py
python scripts/train_image_model.py
python app.py
```

API runs on: `http://localhost:5000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```

UI runs on: `http://localhost:5174`

Landing page: `http://localhost:5174/`
After login: `http://localhost:5174/about`

### Chrome Extension
1. Open `chrome://extensions` in Chrome.
2. Enable Developer Mode.
3. Click `Load unpacked` and select the `extension` folder.

## Environment variables
- `MONGO_URI` (default `mongodb://localhost:27017`)
- `MONGO_DB` (default `phishguard`)
- `MODEL_DIR` (default `backend/models`)
- `DATA_DIR` (default `backend/data`)
- `SECRET_KEY` (default `dev-secret-change-me`)
- `DISTILBERT_ENABLED` (default `1`; keep enabled because email detection uses DistilBERT)
- `DISTILBERT_MODEL_NAME` (default `distilbert-base-uncased`)
- `DISTILBERT_MAX_TRAIN_SAMPLES` (default `24000`)
- `DISTILBERT_MAX_EVAL_SAMPLES` (default `6000`)
- `DISTILBERT_MAX_LENGTH` (default `256`)
- `DISTILBERT_EPOCHS` (default `1.0`)
- `DISTILBERT_BATCH_SIZE` (default `8`)
- `DISTILBERT_LEARNING_RATE` (default `2e-5`)

## Authentication
- Default admin user (created on first run if MongoDB is available): `admin@phishguard.ai` / `Admin123!`
- Use the `/login` page in the UI to get a token stored in localStorage.
- The Chrome extension requires the same token (paste it into the extension popup).

## Model outputs
- Benchmark CSV: `backend/models/model_benchmark.csv`
- URL histogram: `backend/models/url_model_accuracy_hist.png`
- Email histogram: `backend/models/email_model_accuracy_hist.png`
- DistilBERT artifacts (if trained): `backend/models/email_distilbert/` and `backend/models/email_distilbert_metrics.json`
- OCR model metrics: `backend/models/aux_model_metrics.csv`
- Notebook: `backend/notebooks/notebook50a9c366a8.ipynb`

## Analysis page (frontend graphs)
- Route: `http://localhost:5174/analysis`
- Backend endpoint: `GET http://localhost:5000/api/analysis/metrics`

## Data files
- Large datasets are generated as `backend/data/urls_1m.csv` and `backend/data/emails_1m.csv`.
- If `backend/data/urls.csv` or `backend/data/emails.csv` are open in another app, close them before deleting.

## Project structure
- `backend/` Flask API, ML scripts, and models
- `frontend/` React UI
- `extension/` Chrome extension
- `docs/` Diagrams and documentation
