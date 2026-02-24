from __future__ import annotations

from io import BytesIO

import numpy as np
from PIL import Image


def image_bytes_to_vector(file_bytes: bytes, size: tuple[int, int] = (32, 32)) -> np.ndarray:
    """
    Convert raw image bytes into a normalized grayscale vector suitable for lightweight ML models.
    Shape: (1, size[0] * size[1])
    """
    image = Image.open(BytesIO(file_bytes)).convert("L").resize(size)
    arr = np.asarray(image, dtype=np.float32) / 255.0
    return arr.reshape(1, -1)

