from __future__ import annotations

from datetime import datetime, timedelta
import re

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import auth, models, rules, schemas


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "organization"


def _next_available_organization_slug(db: Session, name: str) -> str:
    base_slug = _slugify(name)
    slug = base_slug
    suffix = 2
    while db.execute(select(models.Organization).where(models.Organization.slug == slug)).scalar_one_or_none() is not None:
        slug = f"{base_slug}-{suffix}"
        suffix += 1
    return slug


def _get_or_create_organization_by_name(
    db: Session,
    *,
    name: str,
    organization_type: str,
) -> models.Organization:
    statement = select(models.Organization).where(func.lower(models.Organization.name) == name.strip().lower())
    organization = db.execute(statement).scalar_one_or_none()
    if organization is not None:
        return organization

    organization = models.Organization(
        slug=_next_available_organization_slug(db, name),
        name=name.strip(),
        organization_type=organization_type,
        status="active",
    )
    db.add(organization)
    db.flush()
    return organization


def _create_event(
    db: Session,
    *,
    event_type: str,
    patient_id: str | None = None,
    encounter_id: str | None = None,
    note_id: str | None = None,
    actor_id: str | None = None,
    payload: str | None = None,
) -> models.RecordEvent:
    event = models.RecordEvent(
        patient_id=patient_id,
        encounter_id=encounter_id,
        note_id=note_id,
        event_type=event_type,
        actor_id=actor_id,
        payload=payload,
    )
    db.add(event)
    return event


def _build_auth_session_read(session: models.AuthSession) -> schemas.AuthSessionRead:
    user = session.user_account
    doctor = user.doctor_profile if user else None
    patient = user.patient_profile if user else None
    return schemas.AuthSessionRead(
        token=session.token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        patient_id=patient.id if patient else None,
        doctor_id=doctor.id if doctor else None,
        organization_id=doctor.organization_id if doctor else None,
        expires_at=session.expires_at,
    )


def create_organization(db: Session, payload: schemas.OrganizationCreate) -> models.Organization:
    organization = models.Organization(**payload.model_dump())
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def list_organizations(db: Session) -> list[models.Organization]:
    statement = select(models.Organization).order_by(models.Organization.name.asc())
    return list(db.execute(statement).scalars())


