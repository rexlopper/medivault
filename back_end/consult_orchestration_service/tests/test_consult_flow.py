from fastapi.testclient import TestClient

from app import models
from conftest import TestingSessionLocal


def test_creates_consult_session_and_initial_event(client: TestClient) -> None:
    db = TestingSessionLocal()
    patient = db.query(models.Patient).first()
    encounter = db.query(models.Encounter).first()
    db.close()

    response = client.post(
        "/consult-sessions",
        json={
            "patient_id": patient.id,
            "encounter_id": encounter.id,
            "created_by": "intake-ui",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "created"
    assert payload["chief_complaint"] == "Headache and dizziness"

    detail_response = client.get(f"/consult-sessions/{payload['id']}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert len(detail["events"]) == 1
    assert detail["events"][0]["event_type"] == "consult.created"


def test_advances_consult_lifecycle(client: TestClient) -> None:
    db = TestingSessionLocal()
    patient = db.query(models.Patient).first()
    encounter = db.query(models.Encounter).first()
    db.close()

    created = client.post(
        "/consult-sessions",
        json={
            "patient_id": patient.id,
            "encounter_id": encounter.id,
            "created_by": "intake-ui",
        },
    ).json()

    for event_type, expected_status in [
        ("intake_completed", "intake_completed"),
        ("patient_checked_in", "patient_checked_in"),
        ("consult_started", "in_progress"),
        ("transcription_started", "transcribing"),
        ("draft_note_received", "draft_ready"),
        ("review_started", "under_review"),
        ("consult_finalized", "finalized"),
        ("consult_closed", "closed"),
    ]:
        response = client.post(
            f"/consult-sessions/{created['id']}/events",
            json={"event_type": event_type, "actor_id": "workflow-bot"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == expected_status

    latest_response = client.get(f"/encounters/{encounter.id}/consult-session/latest")
    assert latest_response.status_code == 200
    assert latest_response.json()["status"] == "closed"


def test_rejects_patient_encounter_mismatch(client: TestClient) -> None:
    db = TestingSessionLocal()
    patient = db.query(models.Patient).first()
    encounter = db.query(models.Encounter).first()
    other_patient = models.Patient(
        given_name="Leo",
        family_name="Garcia",
    )
    db.add(other_patient)
    db.commit()
    db.refresh(other_patient)
    db.close()

    response = client.post(
        "/consult-sessions",
        json={
            "patient_id": other_patient.id,
            "encounter_id": encounter.id,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Encounter does not belong to patient"
