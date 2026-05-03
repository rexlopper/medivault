from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app import repositories, schemas

app = FastAPI(title="MediVault Records Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/organizations", response_model=schemas.OrganizationRead, status_code=201)
def create_organization(
    payload: schemas.OrganizationCreate,
    db: Session = Depends(get_db),
) -> schemas.OrganizationRead:
    return repositories.create_organization(db, payload)


@app.get("/organizations", response_model=list[schemas.OrganizationRead])
def list_organizations(db: Session = Depends(get_db)) -> list[schemas.OrganizationRead]:
    return repositories.list_organizations(db)


@app.get("/organizations/{organization_id}", response_model=schemas.OrganizationRead)
def get_organization(organization_id: str, db: Session = Depends(get_db)) -> schemas.OrganizationRead:
    return repositories.get_organization(db, organization_id)


@app.post("/users", response_model=schemas.UserAccountRead, status_code=201)
def create_user_account(
    payload: schemas.UserAccountCreate,
    db: Session = Depends(get_db),
) -> schemas.UserAccountRead:
    return repositories.create_user_account(db, payload)


@app.get("/users", response_model=list[schemas.UserAccountRead])
def list_user_accounts(role: str | None = None, db: Session = Depends(get_db)) -> list[schemas.UserAccountRead]:
    return repositories.list_user_accounts(db, role=role)


@app.get("/users/{user_id}", response_model=schemas.UserAccountRead)
def get_user_account(user_id: str, db: Session = Depends(get_db)) -> schemas.UserAccountRead:
    return repositories.get_user_account(db, user_id)


@app.post("/auth/register-patient", response_model=schemas.AuthSessionRead, status_code=201)
def register_patient_user(
    payload: schemas.PatientRegistrationRequest,
    db: Session = Depends(get_db),
) -> schemas.AuthSessionRead:
    return repositories.register_patient_user(db, payload)


@app.post("/auth/register-doctor", response_model=schemas.AuthSessionRead, status_code=201)
def register_doctor_user(
    payload: schemas.DoctorRegistrationRequest,
    db: Session = Depends(get_db),
) -> schemas.AuthSessionRead:
    return repositories.register_doctor_user(db, payload)


@app.post("/auth/login", response_model=schemas.AuthSessionRead)
def login_user(payload: schemas.AuthLoginRequest, db: Session = Depends(get_db)) -> schemas.AuthSessionRead:
    return repositories.login_user(db, payload)


@app.get("/auth/sessions/{token}", response_model=schemas.AuthSessionRead)
def get_auth_session(token: str, db: Session = Depends(get_db)) -> schemas.AuthSessionRead:
    return repositories.get_auth_session(db, token)


@app.post("/doctors", response_model=schemas.DoctorRead, status_code=201)
def create_doctor(payload: schemas.DoctorCreate, db: Session = Depends(get_db)) -> schemas.DoctorRead:
    return repositories.create_doctor(db, payload)


@app.get("/doctors", response_model=list[schemas.DoctorRead])
def list_doctors(
    organization_id: str | None = None,
    db: Session = Depends(get_db),
) -> list[schemas.DoctorRead]:
    return repositories.list_doctors(db, organization_id=organization_id)


@app.get("/doctors/{doctor_id}", response_model=schemas.DoctorRead)
def get_doctor(doctor_id: str, db: Session = Depends(get_db)) -> schemas.DoctorRead:
    return repositories.get_doctor(db, doctor_id)


@app.post("/patients", response_model=schemas.PatientRead, status_code=201)
def create_patient(payload: schemas.PatientCreate, db: Session = Depends(get_db)) -> schemas.PatientRead:
    return repositories.create_patient(db, payload)


@app.get("/patients/{patient_id}", response_model=schemas.PatientRead)
def get_patient(patient_id: str, db: Session = Depends(get_db)) -> schemas.PatientRead:
    return repositories.get_patient(db, patient_id)


@app.patch("/patients/{patient_id}", response_model=schemas.PatientRead)
def update_patient(
    patient_id: str,
    payload: schemas.PatientUpdate,
    db: Session = Depends(get_db),
) -> schemas.PatientRead:
    return repositories.update_patient(db, patient_id, payload)


@app.post("/encounters", response_model=schemas.EncounterRead, status_code=201)
def create_encounter(payload: schemas.EncounterCreate, db: Session = Depends(get_db)) -> schemas.EncounterRead:
    return repositories.create_encounter(db, payload)


@app.get("/encounters/{encounter_id}", response_model=schemas.EncounterDetail)
def get_encounter(encounter_id: str, db: Session = Depends(get_db)) -> schemas.EncounterDetail:
    return repositories.get_encounter(db, encounter_id)


@app.patch("/encounters/{encounter_id}/status", response_model=schemas.EncounterRead)
def update_encounter_status(
    encounter_id: str,
    payload: schemas.EncounterStatusUpdate,
    db: Session = Depends(get_db),
) -> schemas.EncounterRead:
    return repositories.update_encounter_status(db, encounter_id, payload)


@app.get("/patients/{patient_id}/encounters", response_model=list[schemas.EncounterRead])
def list_patient_encounters(patient_id: str, db: Session = Depends(get_db)) -> list[schemas.EncounterRead]:
    return repositories.list_patient_encounters(db, patient_id)


@app.post("/encounters/{encounter_id}/notes", response_model=schemas.NoteRead, status_code=201)
def create_note(
    encounter_id: str,
    payload: schemas.NoteCreate,
    db: Session = Depends(get_db),
) -> schemas.NoteRead:
    return repositories.create_note(db, encounter_id, payload)


@app.put("/encounters/{encounter_id}/diagnoses", response_model=list[schemas.DiagnosisRead])
def replace_encounter_diagnoses(
    encounter_id: str,
    payload: schemas.ReplaceDiagnosesRequest,
    db: Session = Depends(get_db),
) -> list[schemas.DiagnosisRead]:
    return repositories.replace_encounter_diagnoses(db, encounter_id, payload)


@app.put("/encounters/{encounter_id}/prescriptions", response_model=list[schemas.PrescriptionRead])
def replace_encounter_prescriptions(
    encounter_id: str,
    payload: schemas.ReplacePrescriptionsRequest,
    db: Session = Depends(get_db),
) -> list[schemas.PrescriptionRead]:
    return repositories.replace_encounter_prescriptions(db, encounter_id, payload)


@app.get("/notes/{note_id}", response_model=schemas.NoteRead)
def get_note(note_id: str, db: Session = Depends(get_db)) -> schemas.NoteRead:
    return repositories.get_note(db, note_id)


@app.patch("/notes/{note_id}", response_model=schemas.NoteRead)
def update_note(note_id: str, payload: schemas.NoteUpdate, db: Session = Depends(get_db)) -> schemas.NoteRead:
    return repositories.update_note(db, note_id, payload)


@app.post("/notes/{note_id}/finalize", response_model=schemas.NoteRead)
def finalize_note(
    note_id: str,
    payload: schemas.FinalizeNoteRequest,
    db: Session = Depends(get_db),
) -> schemas.NoteRead:
    return repositories.finalize_note(db, note_id, payload)
