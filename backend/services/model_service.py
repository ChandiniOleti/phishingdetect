import os
import joblib
import numpy as np
from .feature_extraction import extract_url_features, score_url_rule_based
from .image_vision import image_bytes_to_vector


class ModelService:
    def __init__(self, model_dir: str):
        self.model_dir = model_dir
        self.url_model = None
        self.email_distilbert = None
        self.ocr_model = None
        self.ocr_vectorizer = None
        self.image_model = None
        self._load_models()

    def _load_models(self):
        try:
            self.url_model = joblib.load(os.path.join(self.model_dir, "url_model.joblib"))
        except Exception:
            self.url_model = None

        distilbert_dir = os.path.join(self.model_dir, "email_distilbert")
        if os.path.isdir(distilbert_dir):
            try:
                from transformers import pipeline

                self.email_distilbert = pipeline(
                    "text-classification",
                    model=distilbert_dir,
                    tokenizer=distilbert_dir,
                )
            except Exception:
                self.email_distilbert = None
        else:
            self.email_distilbert = None

        try:
            self.ocr_model = joblib.load(os.path.join(self.model_dir, "ocr_model.joblib"))
            self.ocr_vectorizer = joblib.load(os.path.join(self.model_dir, "ocr_vectorizer.joblib"))
        except Exception:
            self.ocr_model = None
            self.ocr_vectorizer = None
        try:
            self.image_model = joblib.load(os.path.join(self.model_dir, "image_model.joblib"))
        except Exception:
            self.image_model = None

    def predict_url(self, url: str) -> dict:
        # Always compute rule-based score so we can override obvious phishing patterns
        # even when ML confidence is borderline.
        rules_label, rules_score, rules_reasons = score_url_rule_based(url)

        if self.url_model is None:
            return {"label": rules_label, "score": rules_score, "reasons": rules_reasons, "model": "rules"}

        features = extract_url_features(url)
        vector = np.array([list(features.values())])
        ml_proba = float(self.url_model.predict_proba(vector)[0][1])

        # Hybrid: take the higher risk score between ML and rules.
        score = max(ml_proba, float(rules_score))
        label = "phishing" if score >= 0.5 else "legitimate"

        reasons = ["ML URL classifier"]
        if rules_reasons:
            reasons.extend(rules_reasons)
        if rules_score > ml_proba and label == "phishing":
            reasons.append("Heuristic override (keyword/URL pattern risk)")

        return {
            "label": label,
            "score": score,
            "reasons": reasons,
            "model": "hybrid",
        }

    def predict_email(self, text: str) -> dict:
        if self.email_distilbert is None:
            return {
                "label": "unknown",
                "score": 0.5,
                "reasons": ["DistilBERT email model not loaded"],
                "model": "none",
                "is_fake": None,
                "verdict": "unknown",
            }

        try:
            pred = self.email_distilbert(text, truncation=True, max_length=256)[0]
            raw_label = str(pred.get("label", "")).strip().lower()
            raw_score = float(pred.get("score", 0.5))

            phishing_labels = {"label_1", "phishing", "malicious", "spam"}
            legit_labels = {"label_0", "legitimate", "safe", "ham"}

            if raw_label in phishing_labels:
                phishing_score = raw_score
            elif raw_label in legit_labels:
                phishing_score = 1.0 - raw_score
            else:
                phishing_score = raw_score if "1" in raw_label else 1.0 - raw_score

            label = "phishing" if phishing_score >= 0.5 else "legitimate"
            is_fake = label == "phishing"
            return {
                "label": label,
                "score": float(phishing_score),
                "reasons": ["DistilBERT email classifier"],
                "model": "distilbert",
                "is_fake": is_fake,
                "verdict": "fake" if is_fake else "not_fake",
            }
        except Exception as exc:
            return {
                "label": "unknown",
                "score": 0.5,
                "reasons": [f"DistilBERT inference failed: {exc}"],
                "model": "distilbert",
                "is_fake": None,
                "verdict": "unknown",
            }

    def predict_ocr_text(self, text: str) -> dict:
        if self.ocr_model is None or self.ocr_vectorizer is None:
            return self.predict_email(text)
        vector = self.ocr_vectorizer.transform([text])
        proba = self.ocr_model.predict_proba(vector)[0][1]
        label = "phishing" if proba >= 0.5 else "legitimate"
        return {
            "label": label,
            "score": float(proba),
            "reasons": ["ML OCR-text classifier"],
            "model": "ml_ocr",
        }

    def predict_image(self, file_bytes: bytes) -> dict:
        """
        Lightweight vision model (optional): predicts phishing vs legitimate from pixels.
        This is independent of OCR and can work even when OCR is unavailable.
        """
        if self.image_model is None:
            return {"label": "unknown", "score": 0.5, "reasons": ["Image model not loaded"], "model": "none"}
        vector = image_bytes_to_vector(file_bytes)
        proba = float(self.image_model.predict_proba(vector)[0][1])
        label = "phishing" if proba >= 0.5 else "legitimate"
        return {
            "label": label,
            "score": proba,
            "reasons": ["ML image classifier (vision)"],
            "model": "ml_image",
        }
