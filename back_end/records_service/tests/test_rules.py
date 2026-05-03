import pytest

from app.rules import ensure_note_is_mutable, ensure_valid_encounter_status


def test_blocks_finalized_note_mutation() -> None:
    with pytest.raises(ValueError, match="Finalized notes cannot be edited in place"):
        ensure_note_is_mutable("finalized")


def test_accepts_valid_encounter_status() -> None:
    ensure_valid_encounter_status("in_progress")


def test_rejects_invalid_encounter_status() -> None:
    with pytest.raises(ValueError, match="Invalid encounter status"):
        ensure_valid_encounter_status("unknown")
