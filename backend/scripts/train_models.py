import os
import sys
import math
import random
import json
import shutil
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from services.feature_extraction import extract_url_features


def resolve_data_file(data_dir: Path, base_name: str) -> Path:
    one_million = data_dir / f"{base_name}_1m.csv"
    classic = data_dir / f"{base_name}.csv"
    if one_million.exists():
        return one_million
    return classic


def safe_log_loss(y_true, estimator, X):
    if hasattr(estimator, "predict_proba"):
        probs = estimator.predict_proba(X)
        probs = np.clip(probs, 1e-9, 1.0)
        probs = probs / probs.sum(axis=1, keepdims=True)
        return log_loss(y_true, probs)
    return float("nan")


def env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return max(minimum, int(raw))
    except Exception:
        return default


def env_float(name: str, default: float, minimum: float = 0.0) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return max(minimum, float(raw))
    except Exception:
        return default


def train_email_distilbert(X_train, X_test, y_train, y_test, model_dir: Path) -> dict | None:
    if not env_flag("DISTILBERT_ENABLED", True):
        print("Skipping DistilBERT training (DISTILBERT_ENABLED=0).")
        return None

    try:
        import torch
        from torch.utils.data import Dataset
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
            Trainer,
            TrainingArguments,
            set_seed,
        )
    except Exception as exc:
        print(f"Skipping DistilBERT training (missing dependency): {exc}")
        return None

    model_name = os.getenv("DISTILBERT_MODEL_NAME", "distilbert-base-uncased")
    max_train_samples = env_int("DISTILBERT_MAX_TRAIN_SAMPLES", 24000)
    max_eval_samples = env_int("DISTILBERT_MAX_EVAL_SAMPLES", 6000)
    max_length = env_int("DISTILBERT_MAX_LENGTH", 256)
    epochs = env_float("DISTILBERT_EPOCHS", 1.0, minimum=0.1)
    batch_size = env_int("DISTILBERT_BATCH_SIZE", 8)
    learning_rate = env_float("DISTILBERT_LEARNING_RATE", 2e-5, minimum=1e-7)

    train_texts = X_train.tolist()
    train_labels = [int(v) for v in y_train]
    eval_texts = X_test.tolist()
    eval_labels = [int(v) for v in y_test]

    if max_train_samples < len(train_texts):
        idx, _ = train_test_split(
            np.arange(len(train_texts)),
            train_size=max_train_samples,
            random_state=42,
            stratify=train_labels,
        )
        idx = sorted(idx.tolist())
        train_texts = [train_texts[i] for i in idx]
        train_labels = [train_labels[i] for i in idx]

    if max_eval_samples < len(eval_texts):
        idx, _ = train_test_split(
            np.arange(len(eval_texts)),
            train_size=max_eval_samples,
            random_state=42,
            stratify=eval_labels,
        )
        idx = sorted(idx.tolist())
        eval_texts = [eval_texts[i] for i in idx]
        eval_labels = [eval_labels[i] for i in idx]

    class EmailDataset(Dataset):
        def __init__(self, encodings, labels):
            self.encodings = encodings
            self.labels = labels

        def __len__(self):
            return len(self.labels)

        def __getitem__(self, idx):
            item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
            item["labels"] = torch.tensor(self.labels[idx], dtype=torch.long)
            return item

    tmp_dir = model_dir / "email_distilbert_tmp"
    output_dir = model_dir / "email_distilbert"

    try:
        set_seed(42)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

        train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=max_length)
        eval_encodings = tokenizer(eval_texts, truncation=True, padding=True, max_length=max_length)

        train_dataset = EmailDataset(train_encodings, train_labels)
        eval_dataset = EmailDataset(eval_encodings, eval_labels)

        base_args = {
            "output_dir": str(tmp_dir),
            "overwrite_output_dir": True,
            "num_train_epochs": epochs,
            "per_device_train_batch_size": batch_size,
            "per_device_eval_batch_size": batch_size,
            "learning_rate": learning_rate,
            "weight_decay": 0.01,
            "save_strategy": "no",
            "logging_strategy": "steps",
            "logging_steps": 50,
            "report_to": [],
            "seed": 42,
            "fp16": torch.cuda.is_available(),
            "dataloader_num_workers": 0,
            "disable_tqdm": False,
        }
        try:
            training_args = TrainingArguments(eval_strategy="no", **base_args)
        except TypeError:
            training_args = TrainingArguments(evaluation_strategy="no", **base_args)

        trainer = Trainer(model=model, args=training_args, train_dataset=train_dataset)
        trainer.train()

        pred = trainer.predict(eval_dataset)
        logits = np.asarray(pred.predictions)
        logits = logits - logits.max(axis=1, keepdims=True)
        probs = np.exp(logits)
        probs = probs / probs.sum(axis=1, keepdims=True)
        preds = probs.argmax(axis=1)

        acc = accuracy_score(eval_labels, preds)
        try:
            loss = log_loss(eval_labels, np.clip(probs, 1e-9, 1.0))
        except Exception:
            loss = float("nan")

        output_dir.mkdir(parents=True, exist_ok=True)
        trainer.model.save_pretrained(str(output_dir))
        tokenizer.save_pretrained(str(output_dir))
        metrics = {
            "model": "email_distilbert_finetuned",
            "accuracy": float(acc),
            "loss": float(loss) if not math.isnan(float(loss)) else None,
            "base_model": model_name,
            "train_samples": len(train_texts),
            "eval_samples": len(eval_texts),
        }
        with open(model_dir / "email_distilbert_metrics.json", "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2)

        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(f"DistilBERT email model accuracy={acc:.4f}")
        return {"model": metrics["model"], "accuracy": float(acc), "loss": float(loss)}
    except Exception as exc:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(f"Skipping DistilBERT training (runtime failure): {exc}")
        return None


def train_url_models(urls_path: Path, model_dir: Path) -> pd.DataFrame:
    df = pd.read_csv(urls_path)
    X = pd.DataFrame(list(df["url"].apply(extract_url_features))).values
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    models = {
        "url_logistic_regression": LogisticRegression(max_iter=2000),
        "url_random_forest": RandomForestClassifier(n_estimators=220, random_state=42),
        "url_extra_trees": ExtraTreesClassifier(n_estimators=220, random_state=42),
        "url_gradient_boosting": GradientBoostingClassifier(random_state=42),
    }

    rows = []
    best = {"name": None, "acc": -1.0, "model": None}
    for name, model in models.items():
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        acc = accuracy_score(y_test, preds)
        loss = safe_log_loss(y_test, model, X_test)
        rows.append({"model": name, "accuracy": acc, "loss": loss})

        if acc > best["acc"]:
            best = {"name": name, "acc": acc, "model": model}

    joblib.dump(best["model"], model_dir / "url_model.joblib")
    print(f"Best URL model: {best['name']} | accuracy={best['acc']:.4f}")
    return pd.DataFrame(rows)


def train_email_models(emails_path: Path, model_dir: Path) -> pd.DataFrame:
    df = pd.read_csv(emails_path)
    texts = df["text"].fillna("").astype(str)
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        texts, y, test_size=0.2, random_state=42, stratify=y
    )

    distilbert_result = train_email_distilbert(X_train, X_test, y_train, y_test, model_dir)
    if distilbert_result is None:
        raise RuntimeError(
            "DistilBERT email model training failed. "
            "Install dependencies from backend/requirements.txt and re-run."
        )

    return pd.DataFrame([distilbert_result])


