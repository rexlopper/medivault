from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, rules, schemas


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


def get_consult_session(db: Session, consult_session_id: str) -> models.ConsultSession:
    consult_session = db.get(models.ConsultSession, consult_session_id)
    if consult_session is None:
        raise HTTPException(status_code=404, detail="Consult session not found")
    return consult_session


def list_consult_sessions(
    db: Session,
    *,
    patient_id: str | None = None,
    clinician_id: str | None = None,
    status: str | None = None,
) -> list[models.ConsultSession]:
    statement = select(models.ConsultSession).order_by(models.ConsultSession.created_at.desc())
    if patient_id:
        statement = statement.where(models.ConsultSession.patient_id == patient_id)
    if clinician_id:
        statement = statement.where(models.ConsultSession.clinician_id == clinician_id)
    if status:
        statement = statement.where(models.ConsultSession.status == status)
    return list(db.execute(statement).scalars())


def get_latest_encounter_consult_session(db: Session, encounter_id: str) -> models.ConsultSession | None:
    get_encounter(db, encounter_id)
    statement = (
        select(models.ConsultSession)
        .where(models.ConsultSession.encounter_id == encounter_id)
        .order_by(models.ConsultSession.created_at.desc())
        .limit(1)
    )
    return db.execute(statement).scalar_one_or_none()


def create_consult_session(
    db: Session,
    payload: schemas.ConsultSessionCreate,
) -> models.ConsultSession:
    get_patient(db, payload.patient_id)

    encounter = None
    if payload.encounter_id:
        encounter = get_encounter(db, payload.encounter_id)
        if encounter.patient_id != payload.patient_id:
            raise HTTPException(status_code=400, detail="Encounter does not belong to patient")
        existing = get_latest_encounter_consult_session(db, payload.encounter_id)
        if existing is not None:
            raise HTTPException(status_code=409, detail="Consult session already exists for encounter")

    consult_session = models.ConsultSession(
        patient_id=payload.patient_id,
        encounter_id=payload.encounter_id,
        organization_id=payload.organization_id or (encounter.organization_id if encounter else None),
        clinician_id=payload.clinician_id or (encounter.clinician_id if encounter else None),
        source=payload.source,
        chief_complaint=payload.chief_complaint or (encounter.chief_complaint if encounter else None),
        created_by=payload.created_by,
        status="created",
    )
    db.add(consult_session)
    db.flush()

    created_event = models.ConsultSessionEvent(
        consult_session_id=consult_session.id,
        event_type="consult.created",
        from_status=None,
        to_status="created",
        actor_id=payload.created_by,
        payload={},
    )
    db.add(created_event)
    db.commit()
    db.refresh(consult_session)
    return consult_session


def add_consult_event(
    db: Session,
    consult_session_id: str,
    payload: schemas.ConsultSessionEventCreate,
) -> models.ConsultSession:
    consult_session = get_consult_session(db, consult_session_id)
    from_status, to_status = rules.apply_event(consult_session, payload.event_type)
    event = models.ConsultSessionEvent(
        consult_session_id=consult_session.id,
        event_type=payload.event_type,
        from_status=from_status,
        to_status=to_status,
        actor_id=payload.actor_id,
        payload=payload.payload,
    )
    db.add(event)
    db.commit()
    db.refresh(consult_session)
    return consult_session


def build_consult_detail(db: Session, consult_session_id: str) -> models.ConsultSession:
    consult_session = get_consult_session(db, consult_session_id)
    consult_session.events.sort(key=lambda event: event.created_at)
    return consult_session
