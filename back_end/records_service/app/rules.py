VALID_ENCOUNTER_STATUSES = {"scheduled", "in_progress", "awaiting_review", "completed", "cancelled"}
VALID_NOTE_STATUSES = {"draft", "reviewed", "finalized", "superseded"}


def ensure_valid_encounter_status(status: str) -> None:
    if status not in VALID_ENCOUNTER_STATUSES:
        raise ValueError(f"Invalid encounter status: {status}")


def ensure_note_is_mutable(status: str) -> None:
    if status == "finalized":
        raise ValueError("Finalized notes cannot be edited in place")
