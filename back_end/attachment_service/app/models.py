import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_patient_ref: Mapped[str | None] = mapped_column(String(255), unique=True)
    given_name: Mapped[str] = mapped_column(String(120), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(120))
    family_name: Mapped[str] = mapped_column(String(120), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date)
    sex_at_birth: Mapped[str | None] = mapped_column(String(40))
    mobile_number: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[str | None] = mapped_column(String(120))
    clinician_id: Mapped[str | None] = mapped_column(String(120))
    encounter_type: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    source: Mapped[str] = mapped_column(String(60), nullable=False)
    chief_complaint: Mapped[str | None] = mapped_column(String)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


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


class PendingAttachment(Base):
    __tablename__ = "pending_attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_kind: Mapped[str] = mapped_column(String(80), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(120))
    uploaded_by: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
