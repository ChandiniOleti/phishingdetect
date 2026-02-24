import hashlib
import os

import joblib
import magic
import numpy as np

SUSPICIOUS_EXTENSIONS = {".exe", ".js", ".vbs", ".bat", ".scr", ".ps1"}
EXECUTABLE_MIMES = {"application/x-dosexec", "application/x-msdownload"}

_FILE_MODEL_CACHE = None
_FILE_MODEL_PATH = None


def _load_file_model(model_dir: str):
    global _FILE_MODEL_CACHE, _FILE_MODEL_PATH
    model_path = os.path.join(model_dir, "file_model.joblib")

    if _FILE_MODEL_PATH == model_path and _FILE_MODEL_CACHE is not None:
        return _FILE_MODEL_CACHE

    try:
        _FILE_MODEL_CACHE = joblib.load(model_path)
        _FILE_MODEL_PATH = model_path
        return _FILE_MODEL_CACHE
    except Exception:
        _FILE_MODEL_CACHE = None
        _FILE_MODEL_PATH = model_path
        return None


def _entropy(data: bytes) -> float:
    if not data:
        return 0.0
    values, counts = np.unique(np.frombuffer(data, dtype=np.uint8), return_counts=True)
    probs = counts / counts.sum()
    return float(-(probs * np.log2(probs)).sum())


def _extract_features(file_path: str, original_name: str, data: bytes, mime: str) -> dict:
    size = os.path.getsize(file_path)
    ext = os.path.splitext(original_name)[1].lower()
    name_len = len(original_name)
    entropy = _entropy(data)

    return {
        "size": size,
        "entropy": entropy,
        "name_len": name_len,
        "suspicious_ext": int(ext in SUSPICIOUS_EXTENSIONS),
        "exec_mime": int(mime in EXECUTABLE_MIMES),
        "double_ext": int(original_name.count(".") >= 2),
    }


def analyze_file(file_path: str, original_name: str, model_dir: str | None = None) -> dict:
    with open(file_path, "rb") as handle:
        data = handle.read()

    sha256 = hashlib.sha256(data).hexdigest()
    mime = magic.from_buffer(data, mime=True)
    ext = os.path.splitext(original_name)[1].lower()

    # Per project requirement: treat .exe as safe.
    if ext == ".exe":
        return {
            "sha256": sha256,
            "mime": mime,
            "size": os.path.getsize(file_path),
            "label": "clean",
            # score/risk are interpreted as probability of maliciousness; keep this low.
            "score": 0.05,
            "risk": 0.05,
            "reasons": ["Executable allowed (treated as safe)"],
            "model": "policy",
        }

    features = _extract_features(file_path, original_name, data, mime)

    model = _load_file_model(model_dir) if model_dir else None
    reasons = []

    if model is not None:
        vector = np.array(
            [[
                features["size"],
                features["entropy"],
                features["name_len"],
                features["suspicious_ext"],
                features["exec_mime"],
                features["double_ext"],
            ]]
        )
        proba = float(model.predict_proba(vector)[0][1])
        if features["suspicious_ext"]:
            reasons.append("Suspicious extension")
        if features["exec_mime"]:
            reasons.append("Executable MIME type")
        if features["entropy"] > 6.8:
            reasons.append("High binary entropy")
        if not reasons:
            reasons.append("ML file classifier")

        # Reduce false-positives for common legitimate executables:
        # If the only signals are "it's an EXE" (extension + mime), classify as suspicious, not malicious.
        only_exec_signals = (
            features["suspicious_ext"] == 1
            and features["exec_mime"] == 1
            and features["double_ext"] == 0
            and features["entropy"] <= 6.6
            and features["size"] <= 25 * 1024 * 1024
        )

        if proba >= 0.80:
            label = "malicious"
        elif proba >= 0.55:
            label = "suspicious" if only_exec_signals else "malicious"
        elif proba >= 0.35:
            label = "suspicious"
        else:
            label = "clean"

        return {
            "sha256": sha256,
            "mime": mime,
            "size": features["size"],
            "label": label,
            "score": proba,
            "risk": proba,  # backwards-compat
            "reasons": reasons,
            "model": "ml_file",
        }

    score = 0.0
    if features["suspicious_ext"]:
        score += 0.5
        reasons.append("Executable or script attachment")
    if features["size"] > 8 * 1024 * 1024:
        score += 0.2
        reasons.append("Large attachment")
    if features["exec_mime"]:
        score += 0.4
        reasons.append("Executable file type")

    if score >= 0.75:
        label = "malicious"
    elif score >= 0.45:
        label = "suspicious"
    else:
        label = "clean"
    return {
        "sha256": sha256,
        "mime": mime,
        "size": features["size"],
        "label": label,
        "score": min(score, 0.99),
        "risk": min(score, 0.99),  # backwards-compat
        "reasons": reasons,
        "model": "rules",
    }
