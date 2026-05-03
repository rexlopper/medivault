from datetime import datetime

from fastapi import HTTPException

from app import models


TERMINAL_STATUSES = {"closed", "cancelled"}

EVENT_TRANSITIONS: dict[str, dict[str, str | None]] = {
    "intake_completed": {"status": "intake_completed", "timestamp_field": None},
    "patient_checked_in": {"status": "patient_checked_in", "timestamp_field": "checked_in_at"},
    "consult_started": {"status": "in_progress", "timestamp_field": "started_at"},
    "transcription_started": {"status": "transcribing", "timestamp_field": "transcription_started_at"},
    "draft_note_received": {"status": "draft_ready", "timestamp_field": "draft_ready_at"},
    "review_started": {"status": "under_review", "timestamp_field": "review_started_at"},
    "consult_finalized": {"status": "finalized", "timestamp_field": "finalized_at"},
    "consult_closed": {"status": "closed", "timestamp_field": "closed_at"},
    "consult_cancelled": {"status": "cancelled", "timestamp_field": "closed_at"},
}


def apply_event(session: models.ConsultSession, event_type: str) -> tuple[str | None, str | None]:
    transition = EVENT_TRANSITIONS.get(event_type)
    if transition is None:
        raise HTTPException(status_code=400, detail=f"Unsupported event type: {event_type}")

    if session.status in TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail="Consult session is already terminal")

    from_status = session.status
    to_status = transition["status"]
    timestamp_field = transition["timestamp_field"]

    if to_status is not None:
        session.status = to_status
    if timestamp_field:
        current_value = getattr(session, timestamp_field)
        if current_value is None:
            setattr(session, timestamp_field, datetime.utcnow())
    return from_status, to_status
