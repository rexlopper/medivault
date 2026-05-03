from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app import models


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
    db.add(
        models.Patient(
            given_name="Ana",
            family_name="Santos",
            birth_date=date(1995, 5, 2),
            sex_at_birth="female",
            mobile_number="09171234567",
        )
    )
    db.commit()
    db.close()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_creates_versioned_patient_summaries(client: TestClient) -> None:
    db = TestingSessionLocal()
    patient = db.query(models.Patient).first()
    db.close()

    first_response = client.put(
        f"/patients/{patient.id}/summary",
        json={
            "allergies": ["Seafood"],
            "active_medications": ["Paracetamol 500mg"],
            "summary_text": "Recurring migraine episodes during stressful weeks.",
            "updated_by": "intake-ui",
        },
    )
    assert first_response.status_code == 200
    assert first_response.json()["summary_version"] == 1

    second_response = client.put(
        f"/patients/{patient.id}/summary",
        json={
            "allergies": ["Seafood", "Penicillin"],
            "active_medications": ["Paracetamol 500mg"],
            "chronic_conditions": ["Migraine"],
            "summary_text": "Updated after follow-up triage.",
            "updated_by": "nurse-triage",
        },
    )
    assert second_response.status_code == 200
    assert second_response.json()["summary_version"] == 2

    latest_response = client.get(f"/patients/{patient.id}/summary/latest")
    assert latest_response.status_code == 200
    assert latest_response.json()["summary_version"] == 2

    bundle_response = client.get(f"/patients/{patient.id}/summary-bundle")
    assert bundle_response.status_code == 200
    assert len(bundle_response.json()["history"]) == 2
