from datetime import datetime
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from app.config import settings


class MinioStorage:
    def __init__(self) -> None:
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self.bucket_name = settings.minio_bucket

    def ensure_bucket(self) -> None:
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)

    def build_storage_key(self, *, patient_id: str, encounter_id: str | None, filename: str) -> str:
        safe_name = Path(filename).name.replace(" ", "_")
        stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")
        encounter_part = encounter_id or "unlinked"
        return f"patients/{patient_id}/encounters/{encounter_part}/{stamp}_{safe_name}"

    def build_pending_storage_key(self, *, filename: str) -> str:
        safe_name = Path(filename).name.replace(" ", "_")
        stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")
        return f"pending/{stamp}_{safe_name}"

    def put_object(self, *, storage_key: str, file_stream, file_size: int, content_type: str | None) -> None:
        self.client.put_object(
            self.bucket_name,
            storage_key,
            file_stream,
            length=file_size,
            content_type=content_type or "application/octet-stream",
        )

    def get_object(self, storage_key: str):
        return self.client.get_object(self.bucket_name, storage_key)

    def remove_object(self, storage_key: str) -> None:
        try:
            self.client.remove_object(self.bucket_name, storage_key)
        except S3Error:
            return


storage = MinioStorage()
