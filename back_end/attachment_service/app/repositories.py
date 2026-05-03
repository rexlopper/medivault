import io

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.storage import storage


def get_patient(db: Session, patient_id: str) -> models.Patient:
    patient = db.get(models.Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def get_encounter(db: Session, encounter_id: str) -> models.Encounter:
    encounter = db.get(models.Encounter, encounter_id)
    if encounter is None:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter


def get_attachment(db: Session, attachment_id: str) -> models.Attachment:
    attachment = db.get(models.Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return attachment


def get_pending_attachment(db: Session, pending_attachment_id: str) -> models.PendingAttachment:
    pending_attachment = db.get(models.PendingAttachment, pending_attachment_id)
    if pending_attachment is None:
        raise HTTPException(status_code=404, detail="Pending attachment not found")
    return pending_attachment


def list_patient_attachments(db: Session, patient_id: str) -> list[models.Attachment]:
    get_patient(db, patient_id)
    statement = (
        select(models.Attachment)
        .where(models.Attachment.patient_id == patient_id)
        .order_by(models.Attachment.created_at.desc())
    )
    return list(db.execute(statement).scalars())


def list_all_attachments(db: Session) -> list[models.Attachment]:
    statement = select(models.Attachment).order_by(models.Attachment.created_at.desc())
    return list(db.execute(statement).scalars())


def list_pending_attachments(db: Session) -> list[models.PendingAttachment]:
    statement = select(models.PendingAttachment).order_by(models.PendingAttachment.created_at.desc())
    return list(db.execute(statement).scalars())


def list_encounter_attachments(db: Session, encounter_id: str) -> list[models.Attachment]:
    get_encounter(db, encounter_id)
    statement = (
        select(models.Attachment)
        .where(models.Attachment.encounter_id == encounter_id)
        .order_by(models.Attachment.created_at.desc())
    )
    return list(db.execute(statement).scalars())


async def create_attachment(
    db: Session,
    *,
    patient_id: str,
    encounter_id: str | None,
    file_kind: str,
    uploaded_by: str | None,
    upload: UploadFile,
) -> models.Attachment:
    get_patient(db, patient_id)
    if encounter_id:
        get_encounter(db, encounter_id)

    body = await upload.read()
    if not body:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    storage_key = storage.build_storage_key(
        patient_id=patient_id,
        encounter_id=encounter_id,
        filename=upload.filename or "upload.bin",
    )

    try:
        storage.put_object(
            storage_key=storage_key,
            file_stream=io.BytesIO(body),
            file_size=len(body),
            content_type=upload.content_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Object storage upload failed: {exc}") from exc

    attachment = models.Attachment(
        patient_id=patient_id,
        encounter_id=encounter_id,
        file_kind=file_kind,
        storage_key=storage_key,
        original_filename=upload.filename,
        mime_type=upload.content_type,
        uploaded_by=uploaded_by,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


async def create_pending_attachment(
    db: Session,
    *,
    file_kind: str,
    uploaded_by: str | None,
    upload: UploadFile,
) -> models.PendingAttachment:
    body = await upload.read()
    if not body:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    storage_key = storage.build_pending_storage_key(filename=upload.filename or "upload.bin")

    try:
        storage.put_object(
            storage_key=storage_key,
            file_stream=io.BytesIO(body),
            file_size=len(body),
            content_type=upload.content_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Object storage upload failed: {exc}") from exc

    pending_attachment = models.PendingAttachment(
        file_kind=file_kind,
        storage_key=storage_key,
        original_filename=upload.filename,
        mime_type=upload.content_type,
        uploaded_by=uploaded_by,
    )
    db.add(pending_attachment)
    db.commit()
    db.refresh(pending_attachment)
    return pending_attachment


def delete_pending_attachment(db: Session, pending_attachment_id: str) -> None:
    pending_attachment = get_pending_attachment(db, pending_attachment_id)
    storage.remove_object(pending_attachment.storage_key)
    db.delete(pending_attachment)
    db.commit()


async def commit_pending_attachments(
    db: Session,
    *,
    patient_id: str,
    encounter_id: str | None,
    pending_attachment_ids: list[str],
) -> list[models.Attachment]:
    if not pending_attachment_ids:
        return []

    get_patient(db, patient_id)
    if encounter_id:
        encounter = get_encounter(db, encounter_id)
        if encounter.patient_id != patient_id:
            raise HTTPException(status_code=400, detail="Encounter does not belong to patient")

    attachments: list[models.Attachment] = []
    pending_attachments = [get_pending_attachment(db, pending_id) for pending_id in pending_attachment_ids]

    for pending_attachment in pending_attachments:
        final_storage_key = storage.build_storage_key(
            patient_id=patient_id,
            encounter_id=encounter_id,
            filename=pending_attachment.original_filename or "upload.bin",
        )

        object_response = storage.get_object(pending_attachment.storage_key)
        try:
            body = object_response.read()
        finally:
            object_response.close()
            object_response.release_conn()

        storage.put_object(
            storage_key=final_storage_key,
            file_stream=io.BytesIO(body),
            file_size=len(body),
            content_type=pending_attachment.mime_type,
        )

        attachment = models.Attachment(
            patient_id=patient_id,
            encounter_id=encounter_id,
            file_kind=pending_attachment.file_kind,
            storage_key=final_storage_key,
            original_filename=pending_attachment.original_filename,
            mime_type=pending_attachment.mime_type,
            uploaded_by=pending_attachment.uploaded_by,
        )
        db.add(attachment)
        attachments.append(attachment)

        storage.remove_object(pending_attachment.storage_key)
        db.delete(pending_attachment)

    db.commit()
    for attachment in attachments:
        db.refresh(attachment)
    return attachments


async def create_attachments(
    db: Session,
    *,
    patient_id: str,
    encounter_id: str | None,
    file_kind: str,
    uploaded_by: str | None,
    uploads: list[UploadFile],
) -> list[models.Attachment]:
    attachments: list[models.Attachment] = []
    for upload in uploads:
        attachment = await create_attachment(
            db,
            patient_id=patient_id,
            encounter_id=encounter_id,
            file_kind=file_kind,
            uploaded_by=uploaded_by,
            upload=upload,
        )
        attachments.append(attachment)
    return attachments
