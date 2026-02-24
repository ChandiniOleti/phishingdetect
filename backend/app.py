import os
import math
import csv
import time
from datetime import datetime
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from werkzeug.utils import secure_filename
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from config import load_settings
from services.model_service import ModelService
from services.ocr_service import extract_text_from_image
from services.file_analyzer import analyze_file
from services.db import ScanRepository, UserRepository


def create_app() -> Flask:
    settings = load_settings()
    app = Flask(__name__)
    CORS(app)
    app.config["SECRET_KEY"] = settings.secret_key

    os.makedirs(settings.model_dir, exist_ok=True)
    os.makedirs(settings.data_dir, exist_ok=True)

    model_service = ModelService(settings.model_dir)
    repo = ScanRepository(settings.mongo_uri, settings.mongo_db)
    users = UserRepository(settings.mongo_uri, settings.mongo_db)
    serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])

    def _to_float(value):
        try:
            num = float(value)
            return None if math.isnan(num) else num
        except Exception:
            return None

    def _read_csv_rows(path: str):
        if not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))

    def generate_token(user: dict) -> str:
        return serializer.dumps({"id": user["_id"], "role": user["role"], "email": user["email"]})

    def require_auth(roles: set[str] | None = None):
        def decorator(fn):
            def wrapper(*args, **kwargs):
                auth = request.headers.get("Authorization", "")
                if not auth.startswith("Bearer "):
                    return jsonify({"error": "Missing token"}), 401
                token = auth.split(" ", 1)[1]
                try:
                    payload = serializer.loads(token, max_age=60 * 60 * 8)
                except SignatureExpired:
                    return jsonify({"error": "Token expired"}), 401
                except BadSignature:
                    return jsonify({"error": "Invalid token"}), 401
                if roles and payload.get("role") not in roles:
                    return jsonify({"error": "Forbidden"}), 403
                g.user = payload
                return fn(*args, **kwargs)
            wrapper.__name__ = fn.__name__
            return wrapper
        return decorator

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "mongo": repo.enabled})

    @app.post("/api/auth/register")
    def register():
        if not users.enabled:
            return jsonify({"error": "Auth storage unavailable"}), 503
        payload = request.get_json(silent=True) or {}
        email = (payload.get("email") or "").strip()
        password = (payload.get("password") or "").strip()
        role = (payload.get("role") or "user").strip()
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        if role not in {"admin", "student", "user", "analyst"}:
            return jsonify({"error": "Invalid role"}), 400
        if users.find_by_email(email):
            return jsonify({"error": "User exists"}), 409
        user = users.create_user(email, password, role)
        token = generate_token(user)
        return jsonify({"user": user, "token": token})

    @app.post("/api/auth/login")
    def login():
        if not users.enabled:
            return jsonify({"error": "Auth storage unavailable"}), 503
        payload = request.get_json(silent=True) or {}
        email = (payload.get("email") or "").strip()
        password = (payload.get("password") or "").strip()
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        user = users.verify_password(email, password)
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401
        token = generate_token(user)
        return jsonify({"user": user, "token": token})

    @app.get("/api/auth/me")
    @require_auth()
    def me():
        return jsonify({"user": g.user})

    @app.post("/api/scan/url")
    @require_auth(roles={"admin", "student", "user", "analyst"})
    def scan_url():
        payload = request.get_json(silent=True) or {}
        url = payload.get("url", "").strip()
        if not url:
            return jsonify({"error": "URL is required"}), 400
        result = model_service.predict_url(url)
        scan = {
            "type": "url",
            "input": url,
            "result": result,
            "user": g.user,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        scan = repo.insert_scan(scan)
        return jsonify(scan)

    @app.post("/api/scan/email")
    @require_auth(roles={"admin", "student", "user", "analyst"})
    def scan_email():
        payload = request.get_json(silent=True) or {}
        text = payload.get("text", "").strip()
        if not text:
            return jsonify({"error": "Email text is required"}), 400
        result = model_service.predict_email(text)
        scan = {
            "type": "email",
            "input": text[:5000],
            "result": result,
            "user": g.user,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        scan = repo.insert_scan(scan)
        return jsonify(scan)

    @app.post("/api/scan/image")
    @require_auth(roles={"admin", "student", "user", "analyst"})
    def scan_image():
        mode = (request.args.get("mode") or request.form.get("mode") or "auto").strip().lower()
        if "file" not in request.files:
            return jsonify({"error": "Image file is required"}), 400
        file = request.files["file"]
        file_bytes = file.read()

        # Vision model (optional) + OCR-text model (optional). Keep latency bounded.
        start = time.perf_counter()
        deadline = start + 5.0  # hard budget for this request
        vision_ms = None
        ocr_ms = None

        vision = {"label": "unknown", "score": 0.5, "reasons": ["Vision skipped"], "model": "none"}
        ocr = {"label": "unknown", "score": 0.5, "reasons": ["OCR skipped"], "model": "none"}
        text = ""

        if mode in {"auto", "vision", "fast"}:
            t0 = time.perf_counter()
            vision = model_service.predict_image(file_bytes)
            vision_ms = int((time.perf_counter() - t0) * 1000)

        # AUTO: only run OCR if vision is uncertain. OCR can be slow.
        run_ocr = mode == "ocr"
        if mode == "auto":
            vs = float(vision.get("score") or 0.5)
            # If vision is confident, skip OCR to keep request fast.
            run_ocr = 0.20 < vs < 0.80

        if run_ocr:
            remaining = deadline - time.perf_counter()
            # If we don't have enough time left, skip OCR to avoid hanging the UI.
            if remaining <= 1.0:
                ocr = {"label": "unknown", "score": 0.5, "reasons": ["OCR skipped (time budget)"], "model": "none"}
            else:
                ocr_timeout = max(0.5, min(4.0, remaining - 0.2))
                t0 = time.perf_counter()
                text = extract_text_from_image(file_bytes, timeout_s=ocr_timeout)
                ocr_ms = int((time.perf_counter() - t0) * 1000)
            ocr = (
                model_service.predict_ocr_text(text)
                if text
                else {"label": "unknown", "score": 0.5, "reasons": ["OCR unavailable"], "model": "none"}
            )

        candidates = [vision, ocr]
        best = max(candidates, key=lambda r: float(r.get("score") or 0))
        label = "phishing" if float(best.get("score") or 0) >= 0.5 else "legitimate"
        reasons = []
        for r in candidates:
            reasons.extend(r.get("reasons") or [])
        result = {
            "label": label,
            "score": float(best.get("score") or 0.0),
            "reasons": list(dict.fromkeys(reasons)),
            "model": f"{mode}:hybrid_image:{vision.get('model', 'none')}+{ocr.get('model', 'none')}",
        }
        scan = {
            "type": "image",
            "input": file.filename,
            "extracted_text": text[:5000],
            "vision": vision,
            "mode": mode,
            "timing": {
                "vision_ms": vision_ms,
                "ocr_ms": ocr_ms,
                "total_ms": int((time.perf_counter() - start) * 1000),
            },
            "result": result,
            "user": g.user,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        scan = repo.insert_scan(scan)
        return jsonify(scan)

    @app.post("/api/scan/file")
    @require_auth(roles={"admin", "student", "user", "analyst"})
    def scan_file():
        if "file" not in request.files:
            return jsonify({"error": "File is required"}), 400
        file = request.files["file"]
        filename = secure_filename(file.filename)
        temp_dir = os.path.join(os.getcwd(), "tmp")
        os.makedirs(temp_dir, exist_ok=True)
        path = os.path.join(temp_dir, filename)
        file.save(path)
        analysis = analyze_file(path, filename, settings.model_dir)
        scan = {
            "type": "file",
            "input": filename,
            "result": analysis,
            "user": g.user,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        scan = repo.insert_scan(scan)
        return jsonify(scan)

    @app.get("/api/history")
    @require_auth(roles={"admin", "student", "user", "analyst"})
    def history():
        if g.user.get("role") in {"admin", "analyst"}:
            return jsonify(repo.list_scans())
        return jsonify(repo.list_scans_by_email(g.user.get("email")))

    @app.get("/api/report/<scan_id>")
    @require_auth(roles={"admin", "student", "user", "analyst"})
    def report(scan_id: str):
        scan = repo.get_scan(scan_id)
        if not scan:
            return jsonify({"error": "Not found"}), 404
        if g.user.get("role") not in {"admin", "analyst"}:
            if scan.get("user", {}).get("email") != g.user.get("email"):
                return jsonify({"error": "Forbidden"}), 403
        return jsonify(scan)

    @app.get("/api/stats")
    @require_auth(roles={"admin", "student", "user", "analyst"})
    def stats():
        if g.user.get("role") in {"admin", "analyst"}:
            scans = repo.list_scans(limit=200)
        else:
            scans = repo.list_scans_by_email(g.user.get("email"), limit=200)
        total = len(scans)
        phishing = sum(1 for s in scans if s.get("result", {}).get("label") in {"phishing", "malicious"})
        safe = total - phishing
        email_loaded = model_service.email_distilbert is not None
        return jsonify({
            "total_scans": total,
            "phishing_detected": phishing,
            "safe": safe,
            "model_status": "loaded" if model_service.url_model and email_loaded else "rules",
        })

    @app.get("/api/analysis/metrics")
    @require_auth(roles={"admin", "student", "user", "analyst"})
    def analysis_metrics():
        benchmark_path = os.path.join(settings.model_dir, "model_benchmark.csv")
        aux_path = os.path.join(settings.model_dir, "aux_model_metrics.csv")
        image_path = os.path.join(settings.model_dir, "image_model_metrics.csv")

        benchmark_rows = _read_csv_rows(benchmark_path)
        aux_rows = _read_csv_rows(aux_path)
        image_rows = _read_csv_rows(image_path)
        if not benchmark_rows and not aux_rows and not image_rows:
            return jsonify({
                "error": "Analysis metrics not found. Run backend/scripts/train_models.py to generate model_benchmark.csv and aux_model_metrics.csv.",
                "model_dir": settings.model_dir,
            }), 404

        def shape_row(row: dict):
            return {
                "model": row.get("model", ""),
                "accuracy": _to_float(row.get("accuracy")),
                "loss": _to_float(row.get("loss")),
            }

        all_metrics = [shape_row(r) for r in benchmark_rows if r.get("model")]
        aux_metrics = [shape_row(r) for r in aux_rows if r.get("model")]

        url_metrics = [m for m in all_metrics if m["model"].startswith("url_")]
        email_metrics = [m for m in all_metrics if m["model"].startswith("email_")]

        image_metrics = [shape_row(r) for r in image_rows if r.get("model")]

        def pick_best(rows: list[dict], metric: str, lower_better: bool = False):
            candidates = [r for r in rows if r.get(metric) is not None]
            if not candidates:
                return None
            keyfn = (lambda r: r[metric])
            return min(candidates, key=keyfn) if lower_better else max(candidates, key=keyfn)

        return jsonify({
            "generated_from": {
                "benchmark_csv": os.path.basename(benchmark_path),
                "aux_csv": os.path.basename(aux_path),
            },
            "url_models": url_metrics,
            "email_models": email_metrics,
            "aux_models": aux_metrics,
            "image_models": image_metrics,
            "best": {
                "url_by_accuracy": pick_best(url_metrics, "accuracy"),
                "url_by_loss": pick_best(url_metrics, "loss", lower_better=True),
                "email_by_accuracy": pick_best(email_metrics, "accuracy"),
                "email_by_loss": pick_best(email_metrics, "loss", lower_better=True),
            },
        })

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
