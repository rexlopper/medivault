import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
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


class Patient(TimestampMixin, Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_patient_ref: Mapped[str | None] = mapped_column(String(255), unique=True)
    given_name: Mapped[str] = mapped_column(String(120), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(120))
    family_name: Mapped[str] = mapped_column(String(120), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date)
    sex_at_birth: Mapped[str | None] = mapped_column(String(40))
    mobile_number: Mapped[str | None] = mapped_column(String(40))


class Encounter(TimestampMixin, Base):
    __tablename__ = "encounters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[str | None] = mapped_column(String(120))
    clinician_id: Mapped[str | None] = mapped_column(String(120))
    encounter_type: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    source: Mapped[str] = mapped_column(String(60), nullable=False)
    chief_complaint: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)


class ConsultSession(TimestampMixin, Base):
    __tablename__ = "consult_sessions"
    __table_args__ = (UniqueConstraint("encounter_id", name="consult_sessions_encounter_id_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    encounter_id: Mapped[str | None] = mapped_column(ForeignKey("encounters.id", ondelete="SET NULL"))
    organization_id: Mapped[str | None] = mapped_column(String(120))
    clinician_id: Mapped[str | None] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(60), default="consult_orchestrator", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="created", nullable=False)
    chief_complaint: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(String(120))
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    transcription_started_at: Mapped[datetime | None] = mapped_column(DateTime)
    draft_ready_at: Mapped[datetime | None] = mapped_column(DateTime)
    review_started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)

    events: Mapped[list["ConsultSessionEvent"]] = relationship(
        back_populates="consult_session",
        cascade="all, delete-orphan",
    )


class ConsultSessionEvent(Base):
    __tablename__ = "consult_session_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    consult_session_id: Mapped[str] = mapped_column(
        ForeignKey("consult_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(40))
    to_status: Mapped[str | None] = mapped_column(String(40))
    actor_id: Mapped[str | None] = mapped_column(String(120))
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    consult_session: Mapped["ConsultSession"] = relationship(back_populates="events")
