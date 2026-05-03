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

    summaries: Mapped[list["PatientSummary"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )


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
