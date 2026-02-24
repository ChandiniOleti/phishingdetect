# Deployment Guide

## Local
1. Start MongoDB.
2. Run Flask API (`python app.py`).
3. Run React UI (`npm run dev`).
4. Load Chrome extension.

## Production
- Deploy Flask API behind a WSGI server (gunicorn / waitress).
- Use environment variables for secrets and MongoDB URI.
- Build React app with `npm run build` and serve with Nginx.
