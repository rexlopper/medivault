import time

from fastapi import Depends, FastAPI, File, Form, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models, repositories, schemas
from app.database import engine, get_db
from app.storage import storage

app = FastAPI(title="MediVault Attachment Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    attempts = 0
    last_error: Exception | None = None
    while attempts < 10:
        try:
            storage.ensure_bucket()
            models.PendingAttachment.__table__.create(bind=engine, checkfirst=True)
            return
        except Exception as exc:
            last_error = exc
            attempts += 1
            time.sleep(2)
    if last_error is not None:
        raise last_error


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/attachments", response_model=list[schemas.AttachmentUploadResult], status_code=201)
async def create_attachment(
    patient_id: str = Form(...),
    encounter_id: str | None = Form(None),
    file_kind: str = Form(...),
    uploaded_by: str | None = Form(None),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> list[schemas.AttachmentUploadResult]:
    attachments = await repositories.create_attachments(
        db,
        patient_id=patient_id,
        encounter_id=encounter_id,
        file_kind=file_kind,
        uploaded_by=uploaded_by,
        uploads=files,
    )
    return [
        schemas.AttachmentUploadResult(
            attachment=attachment,
            download_url=f"/attachments/{attachment.id}/download",
        )
        for attachment in attachments
    ]


@app.post("/pending-attachments", response_model=schemas.PendingAttachmentUploadResult, status_code=201)
async def create_pending_attachment(
    file_kind: str = Form(...),
    uploaded_by: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> schemas.PendingAttachmentUploadResult:
    pending_attachment = await repositories.create_pending_attachment(
        db,
        file_kind=file_kind,
        uploaded_by=uploaded_by,
        upload=file,
    )
    return schemas.PendingAttachmentUploadResult(
        pending_attachment=pending_attachment,
        download_url=f"/pending-attachments/{pending_attachment.id}/download",
    )


@app.post("/attachments/commit", response_model=list[schemas.AttachmentUploadResult], status_code=201)
async def commit_pending_attachments(
    payload: schemas.AttachmentCommitRequest,
    db: Session = Depends(get_db),
) -> list[schemas.AttachmentUploadResult]:
    attachments = await repositories.commit_pending_attachments(
        db,
        patient_id=payload.patient_id,
        encounter_id=payload.encounter_id,
        pending_attachment_ids=payload.pending_attachment_ids,
    )
    return [
        schemas.AttachmentUploadResult(
            attachment=attachment,
            download_url=f"/attachments/{attachment.id}/download",
        )
        for attachment in attachments
    ]


@app.get("/attachments", response_model=list[schemas.AttachmentRead])
def list_all_attachments(db: Session = Depends(get_db)) -> list[schemas.AttachmentRead]:
    return repositories.list_all_attachments(db)


@app.get("/pending-attachments", response_model=list[schemas.PendingAttachmentRead])
def list_pending_attachments(db: Session = Depends(get_db)) -> list[schemas.PendingAttachmentRead]:
    return repositories.list_pending_attachments(db)


@app.get("/attachments/{attachment_id}", response_model=schemas.AttachmentRead)
def get_attachment(attachment_id: str, db: Session = Depends(get_db)) -> schemas.AttachmentRead:
    return repositories.get_attachment(db, attachment_id)


@app.get("/pending-attachments/{pending_attachment_id}", response_model=schemas.PendingAttachmentRead)
def get_pending_attachment(
    pending_attachment_id: str,
    db: Session = Depends(get_db),
) -> schemas.PendingAttachmentRead:
    return repositories.get_pending_attachment(db, pending_attachment_id)


@app.get("/patients/{patient_id}/attachments", response_model=list[schemas.AttachmentRead])
def list_patient_attachments(patient_id: str, db: Session = Depends(get_db)) -> list[schemas.AttachmentRead]:
    return repositories.list_patient_attachments(db, patient_id)


@app.get("/encounters/{encounter_id}/attachments", response_model=list[schemas.AttachmentRead])
def list_encounter_attachments(encounter_id: str, db: Session = Depends(get_db)) -> list[schemas.AttachmentRead]:
    return repositories.list_encounter_attachments(db, encounter_id)


@app.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: str, db: Session = Depends(get_db)) -> StreamingResponse:
    attachment = repositories.get_attachment(db, attachment_id)
    object_response = storage.get_object(attachment.storage_key)
    headers = {}
    if attachment.original_filename:
        headers["Content-Disposition"] = f'inline; filename="{attachment.original_filename}"'
    return StreamingResponse(
        object_response.stream(32 * 1024),
        media_type=attachment.mime_type or "application/octet-stream",
        headers=headers,
    )


@app.get("/pending-attachments/{pending_attachment_id}/download")
def download_pending_attachment(
    pending_attachment_id: str,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    pending_attachment = repositories.get_pending_attachment(db, pending_attachment_id)
    object_response = storage.get_object(pending_attachment.storage_key)
    headers = {}
    if pending_attachment.original_filename:
        headers["Content-Disposition"] = f'inline; filename="{pending_attachment.original_filename}"'
    return StreamingResponse(
        object_response.stream(32 * 1024),
        media_type=pending_attachment.mime_type or "application/octet-stream",
        headers=headers,
    )


@app.delete("/pending-attachments/{pending_attachment_id}", status_code=204)
def delete_pending_attachment(pending_attachment_id: str, db: Session = Depends(get_db)) -> Response:
    repositories.delete_pending_attachment(db, pending_attachment_id)
    return Response(status_code=204)
