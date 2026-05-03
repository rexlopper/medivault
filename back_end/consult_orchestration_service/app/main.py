from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import repositories, schemas
from app.database import engine, get_db
from app.models import ConsultSession, ConsultSessionEvent

app = FastAPI(title="MediVault Consult Orchestration Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ConsultSession.__table__.create(bind=engine, checkfirst=True)
ConsultSessionEvent.__table__.create(bind=engine, checkfirst=True)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/consult-sessions", response_model=list[schemas.ConsultSessionRead])
def list_consult_sessions(
    patient_id: str | None = None,
    clinician_id: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> list[schemas.ConsultSessionRead]:
    return repositories.list_consult_sessions(
        db,
        patient_id=patient_id,
        clinician_id=clinician_id,
        status=status,
    )


@app.post("/consult-sessions", response_model=schemas.ConsultSessionRead, status_code=201)
def create_consult_session(
    payload: schemas.ConsultSessionCreate,
    db: Session = Depends(get_db),
) -> schemas.ConsultSessionRead:
    return repositories.create_consult_session(db, payload)


@app.get("/consult-sessions/{consult_session_id}", response_model=schemas.ConsultSessionDetail)
def get_consult_session(
    consult_session_id: str,
    db: Session = Depends(get_db),
) -> schemas.ConsultSessionDetail:
    return repositories.build_consult_detail(db, consult_session_id)


@app.get("/encounters/{encounter_id}/consult-session/latest", response_model=schemas.ConsultSessionRead | None)
def get_latest_encounter_consult_session(
    encounter_id: str,
    db: Session = Depends(get_db),
) -> schemas.ConsultSessionRead | None:
    return repositories.get_latest_encounter_consult_session(db, encounter_id)


@app.post("/consult-sessions/{consult_session_id}/events", response_model=schemas.ConsultSessionDetail)
def add_consult_event(
    consult_session_id: str,
    payload: schemas.ConsultSessionEventCreate,
    db: Session = Depends(get_db),
) -> schemas.ConsultSessionDetail:
    repositories.add_consult_event(db, consult_session_id, payload)
    return repositories.build_consult_detail(db, consult_session_id)
