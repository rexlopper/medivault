from app.storage import MinioStorage


def test_builds_storage_key() -> None:
    storage = MinioStorage()
    key = storage.build_storage_key(
        patient_id="patient-123",
        encounter_id="encounter-456",
        filename="lab result.pdf",
    )

    assert key.startswith("patients/patient-123/encounters/encounter-456/")
    assert key.endswith("_lab_result.pdf")
