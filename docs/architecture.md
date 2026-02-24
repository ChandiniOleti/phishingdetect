# System Architecture

## Components
- Flask API (scanning, scoring, reports)
- MongoDB (scan history and analytics)
- ML pipeline (dataset generation + model training)
- React dashboard (multi-page UI)
- Chrome extension (real-time URL monitoring)

## Data flow
1. User submits URL/email/image/file.
2. Flask API extracts features and calls ML models.
3. Results stored in MongoDB and returned to UI.
4. Dashboard visualizes alerts, stats, and reports.
5. Extension monitors browsing and triggers alerts.

## ML lifecycle mapping
See `docs/ml-lifecycle.md` for how dataset generation, feature engineering, training, evaluation graphs, and serving map to the codebase.

## Security notes
- File scans run in a local sandbox folder.
- OCR processing is optional and can be disabled.
