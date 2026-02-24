import random
import string
from pathlib import Path

import joblib
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, log_loss
from sklearn.neural_network import MLPClassifier

BASE_DIR = Path(__file__).resolve().parents[1]

SAFE_DOMAINS = ["google.com", "microsoft.com", "amazon.com", "wikipedia.org", "openai.com", "github.com"]
PHISH_HOSTS = ["secure-login-paypal.com", "verify-account-bank.com", "login-facebook-security.net"]

SAFE_TEMPLATES = [
    "Thanks {name}, meeting on {day}.",
    "Order #{num} shipped. Track: {url}",
    "Welcome to {service}! Your account is ready.",
]

PHISH_TEMPLATES = [
    "URGENT: verify your password at {url}",
    "Account locked. Login now: {url}",
    "Security alert: confirm billing at {url}",
]

NAMES = ["Ava", "Noah", "Maya", "Arjun", "Deepa", "Ravi", "Sofia", "Ishan"]
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
SERVICES = ["Drive", "Bank", "Mail", "Pay"]


def random_string(n: int = 8) -> str:
    return "".join(random.choice(string.ascii_lowercase) for _ in range(n))


def make_safe_url() -> str:
    domain = random.choice(SAFE_DOMAINS)
    return f"https://{domain}/{random_string(6)}"


def make_phish_url() -> str:
    host = random.choice(PHISH_HOSTS)
    return f"http://{host}/login/{random_string(10)}?verify=true"


def make_safe_text() -> str:
    tmpl = random.choice(SAFE_TEMPLATES)
    return tmpl.format(
        name=random.choice(NAMES),
        day=random.choice(DAYS),
        num=random.randint(1000, 9999),
        url=make_safe_url(),
        service=random.choice(SERVICES),
    )


def make_phish_text() -> str:
    tmpl = random.choice(PHISH_TEMPLATES)
    return tmpl.format(url=make_phish_url())


def render_text_image(text: str, seed: int, size=(320, 160)) -> Image.Image:
    rnd = random.Random(seed)
    bg = (rnd.randint(10, 30), rnd.randint(10, 30), rnd.randint(18, 40))
    img = Image.new("RGB", size, bg)
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()

    # Add some noise lines
    for _ in range(rnd.randint(8, 14)):
        x1, y1 = rnd.randint(0, size[0]), rnd.randint(0, size[1])
        x2, y2 = rnd.randint(0, size[0]), rnd.randint(0, size[1])
        color = (rnd.randint(40, 90), rnd.randint(40, 90), rnd.randint(40, 90))
        draw.line((x1, y1, x2, y2), fill=color, width=1)

    # Wrap text manually
    max_chars = 44
    lines = []
    words = text.split()
    cur = []
    for w in words:
        if sum(len(x) for x in cur) + len(cur) + len(w) > max_chars:
            lines.append(" ".join(cur))
            cur = [w]
        else:
            cur.append(w)
    if cur:
        lines.append(" ".join(cur))
    lines = lines[:5]

    x, y = 12, 12
    for line in lines:
        draw.text((x, y), line, fill=(230, 236, 255), font=font)
        y += 22
    return img


def image_to_vec(img: Image.Image, size=(32, 32)) -> np.ndarray:
    gray = img.convert("L").resize(size)
    arr = np.asarray(gray, dtype=np.float32) / 255.0
    return arr.reshape(-1)


def main(samples: int = 6000, seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)

    X = []
    y = []
    for i in range(samples):
        is_phish = 1 if (i % 2 == 1) else 0
        text = make_phish_text() if is_phish else make_safe_text()
        img = render_text_image(text, seed=seed * 10_000 + i)
        X.append(image_to_vec(img))
        y.append(is_phish)

    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y, dtype=np.int64)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=seed, stratify=y
    )

    model = MLPClassifier(
        hidden_layer_sizes=(128, 64),
        activation="relu",
        solver="adam",
        alpha=1e-4,
        max_iter=40,
        random_state=seed,
        verbose=False,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)
    acc = accuracy_score(y_test, preds)
    loss = log_loss(y_test, probs)

    model_dir = BASE_DIR / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_dir / "image_model.joblib")

    metrics_path = model_dir / "image_model_metrics.csv"
    metrics_path.write_text("model,accuracy,loss\nimage_mlp,{:.6f},{:.6f}\n".format(acc, loss), encoding="utf-8")

    print(f"Image model saved: {model_dir / 'image_model.joblib'}")
    print(f"Image accuracy={acc:.4f}, loss={loss:.4f}")


if __name__ == "__main__":
    main()

