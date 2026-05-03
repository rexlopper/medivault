import os

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "MediVault Attachment Service"
    postgres_user: str = os.getenv("POSTGRES_USER", "rexlopper")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "bryitkids")
    postgres_host: str = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    postgres_db: str = os.getenv("POSTGRES_DB", "medivault_records_admin")
    database_url: str | None = os.getenv("DATABASE_URL")
    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "medivault-attachments")
    minio_secure: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"

    def model_post_init(self, __context: object) -> None:
        if not self.database_url:
            self.database_url = (
                f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )


settings = Settings()