def train_ocr_text_model(emails_path: Path, model_dir: Path) -> dict:
    df = pd.read_csv(emails_path)
    texts = df["text"].fillna("").astype(str)
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        texts, y, test_size=0.2, random_state=42, stratify=y
    )

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=25000)
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    model = LogisticRegression(max_iter=2000)
    model.fit(X_train_vec, y_train)

    preds = model.predict(X_test_vec)
    acc = accuracy_score(y_test, preds)
    loss = log_loss(y_test, model.predict_proba(X_test_vec))

    joblib.dump(model, model_dir / "ocr_model.joblib")
    joblib.dump(vectorizer, model_dir / "ocr_vectorizer.joblib")
    print(f"OCR text model accuracy={acc:.4f}")
    return {"model": "ocr_logistic_regression", "accuracy": acc, "loss": loss}


def byte_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = np.bincount(np.frombuffer(data, dtype=np.uint8), minlength=256)
    probs = counts / len(data)
    probs = probs[probs > 0]
    return float(-(probs * np.log2(probs)).sum())


def generate_file_dataset(rows: int = 50000, seed: int = 42) -> pd.DataFrame:
    random.seed(seed)
    suspicious_ext = {".exe", ".js", ".vbs", ".bat", ".scr", ".ps1"}
    executable_mimes = {"application/x-dosexec", "application/x-msdownload"}

    candidates = [
        ("application/pdf", ".pdf"),
        ("text/plain", ".txt"),
        ("image/png", ".png"),
        ("application/zip", ".zip"),
        ("application/x-dosexec", ".exe"),
        ("application/javascript", ".js"),
    ]

    records = []
    for _ in range(rows):
        mime, ext = random.choice(candidates)
        size = random.randint(2_000, 14_000_000)
        entropy = random.uniform(2.0, 7.8)
        name_len = random.randint(6, 36)
        double_ext = random.random() < 0.08
        suspicious = int(ext in suspicious_ext)
        executable = int(mime in executable_mimes)

        risk = 0.0
        risk += 0.45 * suspicious
        risk += 0.35 * executable
        risk += 0.15 if size > 8_000_000 else 0.0
        risk += 0.10 if double_ext else 0.0
        risk += 0.10 if entropy > 6.8 else 0.0

        label = 1 if risk >= 0.55 else 0
        if random.random() < 0.02:
            label = 1 - label

        records.append(
            {
                "size": size,
                "entropy": entropy,
                "name_len": name_len,
                "suspicious_ext": suspicious,
                "exec_mime": executable,
                "double_ext": int(double_ext),
                "label": label,
            }
        )

    return pd.DataFrame(records)


