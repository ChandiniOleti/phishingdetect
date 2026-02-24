import os
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from werkzeug.security import generate_password_hash, check_password_hash


class ScanRepository:
    def __init__(self, mongo_uri: str, db_name: str):
        self._client = None
        self._db = None
        self._collection = None
        try:
            self._client = MongoClient(mongo_uri, serverSelectionTimeoutMS=1500)
            self._client.admin.command("ping")
            self._db = self._client[db_name]
            self._collection = self._db.scans
        except PyMongoError:
            self._client = None

    @property
    def enabled(self) -> bool:
        return self._collection is not None

    def insert_scan(self, scan: dict) -> dict:
        if self._collection is None:
            return scan
        scan["created_at"] = datetime.utcnow()
        result = self._collection.insert_one(scan)
        scan["_id"] = str(result.inserted_id)
        return scan

    def list_scans(self, limit: int = 50) -> list:
        if self._collection is None:
            return []
        items = self._collection.find().sort("created_at", -1).limit(limit)
        return [self._serialize(item) for item in items]

    def list_scans_by_email(self, email: str, limit: int = 50) -> list:
        if self._collection is None:
            return []
        items = (
            self._collection.find({"user.email": email})
            .sort("created_at", -1)
            .limit(limit)
        )
        return [self._serialize(item) for item in items]

    def get_scan(self, scan_id: str) -> dict | None:
        if self._collection is None:
            return None
        from bson import ObjectId

        item = self._collection.find_one({"_id": ObjectId(scan_id)})
        return self._serialize(item) if item else None

    @staticmethod
    def _serialize(item: dict) -> dict:
        if not item:
            return {}
        item["_id"] = str(item.get("_id"))
        if "created_at" in item and item["created_at"]:
            item["created_at"] = item["created_at"].isoformat() + "Z"
        return item


class UserRepository:
    def __init__(self, mongo_uri: str, db_name: str):
        self._client = None
        self._db = None
        self._collection = None
        try:
            self._client = MongoClient(mongo_uri, serverSelectionTimeoutMS=1500)
            self._client.admin.command("ping")
            self._db = self._client[db_name]
            self._collection = self._db.users
            self._ensure_admin()
        except PyMongoError:
            self._client = None

    @property
    def enabled(self) -> bool:
        return self._collection is not None

    def _ensure_admin(self) -> None:
        if self._collection is None:
            return
        if self._collection.count_documents({}) == 0:
            self.create_user("admin@phishguard.ai", "Admin123!", "admin")

    def create_user(self, email: str, password: str, role: str) -> dict:
        if self._collection is None:
            return {}
        doc = {
            "email": email.lower(),
            "password_hash": generate_password_hash(password),
            "role": role,
            "created_at": datetime.utcnow(),
        }
        self._collection.insert_one(doc)
        return self._serialize(doc)

    def find_by_email(self, email: str) -> dict | None:
        if self._collection is None:
            return None
        item = self._collection.find_one({"email": email.lower()})
        return self._serialize(item) if item else None

    def verify_password(self, email: str, password: str) -> dict | None:
        if self._collection is None:
            return None
        item = self._collection.find_one({"email": email.lower()})
        if not item:
            return None
        if not check_password_hash(item.get("password_hash", ""), password):
            return None
        return self._serialize(item)

    @staticmethod
    def _serialize(item: dict) -> dict:
        if not item:
            return {}
        item["_id"] = str(item.get("_id"))
        item.pop("password_hash", None)
        if "created_at" in item and item["created_at"]:
            item["created_at"] = item["created_at"].isoformat() + "Z"
        return item
