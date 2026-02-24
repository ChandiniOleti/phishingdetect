from io import BytesIO
from PIL import Image

try:
    import pytesseract
except Exception:
    pytesseract = None


def extract_text_from_image(file_bytes: bytes, timeout_s: float = 5.0, max_dim: int = 1600) -> str:
    if not pytesseract:
        return ""
    image = Image.open(BytesIO(file_bytes)).convert("RGB")

    # Downscale large images to reduce OCR latency.
    try:
        w, h = image.size
        m = max(w, h)
        if m > max_dim and m > 0:
            scale = max_dim / float(m)
            image = image.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    except Exception:
        pass

    try:
        return pytesseract.image_to_string(image, timeout=timeout_s)
    except Exception:
        # Includes timeout, missing tesseract binary, image decode errors, etc.
        return ""
