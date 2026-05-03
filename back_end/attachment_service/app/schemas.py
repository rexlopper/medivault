from datetime import datetime

from pydantic import BaseModel


class AttachmentRead(BaseModel):
    id: str
    patient_id: str
    encounter_id: str | None = None
    file_kind: str
    storage_key: str
    original_filename: str | None = None
    mime_type: str | None = None
    uploaded_by: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AttachmentUploadResult(BaseModel):
    attachment: AttachmentRead
    download_url: str


class PendingAttachmentRead(BaseModel):
    id: str
    file_kind: str
    storage_key: str
    original_filename: str | None = None
    mime_type: str | None = None
    uploaded_by: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PendingAttachmentUploadResult(BaseModel):
    pending_attachment: PendingAttachmentRead
    download_url: str


class AttachmentCommitRequest(BaseModel):
    patient_id: str
    encounter_id: str | None = None
    pending_attachment_ids: list[str]
