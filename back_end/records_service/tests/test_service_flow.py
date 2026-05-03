from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

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
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_patient_encounter_note_finalize_flow(client: TestClient) -> None:
    patient_response = client.post(
        "/patients",
        json={
            "given_name": "Ana",
            "family_name": "Santos",
            "birth_date": str(date(1995, 5, 2)),
            "sex_at_birth": "female",
            "mobile_number": "09171234567",
        },
    )
    assert patient_response.status_code == 201
    patient_id = patient_response.json()["id"]

    encounter_response = client.post(
        "/encounters",
        json={
            "patient_id": patient_id,
            "clinician_id": "dr-reyes",
            "chief_complaint": "Persistent cough",
        },
    )
    assert encounter_response.status_code == 201
    encounter_id = encounter_response.json()["id"]

    note_response = client.post(
        f"/encounters/{encounter_id}/notes",
        json={
            "source": "transcription_agent",
            "subjective": "Patient reports cough for 5 days",
            "assessment": "Upper respiratory infection",
            "plan": "Hydration and follow-up if worsening",
            "authored_by": "agent-transcriber",
        },
    )
    assert note_response.status_code == 201
    note_id = note_response.json()["id"]
    assert note_response.json()["status"] == "draft"

    finalized_response = client.post(f"/notes/{note_id}/finalize", json={"reviewer_id": "dr-reyes"})
    assert finalized_response.status_code == 200
    assert finalized_response.json()["status"] == "finalized"
    assert finalized_response.json()["reviewed_by"] == "dr-reyes"

    immutable_response = client.patch(
        f"/notes/{note_id}",
        json={"plan": "This should be blocked"},
    )
    assert immutable_response.status_code == 409

    encounter_detail_response = client.get(f"/encounters/{encounter_id}")
    assert encounter_detail_response.status_code == 200
    body = encounter_detail_response.json()
    assert len(body["notes"]) == 1
    assert any(event["event_type"] == "note.finalized" for event in body["events"])


def test_identity_flow_for_organization_user_and_doctor(client: TestClient) -> None:
    organization_response = client.post(
        "/organizations",
        json={
          "slug": "clinica-san-lorenzo",
          "name": "Clinica San Lorenzo",
          "organization_type": "clinic",
        },
    )
    assert organization_response.status_code == 201
    organization_id = organization_response.json()["id"]

    user_response = client.post(
        "/users",
        json={
            "email": "dr.reyes@medivault.local",
            "full_name": "Dr. Jose Reyes",
            "role": "doctor",
            "status": "active",
        },
    )
    assert user_response.status_code == 201
    user_id = user_response.json()["id"]

    doctor_response = client.post(
        "/doctors",
        json={
            "user_id": user_id,
            "organization_id": organization_id,
            "doctor_code": "dr-reyes",
            "full_name": "Dr. Jose Reyes",
            "specialty": "Internal Medicine",
            "license_number": "PRC-1234567",
        },
    )
    assert doctor_response.status_code == 201
    doctor_id = doctor_response.json()["id"]
    assert doctor_response.json()["organization_id"] == organization_id

    doctor_list_response = client.get(f"/doctors?organization_id={organization_id}")
    assert doctor_list_response.status_code == 200
    assert len(doctor_list_response.json()) == 1
    assert doctor_list_response.json()[0]["id"] == doctor_id

    user_lookup_response = client.get(f"/users/{user_id}")
    assert user_lookup_response.status_code == 200
    assert user_lookup_response.json()["email"] == "dr.reyes@medivault.local"


def test_patient_registration_and_login_flow(client: TestClient) -> None:
    register_response = client.post(
        "/auth/register-patient",
        json={
            "email": "maria.santos@medivault.local",
            "password": "patientpass123",
            "given_name": "Maria",
            "family_name": "Santos",
            "birth_date": str(date(1991, 8, 12)),
            "sex_at_birth": "female",
            "mobile_number": "09171234567",
        },
    )
    assert register_response.status_code == 201
    register_body = register_response.json()
    assert register_body["role"] == "patient"
    assert register_body["patient_id"] is not None
    token = register_body["token"]

    session_lookup_response = client.get(f"/auth/sessions/{token}")
    assert session_lookup_response.status_code == 200
    assert session_lookup_response.json()["patient_id"] == register_body["patient_id"]

    login_response = client.post(
        "/auth/login",
        json={
            "email": "maria.santos@medivault.local",
            "password": "patientpass123",
        },
    )
    assert login_response.status_code == 200
    assert login_response.json()["role"] == "patient"
    assert login_response.json()["patient_id"] == register_body["patient_id"]


def test_encounter_structured_diagnoses_and_prescriptions_flow(client: TestClient) -> None:
    patient_response = client.post(
        "/patients",
        json={
            "given_name": "Maria",
            "family_name": "Reyes",
        },
    )
    assert patient_response.status_code == 201
    patient_id = patient_response.json()["id"]

    encounter_response = client.post(
        "/encounters",
        json={
            "patient_id": patient_id,
            "clinician_id": "dr-reyes",
            "chief_complaint": "Persistent headache",
        },
    )
    assert encounter_response.status_code == 201
    encounter_id = encounter_response.json()["id"]

    diagnoses_response = client.put(
        f"/encounters/{encounter_id}/diagnoses",
        json={
            "actor_id": "dr-reyes",
            "diagnoses": [
                {
                    "label": "Essential hypertension",
                    "icd10_code": "I10",
                    "category": "primary",
                    "notes": "Likely contributing to current headache episode",
                },
                {
                    "label": "Headache",
                    "icd10_code": "R51",
                    "category": "symptom",
                },
            ],
        },
    )
    assert diagnoses_response.status_code == 200
    assert len(diagnoses_response.json()) == 2

    prescriptions_response = client.put(
        f"/encounters/{encounter_id}/prescriptions",
        json={
            "actor_id": "dr-reyes",
            "prescriptions": [
                {
                    "medication_name": "Losartan",
                    "strength": "50 mg",
                    "dose": "1 tablet",
                    "route": "oral",
                    "frequency": "once daily",
                    "duration": "30 days",
                    "instructions": "Continue maintenance therapy",
                    "status": "active",
                }
            ],
        },
    )
    assert prescriptions_response.status_code == 200
    assert len(prescriptions_response.json()) == 1

    encounter_detail_response = client.get(f"/encounters/{encounter_id}")
    assert encounter_detail_response.status_code == 200
    body = encounter_detail_response.json()
    assert len(body["diagnoses"]) == 2
    assert len(body["prescriptions"]) == 1
    assert any(event["event_type"] == "encounter.diagnoses_replaced" for event in body["events"])
    assert any(event["event_type"] == "encounter.prescriptions_replaced" for event in body["events"])