def get_organization(db: Session, organization_id: str) -> models.Organization:
    organization = db.get(models.Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return organization


def create_user_account(db: Session, payload: schemas.UserAccountCreate) -> models.UserAccount:
    values = payload.model_dump(exclude={"password"})
    values["password_hash"] = auth.hash_password(payload.password) if payload.password else None
    user_account = models.UserAccount(**values)
    db.add(user_account)
    db.commit()
    db.refresh(user_account)
    return user_account


def list_user_accounts(db: Session, role: str | None = None) -> list[models.UserAccount]:
    statement = select(models.UserAccount).order_by(models.UserAccount.created_at.desc())
    if role:
        statement = statement.where(models.UserAccount.role == role)
    return list(db.execute(statement).scalars())


def get_user_account(db: Session, user_id: str) -> models.UserAccount:
    user_account = db.get(models.UserAccount, user_id)
    if user_account is None:
        raise HTTPException(status_code=404, detail="User account not found")
    return user_account


def get_user_account_by_email(db: Session, email: str) -> models.UserAccount | None:
    statement = select(models.UserAccount).where(models.UserAccount.email == email)
    return db.execute(statement).scalar_one_or_none()


def create_doctor(db: Session, payload: schemas.DoctorCreate) -> models.Doctor:
    get_user_account(db, payload.user_id)
    if payload.organization_id:
        get_organization(db, payload.organization_id)

    doctor = models.Doctor(**payload.model_dump())
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


def list_doctors(db: Session, organization_id: str | None = None) -> list[models.Doctor]:
    statement = select(models.Doctor).order_by(models.Doctor.full_name.asc())
    if organization_id:
        statement = statement.where(models.Doctor.organization_id == organization_id)
    return list(db.execute(statement).scalars())


def get_doctor(db: Session, doctor_id: str) -> models.Doctor:
    doctor = db.get(models.Doctor, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


def register_patient_user(db: Session, payload: schemas.PatientRegistrationRequest) -> schemas.AuthSessionRead:
    if get_user_account_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    full_name = f"{payload.given_name} {payload.family_name}".strip()
    user_account = models.UserAccount(
        email=payload.email,
        full_name=full_name,
        role="patient",
        status="active",
        password_hash=auth.hash_password(payload.password),
    )
    db.add(user_account)
    db.flush()

    patient = models.Patient(
        user_id=user_account.id,
        given_name=payload.given_name,
        middle_name=payload.middle_name,
        family_name=payload.family_name,
        birth_date=payload.birth_date,
        sex_at_birth=payload.sex_at_birth,
        mobile_number=payload.mobile_number,
    )
    db.add(patient)
    db.flush()

    _create_event(
        db,
        event_type="patient.created",
        patient_id=patient.id,
        actor_id=user_account.id,
        payload=patient.id,
    )

    session = models.AuthSession(
        user_id=user_account.id,
        token=auth.generate_session_token(),
        role_snapshot=user_account.role,
        expires_at=datetime.utcnow().replace(microsecond=0) + timedelta(days=30),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _build_auth_session_read(session)


def register_doctor_user(db: Session, payload: schemas.DoctorRegistrationRequest) -> schemas.AuthSessionRead:
    if get_user_account_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    organization = _get_or_create_organization_by_name(
        db,
        name=payload.organization_name,
        organization_type=payload.organization_type,
    )

    user_account = models.UserAccount(
        email=payload.email,
        full_name=payload.full_name,
        role="doctor",
        status="active",
        password_hash=auth.hash_password(payload.password),
    )
    db.add(user_account)
    db.flush()

    doctor = models.Doctor(
        user_id=user_account.id,
        organization_id=organization.id,
        doctor_code=payload.doctor_code,
        full_name=payload.full_name,
        specialty=payload.specialty,
        license_number=payload.license_number,
        status="active",
    )
    db.add(doctor)
    db.flush()

    session = models.AuthSession(
        user_id=user_account.id,
        token=auth.generate_session_token(),
        role_snapshot=user_account.role,
        expires_at=datetime.utcnow().replace(microsecond=0) + timedelta(days=30),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _build_auth_session_read(session)


def login_user(db: Session, payload: schemas.AuthLoginRequest) -> schemas.AuthSessionRead:
    statement = (
        select(models.UserAccount)
        .options(
            selectinload(models.UserAccount.doctor_profile),
            selectinload(models.UserAccount.patient_profile),
        )
        .where(models.UserAccount.email == payload.email)
    )
    user_account = db.execute(statement).scalar_one_or_none()
    if user_account is None or not auth.verify_password(payload.password, user_account.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session = models.AuthSession(
        user_id=user_account.id,
        token=auth.generate_session_token(),
        role_snapshot=user_account.role,
        expires_at=datetime.utcnow().replace(microsecond=0) + timedelta(days=30),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _build_auth_session_read(session)


def get_auth_session(db: Session, token: str) -> schemas.AuthSessionRead:
    statement = (
        select(models.AuthSession)
        .options(
            selectinload(models.AuthSession.user_account).selectinload(models.UserAccount.doctor_profile),
            selectinload(models.AuthSession.user_account).selectinload(models.UserAccount.patient_profile),
        )
        .where(models.AuthSession.token == token)
    )
    session = db.execute(statement).scalar_one_or_none()
    if session is None or session.revoked_at is not None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired")
    return _build_auth_session_read(session)


def create_patient(db: Session, payload: schemas.PatientCreate) -> models.Patient:
    patient = models.Patient(**payload.model_dump())
    db.add(patient)
    db.flush()
    _create_event(
        db,
        event_type="patient.created",
        patient_id=patient.id,
        payload=patient.id,
    )
    db.commit()
    db.refresh(patient)
    return patient


def get_patient(db: Session, patient_id: str) -> models.Patient:
    patient = db.get(models.Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def update_patient(db: Session, patient_id: str, payload: schemas.PatientUpdate) -> models.Patient:
    patient = get_patient(db, patient_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(patient, field, value)
    _create_event(
        db,
        event_type="patient.updated",
        patient_id=patient.id,
        payload=str(updates),
    )
    db.commit()
    db.refresh(patient)
    return patient


def create_encounter(db: Session, payload: schemas.EncounterCreate) -> models.Encounter:
    get_patient(db, payload.patient_id)
    encounter = models.Encounter(
        patient_id=payload.patient_id,
        organization_id=payload.organization_id,
        clinician_id=payload.clinician_id,
        encounter_type=payload.encounter_type,
        source=payload.source,
        chief_complaint=payload.chief_complaint,
        started_at=payload.started_at,
        status="scheduled" if payload.started_at is None else "in_progress",
    )
    db.add(encounter)
    db.flush()
    _create_event(
        db,
        event_type="encounter.created",
        patient_id=encounter.patient_id,
        encounter_id=encounter.id,
        actor_id=encounter.clinician_id,
        payload=encounter.status,
    )
    db.commit()
    db.refresh(encounter)
    return encounter


def get_encounter(db: Session, encounter_id: str) -> models.Encounter:
    statement = (
        select(models.Encounter)
        .options(
            selectinload(models.Encounter.notes),
            selectinload(models.Encounter.diagnoses),
            selectinload(models.Encounter.prescriptions),
            selectinload(models.Encounter.events),
        )
        .where(models.Encounter.id == encounter_id)
    )
    encounter = db.execute(statement).scalar_one_or_none()
    if encounter is None:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter


def update_encounter_status(
    db: Session,
    encounter_id: str,
    payload: schemas.EncounterStatusUpdate,
) -> models.Encounter:
    encounter = get_encounter(db, encounter_id)
    try:
        rules.ensure_valid_encounter_status(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    encounter.status = payload.status
    if payload.ended_at is not None:
        encounter.ended_at = payload.ended_at
    _create_event(
        db,
        event_type="encounter.status_updated",
        patient_id=encounter.patient_id,
        encounter_id=encounter.id,
        actor_id=encounter.clinician_id,
        payload=encounter.status,
    )
    db.commit()
    db.refresh(encounter)
    return encounter


def list_patient_encounters(db: Session, patient_id: str) -> list[models.Encounter]:
    get_patient(db, patient_id)
    statement = select(models.Encounter).where(models.Encounter.patient_id == patient_id).order_by(models.Encounter.created_at.desc())
    return list(db.execute(statement).scalars())


def create_note(db: Session, encounter_id: str, payload: schemas.NoteCreate) -> models.Note:
    encounter = get_encounter(db, encounter_id)
    max_version = db.execute(
        select(func.max(models.Note.version)).where(models.Note.encounter_id == encounter_id)
    ).scalar_one()
    next_version = 1 if max_version is None else max_version + 1
    note = models.Note(
        encounter_id=encounter.id,
        version=next_version,
        note_type=payload.note_type,
        source=payload.source,
        subjective=payload.subjective,
        objective=payload.objective,
        assessment=payload.assessment,
        plan=payload.plan,
        authored_by=payload.authored_by,
    )
    db.add(note)
    db.flush()
    _create_event(
        db,
        event_type="note.created",
        patient_id=encounter.patient_id,
        encounter_id=encounter.id,
        note_id=note.id,
        actor_id=payload.authored_by,
        payload=note.status,
    )
    db.commit()
    db.refresh(note)
    return note


def replace_encounter_diagnoses(
    db: Session,
    encounter_id: str,
    payload: schemas.ReplaceDiagnosesRequest,
) -> list[models.EncounterDiagnosis]:
    encounter = get_encounter(db, encounter_id)
    encounter.diagnoses = [
        models.EncounterDiagnosis(
            label=item.label,
            icd10_code=item.icd10_code,
            category=item.category,
            notes=item.notes,
        )
        for item in payload.diagnoses
    ]
    _create_event(
        db,
        event_type="encounter.diagnoses_replaced",
        patient_id=encounter.patient_id,
        encounter_id=encounter.id,
        actor_id=payload.actor_id,
        payload=str(len(payload.diagnoses)),
    )
    db.commit()
    db.refresh(encounter)
    return encounter.diagnoses


def replace_encounter_prescriptions(
    db: Session,
    encounter_id: str,
    payload: schemas.ReplacePrescriptionsRequest,
) -> list[models.EncounterPrescription]:
    encounter = get_encounter(db, encounter_id)
    encounter.prescriptions = [
        models.EncounterPrescription(
            medication_name=item.medication_name,
            strength=item.strength,
            dose=item.dose,
            route=item.route,
            frequency=item.frequency,
            duration=item.duration,
            instructions=item.instructions,
            status=item.status,
        )
        for item in payload.prescriptions
    ]
    _create_event(
        db,
        event_type="encounter.prescriptions_replaced",
        patient_id=encounter.patient_id,
        encounter_id=encounter.id,
        actor_id=payload.actor_id,
        payload=str(len(payload.prescriptions)),
    )
    db.commit()
    db.refresh(encounter)
    return encounter.prescriptions


def get_note(db: Session, note_id: str) -> models.Note:
    note = db.get(models.Note, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


def update_note(db: Session, note_id: str, payload: schemas.NoteUpdate) -> models.Note:
    note = get_note(db, note_id)
    try:
        rules.ensure_note_is_mutable(note.status)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(note, field, value)
    _create_event(
        db,
        event_type="note.updated",
        patient_id=note.encounter.patient_id,
        encounter_id=note.encounter_id,
        note_id=note.id,
        actor_id=note.authored_by,
        payload=str(updates),
    )
    db.commit()
    db.refresh(note)
    return note


def finalize_note(db: Session, note_id: str, payload: schemas.FinalizeNoteRequest) -> models.Note:
    note = get_note(db, note_id)
    if not payload.reviewer_id:
        raise HTTPException(status_code=400, detail="Reviewer is required")
    note.status = "finalized"
    note.reviewed_by = payload.reviewer_id
    note.reviewed_at = datetime.utcnow()
    _create_event(
        db,
        event_type="note.finalized",
        patient_id=note.encounter.patient_id,
        encounter_id=note.encounter_id,
        note_id=note.id,
        actor_id=payload.reviewer_id,
        payload=note.status,
    )
    db.commit()
    db.refresh(note)
    return note
