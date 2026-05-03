from datetime import datetime

from pydantic import BaseModel, Field


class ConsultSessionCreate(BaseModel):
    patient_id: str
    encounter_id: str | None = None
    organization_id: str | None = None
    clinician_id: str | None = None
    source: str = "consult_orchestrator"
    chief_complaint: str | None = None
    created_by: str | None = None


class ConsultSessionEventCreate(BaseModel):
    event_type: str = Field(min_length=1)
    actor_id: str | None = None
    payload: dict = Field(default_factory=dict)


class ConsultSessionRead(BaseModel):
    id: str
    patient_id: str
    encounter_id: str | None = None
    organization_id: str | None = None
    clinician_id: str | None = None
    source: str
    status: str
    chief_complaint: str | None = None
    created_by: str | None = None
    checked_in_at: datetime | None = None
    started_at: datetime | None = None
    transcription_started_at: datetime | None = None
    draft_ready_at: datetime | None = None
    review_started_at: datetime | None = None
    finalized_at: datetime | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConsultSessionEventRead(BaseModel):
    id: str
    consult_session_id: str
    event_type: str
    from_status: str | None = None
    to_status: str | None = None
    actor_id: str | None = None
    payload: dict = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True


class ConsultSessionDetail(ConsultSessionRead):
    events: list[ConsultSessionEventRead]
