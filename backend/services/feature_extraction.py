import re
from urllib.parse import urlparse

SUSPICIOUS_KEYWORDS = {
    "login",
    "verify",
    "secure",
    "security",
    "update",
    "password",
    "bank",
    "account",
    "confirm",
    "billing",
    "free",
    "prize",
    "bonus",
}

BRAND_LOOKALIKE_RULES = [
    ("paypal", re.compile(r"(^|\.)paypal\.com$", re.IGNORECASE)),
    ("facebook", re.compile(r"(^|\.)facebook\.com$", re.IGNORECASE)),
]


def extract_url_features(url: str) -> dict:
    parsed = urlparse(url if url.startswith("http") else f"http://{url}")
    host = parsed.netloc
    path = parsed.path

    digits = sum(c.isdigit() for c in url)
    dots = url.count(".")
    hyphens = url.count("-")
    length = len(url)
    has_ip = bool(re.search(r"\b(\d{1,3}\.){3}\d{1,3}\b", host))
    suspicious = sum(1 for k in SUSPICIOUS_KEYWORDS if k in url.lower())

    return {
        "length": length,
        "digits": digits,
        "dots": dots,
        "hyphens": hyphens,
        "has_ip": int(has_ip),
        "https": int(parsed.scheme == "https"),
        "suspicious_kw": suspicious,
        "path_len": len(path),
        "host_len": len(host),
    }


def score_url_rule_based(url: str) -> tuple[str, float, list]:
    features = extract_url_features(url)
    parsed = urlparse(url if url.startswith("http") else f"http://{url}")
    host = (parsed.netloc or "").lower()
    score = 0.0
    reasons = []

    if features["has_ip"]:
        score += 0.3
        reasons.append("IP address used in host")
    if features["length"] > 75:
        score += 0.2
        reasons.append("Unusually long URL")
    if features["suspicious_kw"] > 0:
        # Multiple suspicious keywords in URL/host is a strong phishing signal.
        kw_score = min(0.45, 0.15 * float(features["suspicious_kw"]))
        score += kw_score
        reasons.append(f"Suspicious keywords found ({features['suspicious_kw']})")
    if features["dots"] >= 4:
        score += 0.1
        reasons.append("Many subdomains")
    if features["hyphens"] >= 1:
        score += 0.1
        reasons.append("Hyphens in URL (lookalike pattern)")

    for token, allow in BRAND_LOOKALIKE_RULES:
        if token in host and not allow.search(host):
            score += 0.55
            reasons.append(f"Brand lookalike ({token})")
    if not features["https"]:
        score += 0.1
        reasons.append("No HTTPS")

    label = "phishing" if score >= 0.5 else "legitimate"
    return label, min(score, 0.99), reasons
