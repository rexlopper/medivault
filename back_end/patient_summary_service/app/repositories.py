from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas


def get_patient(db: Session, patient_id: str) -> models.Patient:
    patient = db.get(models.Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def get_latest_summary(db: Session, patient_id: str) -> models.PatientSummary | None:
    statement = (
        select(models.PatientSummary)
        .where(models.PatientSummary.patient_id == patient_id)
        .order_by(models.PatientSummary.summary_version.desc())
        .limit(1)
    )
    return db.execute(statement).scalar_one_or_none()


def list_summaries(db: Session, patient_id: str) -> list[models.PatientSummary]:
    get_patient(db, patient_id)
    statement = (
        select(models.PatientSummary)
        .where(models.PatientSummary.patient_id == patient_id)
        .order_by(models.PatientSummary.summary_version.desc())
    )
    return list(db.execute(statement).scalars())


def build_summary_bundle(db: Session, patient_id: str) -> schemas.PatientSummaryBundle:
    patient = get_patient(db, patient_id)
    history = list_summaries(db, patient_id)
    latest_summary = history[0] if history else None
    return schemas.PatientSummaryBundle(
        patient=patient,
        latest_summary=latest_summary,
        history=history,
    )


def upsert_summary(
    db: Session,
    patient_id: str,
    payload: schemas.PatientSummaryUpsert,
) -> models.PatientSummary:
    get_patient(db, patient_id)
    max_version = db.execute(
        select(func.max(models.PatientSummary.summary_version)).where(models.PatientSummary.patient_id == patient_id)
    ).scalar_one()
    next_version = 1 if max_version is None else max_version + 1
    summary = models.PatientSummary(
        patient_id=patient_id,
        summary_version=next_version,
        allergies=payload.allergies,
        active_medications=payload.active_medications,
        chronic_conditions=payload.chronic_conditions,
        past_procedures=payload.past_procedures,
        last_known_vitals=payload.last_known_vitals,
        summary_text=payload.summary_text,
        source=payload.source,
        updated_by=payload.updated_by,
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary
