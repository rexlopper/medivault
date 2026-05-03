import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class Organization(TimestampMixin, Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_type: Mapped[str] = mapped_column(String(60), default="clinic", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)

    doctors: Mapped[list["Doctor"]] = relationship(back_populates="organization")


class UserAccount(TimestampMixin, Base):
    __tablename__ = "user_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), default="doctor", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    auth_provider: Mapped[str | None] = mapped_column(String(80))
    auth_subject: Mapped[str | None] = mapped_column(String(255), unique=True)

    doctor_profile: Mapped["Doctor | None"] = relationship(
        back_populates="user_account",
        cascade="all, delete-orphan",
        uselist=False,
    )
    patient_profile: Mapped["Patient | None"] = relationship(
        back_populates="user_account",
        uselist=False,
    )
    sessions: Mapped[list["AuthSession"]] = relationship(
        back_populates="user_account",
        cascade="all, delete-orphan",
    )


class Doctor(TimestampMixin, Base):
    __tablename__ = "doctors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("user_accounts.id", ondelete="CASCADE"), unique=True, nullable=False)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"))
    doctor_code: Mapped[str | None] = mapped_column(String(120), unique=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    specialty: Mapped[str | None] = mapped_column(String(120))
    license_number: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)

    user_account: Mapped["UserAccount"] = relationship(back_populates="doctor_profile")
    organization: Mapped["Organization | None"] = relationship(back_populates="doctors")


class Patient(TimestampMixin, Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("user_accounts.id", ondelete="SET NULL"), unique=True)
    external_patient_ref: Mapped[str | None] = mapped_column(String(255), unique=True)
    given_name: Mapped[str] = mapped_column(String(120), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(120))
    family_name: Mapped[str] = mapped_column(String(120), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date)
    sex_at_birth: Mapped[str | None] = mapped_column(String(40))
    mobile_number: Mapped[str | None] = mapped_column(String(40))

    user_account: Mapped["UserAccount | None"] = relationship(back_populates="patient_profile")
    summaries: Mapped[list["PatientSummary"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    encounters: Mapped[list["Encounter"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    events: Mapped[list["RecordEvent"]] = relationship(back_populates="patient", cascade="all, delete-orphan")


class PatientSummary(TimestampMixin, Base):
    __tablename__ = "patient_summaries"
    __table_args__ = (UniqueConstraint("patient_id", "summary_version", name="patient_summaries_patient_version_idx"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    summary_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    allergies: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    active_medications: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    chronic_conditions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    past_procedures: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    last_known_vitals: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    summary_text: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(60), default="manual", nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(120))

    patient: Mapped["Patient"] = relationship(back_populates="summaries")


class Encounter(TimestampMixin, Base):
    __tablename__ = "encounters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[str | None] = mapped_column(String(120))
    clinician_id: Mapped[str | None] = mapped_column(String(120))
    encounter_type: Mapped[str] = mapped_column(String(60), default="consultation", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="scheduled", nullable=False)
    source: Mapped[str] = mapped_column(String(60), default="doctor_app", nullable=False)
    chief_complaint: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)

    patient: Mapped["Patient"] = relationship(back_populates="encounters")
    notes: Mapped[list["Note"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    diagnoses: Mapped[list["EncounterDiagnosis"]] = relationship(
        back_populates="encounter",
        cascade="all, delete-orphan",
    )
    prescriptions: Mapped[list["EncounterPrescription"]] = relationship(
        back_populates="encounter",
        cascade="all, delete-orphan",
    )
    attachments: Mapped[list["Attachment"]] = relationship(back_populates="encounter")
    referrals: Mapped[list["Referral"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    events: Mapped[list["RecordEvent"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")


class Note(TimestampMixin, Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    note_type: Mapped[str] = mapped_column(String(40), default="soap", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="draft", nullable=False)
    source: Mapped[str] = mapped_column(String(60), default="manual", nullable=False)
    subjective: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    assessment: Mapped[str | None] = mapped_column(Text)
    plan: Mapped[str | None] = mapped_column(Text)
    authored_by: Mapped[str | None] = mapped_column(String(120))
    reviewed_by: Mapped[str | None] = mapped_column(String(120))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    supersedes_note_id: Mapped[str | None] = mapped_column(ForeignKey("notes.id"))

    encounter: Mapped["Encounter"] = relationship(back_populates="notes")
    events: Mapped[list["RecordEvent"]] = relationship(back_populates="note", cascade="all, delete-orphan")


class EncounterDiagnosis(TimestampMixin, Base):
    __tablename__ = "encounter_diagnoses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    icd10_code: Mapped[str | None] = mapped_column(String(32))
    category: Mapped[str] = mapped_column(String(40), default="primary", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    encounter: Mapped["Encounter"] = relationship(back_populates="diagnoses")


class EncounterPrescription(TimestampMixin, Base):
    __tablename__ = "encounter_prescriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False)
    medication_name: Mapped[str] = mapped_column(String(255), nullable=False)
    strength: Mapped[str | None] = mapped_column(String(120))
    dose: Mapped[str | None] = mapped_column(String(120))
    route: Mapped[str | None] = mapped_column(String(120))
    frequency: Mapped[str | None] = mapped_column(String(120))
    duration: Mapped[str | None] = mapped_column(String(120))
    instructions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)

    encounter: Mapped["Encounter"] = relationship(back_populates="prescriptions")


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    encounter_id: Mapped[str | None] = mapped_column(ForeignKey("encounters.id", ondelete="SET NULL"))
    file_kind: Mapped[str] = mapped_column(String(80), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(120))
    uploaded_by: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    patient: Mapped["Patient"] = relationship(back_populates="attachments")
    encounter: Mapped["Encounter"] = relationship(back_populates="attachments")
    referrals: Mapped[list["Referral"]] = relationship(back_populates="document_attachment")


class Referral(TimestampMixin, Base):
    __tablename__ = "referrals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False)
    referred_to_name: Mapped[str | None] = mapped_column(String(255))
    referred_to_org: Mapped[str | None] = mapped_column(String(255))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="draft", nullable=False)
    document_attachment_id: Mapped[str | None] = mapped_column(ForeignKey("attachments.id"))
    created_by: Mapped[str | None] = mapped_column(String(120))

    encounter: Mapped["Encounter"] = relationship(back_populates="referrals")
    document_attachment: Mapped["Attachment"] = relationship(back_populates="referrals")


class RecordEvent(Base):
    __tablename__ = "record_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str | None] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"))
    encounter_id: Mapped[str | None] = mapped_column(ForeignKey("encounters.id", ondelete="CASCADE"))
    note_id: Mapped[str | None] = mapped_column(ForeignKey("notes.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(120))
    payload: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    patient: Mapped["Patient"] = relationship(back_populates="events")
    encounter: Mapped["Encounter"] = relationship(back_populates="events")
    note: Mapped["Note"] = relationship(back_populates="events")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role_snapshot: Mapped[str] = mapped_column(String(40), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user_account: Mapped["UserAccount"] = relationship(back_populates="sessions")
