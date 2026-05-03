from datetime import date, datetime

from pydantic import BaseModel


class PatientRead(BaseModel):
    id: str
    external_patient_ref: str | None = None
    given_name: str
    middle_name: str | None = None
    family_name: str
    birth_date: date | None = None
    sex_at_birth: str | None = None
    mobile_number: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientSummaryBase(BaseModel):
    allergies: list[str] = []
    active_medications: list[str] = []
    chronic_conditions: list[str] = []
    past_procedures: list[str] = []
    last_known_vitals: dict = {}
    summary_text: str | None = None
    source: str = "manual"
    updated_by: str | None = None


class PatientSummaryUpsert(PatientSummaryBase):
    pass


class PatientSummaryRead(PatientSummaryBase):
    id: str
    patient_id: str
    summary_version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientSummaryBundle(BaseModel):
    patient: PatientRead
    latest_summary: PatientSummaryRead | None
    history: list[PatientSummaryRead]
