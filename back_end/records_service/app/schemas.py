from datetime import date, datetime

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    slug: str = Field(min_length=1)
    name: str = Field(min_length=1)
    organization_type: str = "clinic"
    status: str = "active"


class OrganizationRead(OrganizationCreate):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserAccountCreate(BaseModel):
    email: str = Field(min_length=1)
    full_name: str = Field(min_length=1)
    role: str = "doctor"
    status: str = "active"
    password: str | None = Field(default=None, min_length=8)
    auth_provider: str | None = None
    auth_subject: str | None = None


class UserAccountRead(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    status: str
    auth_provider: str | None = None
    auth_subject: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DoctorCreate(BaseModel):
    user_id: str
    organization_id: str | None = None
    doctor_code: str | None = None
    full_name: str = Field(min_length=1)
    specialty: str | None = None
    license_number: str | None = None
    status: str = "active"


class DoctorRead(BaseModel):
    id: str
    user_id: str
    organization_id: str | None = None
    doctor_code: str | None = None
    full_name: str
    specialty: str | None = None
    license_number: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientRegistrationRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=8)
    given_name: str = Field(min_length=1)
    middle_name: str | None = None
    family_name: str = Field(min_length=1)
    birth_date: date | None = None
    sex_at_birth: str | None = None
    mobile_number: str | None = None


class DoctorRegistrationRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)
    organization_name: str = Field(min_length=1)
    organization_type: str = "clinic"
    specialty: str | None = None
    license_number: str | None = None
    doctor_code: str | None = None


class AuthLoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=8)


class AuthSessionRead(BaseModel):
    token: str
    user_id: str
    role: str
    full_name: str
    patient_id: str | None = None
    doctor_id: str | None = None
    organization_id: str | None = None
    expires_at: datetime


class PatientBase(BaseModel):
    external_patient_ref: str | None = None
    given_name: str
    middle_name: str | None = None
    family_name: str
    birth_date: date | None = None
    sex_at_birth: str | None = None
    mobile_number: str | None = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    given_name: str | None = None
    middle_name: str | None = None
    family_name: str | None = None
    birth_date: date | None = None
    sex_at_birth: str | None = None
    mobile_number: str | None = None


class PatientRead(PatientBase):
    id: str
    user_id: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EncounterCreate(BaseModel):
    patient_id: str
    organization_id: str | None = None
    clinician_id: str | None = None
    encounter_type: str = "consultation"
    source: str = "doctor_app"
    chief_complaint: str | None = None
    started_at: datetime | None = None


class EncounterStatusUpdate(BaseModel):
    status: str
    ended_at: datetime | None = None


class EncounterRead(BaseModel):
    id: str
    patient_id: str
    organization_id: str | None = None
    clinician_id: str | None = None
    encounter_type: str
    status: str
    source: str
    chief_complaint: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NoteCreate(BaseModel):
    note_type: str = "soap"
    source: str = "manual"
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None
    authored_by: str | None = None


class NoteUpdate(BaseModel):
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None


class FinalizeNoteRequest(BaseModel):
    reviewer_id: str = Field(min_length=1)


class NoteRead(BaseModel):
    id: str
    encounter_id: str
    version: int
    note_type: str
    status: str
    source: str
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None
    authored_by: str | None = None
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    supersedes_note_id: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DiagnosisWrite(BaseModel):
    label: str = Field(min_length=1)
    icd10_code: str | None = None
    category: str = "primary"
    notes: str | None = None


class DiagnosisRead(DiagnosisWrite):
    id: str
    encounter_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReplaceDiagnosesRequest(BaseModel):
    diagnoses: list[DiagnosisWrite] = Field(default_factory=list)
    actor_id: str | None = None


class PrescriptionWrite(BaseModel):
    medication_name: str = Field(min_length=1)
    strength: str | None = None
    dose: str | None = None
    route: str | None = None
    frequency: str | None = None
    duration: str | None = None
    instructions: str | None = None
    status: str = "active"


class PrescriptionRead(PrescriptionWrite):
    id: str
    encounter_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReplacePrescriptionsRequest(BaseModel):
    prescriptions: list[PrescriptionWrite] = Field(default_factory=list)
    actor_id: str | None = None


class EventRead(BaseModel):
    id: str
    patient_id: str | None = None
    encounter_id: str | None = None
    note_id: str | None = None
    event_type: str
    actor_id: str | None = None
    payload: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class EncounterDetail(EncounterRead):
    notes: list[NoteRead]
    diagnoses: list[DiagnosisRead]
    prescriptions: list[PrescriptionRead]
    events: list[EventRead]
