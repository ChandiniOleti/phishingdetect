import os
from dataclasses import dataclass


@dataclass
class Settings:
    mongo_uri: str
    mongo_db: str
    model_dir: str
    data_dir: str
    environment: str
    secret_key: str


def load_settings() -> Settings:
    # Default to backend-local folders so running from repo root still finds trained artifacts.
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return Settings(
        mongo_uri=os.getenv("MONGO_URI", "mongodb://localhost:27017"),
        mongo_db=os.getenv("MONGO_DB", "phishguard"),
        model_dir=os.getenv("MODEL_DIR", os.path.join(base_dir, "models")),
        data_dir=os.getenv("DATA_DIR", os.path.join(base_dir, "data")),
        environment=os.getenv("ENV", "dev"),
        secret_key=os.getenv("SECRET_KEY", "dev-secret-change-me"),
    )