def train_file_model(model_dir: Path, data_dir: Path) -> dict:
    df = generate_file_dataset(rows=50000)
    df.to_csv(data_dir / "files_ml.csv", index=False)

    X = df[["size", "entropy", "name_len", "suspicious_ext", "exec_mime", "double_ext"]].values
    y = df["label"].values
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(n_estimators=220, random_state=42)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)

    acc = accuracy_score(y_test, preds)
    loss = log_loss(y_test, probs)
    joblib.dump(model, model_dir / "file_model.joblib")
    print(f"File model accuracy={acc:.4f}")
    return {"model": "file_random_forest", "accuracy": acc, "loss": loss}


def save_histogram(df: pd.DataFrame, output_path: Path, title: str) -> None:
    plt.figure(figsize=(11, 5))
    colors = plt.cm.tab10(np.linspace(0, 1, max(1, len(df))))
    plt.bar(df["model"], df["accuracy"], color=colors)
    plt.ylim(max(0.0, float(df["accuracy"].min()) - 0.05), 1.0)
    plt.xticks(rotation=18, ha="right")
    plt.ylabel("Accuracy")
    plt.title(title)
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def main():
    data_dir = BASE_DIR / "data"
    model_dir = BASE_DIR / "models"
    data_dir.mkdir(parents=True, exist_ok=True)
    model_dir.mkdir(parents=True, exist_ok=True)

    urls_path = resolve_data_file(data_dir, "urls")
    emails_path = resolve_data_file(data_dir, "emails")

    if not urls_path.exists() or not emails_path.exists():
        raise FileNotFoundError("Dataset missing. Run scripts/generate_dataset.py first.")

    url_results = train_url_models(urls_path, model_dir)
    email_results = train_email_models(emails_path, model_dir)
    ocr_result = train_ocr_text_model(emails_path, model_dir)
    file_result = train_file_model(model_dir, data_dir)

    all_results = pd.concat([url_results, email_results], ignore_index=True)
    all_results.to_csv(model_dir / "model_benchmark.csv", index=False)

    save_histogram(
        url_results,
        model_dir / "url_model_accuracy_hist.png",
        f"URL Models Accuracy ({len(url_results)} Models)",
    )
    save_histogram(
        email_results,
        model_dir / "email_model_accuracy_hist.png",
        f"Email Models Accuracy ({len(email_results)} Models)",
    )

    aux_results = pd.DataFrame([ocr_result, file_result])
    aux_results.to_csv(model_dir / "aux_model_metrics.csv", index=False)

    print(f"\n=== Benchmark complete ({len(url_results)} URL + {len(email_results)} Email models) ===")
    for _, row in all_results.iterrows():
        loss_text = "nan" if math.isnan(float(row["loss"])) else f"{row['loss']:.4f}"
        print(f"{row['model']}: acc={row['accuracy']:.4f}, loss={loss_text}")

    print("\nAuxiliary models for image/file scans:")
    print(f"{ocr_result['model']}: acc={ocr_result['accuracy']:.4f}, loss={ocr_result['loss']:.4f}")
    print(f"{file_result['model']}: acc={file_result['accuracy']:.4f}, loss={file_result['loss']:.4f}")
    print("Saved plots in models folder.")


if __name__ == "__main__":
    main()
