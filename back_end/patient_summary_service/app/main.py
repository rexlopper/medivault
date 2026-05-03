from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import repositories, schemas
from app.models import PatientSummary
from app.database import Base, engine, get_db

app = FastAPI(title="MediVault Patient Summary Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

PatientSummary.__table__.create(bind=engine, checkfirst=True)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/patients/{patient_id}/summary/latest", response_model=schemas.PatientSummaryRead | None)
def get_latest_summary(patient_id: str, db: Session = Depends(get_db)) -> schemas.PatientSummaryRead | None:
    repositories.get_patient(db, patient_id)
    return repositories.get_latest_summary(db, patient_id)


@app.get("/patients/{patient_id}/summaries", response_model=list[schemas.PatientSummaryRead])
def list_patient_summaries(patient_id: str, db: Session = Depends(get_db)) -> list[schemas.PatientSummaryRead]:
    return repositories.list_summaries(db, patient_id)


@app.get("/patients/{patient_id}/summary-bundle", response_model=schemas.PatientSummaryBundle)
def get_patient_summary_bundle(patient_id: str, db: Session = Depends(get_db)) -> schemas.PatientSummaryBundle:
    return repositories.build_summary_bundle(db, patient_id)


@app.put("/patients/{patient_id}/summary", response_model=schemas.PatientSummaryRead)
def upsert_patient_summary(
    patient_id: str,
    payload: schemas.PatientSummaryUpsert,
    db: Session = Depends(get_db),
) -> schemas.PatientSummaryRead:
    return repositories.upsert_summary(db, patient_id, payload)
