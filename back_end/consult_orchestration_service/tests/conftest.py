from datetime import datetime, date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.database import Base, get_db
from app.main import app


SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    patient = models.Patient(
        given_name="Ana",
        family_name="Santos",
        birth_date=date(1995, 5, 2),
        sex_at_birth="female",
        mobile_number="09171234567",
    )
    db.add(patient)
    db.flush()
    db.add(
        models.Encounter(
            patient_id=patient.id,
            clinician_id="dr-reyes",
            encounter_type="consultation",
            status="scheduled",
            source="patient_intake_demo",
            chief_complaint="Headache and dizziness",
            started_at=datetime.utcnow(),
        )
    )
    db.commit()
    db.close()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
