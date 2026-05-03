# MediVault Records Service MVP

## Purpose

The records service is the durable system of record for everything MediVault learns during intake and consultation.

It should stay useful even if:

- the transcription provider changes
- the note-generation model changes
- the product pivots from "AI scribe" to "point-of-care record layer"
- EMR integrations are delayed

## MVP Responsibilities

Own these artifacts:

- patient identity within MediVault
- patient clinical summary
- encounters / consultations
- draft notes
- doctor-approved final notes
- attachments and source artifacts
- referrals / handoff metadata
- record version history

Do not own in MVP:

- raw transcription processing
- billing
- scheduling
- diagnosis recommendations
- deep EMR sync logic

## Core Design Rule

Treat every clinical artifact as `draft -> reviewed -> finalized`.

Nothing AI-generated becomes a final record until a doctor approves it.

## Suggested Service Boundaries

The records service should expose a clean API and accept inputs from:

- intake service
- consult orchestration service
- transcription agent / note generation pipeline
- clinic dashboard
- doctor app

It should not directly run AI jobs. It should store outputs and track status.

## MVP Domain Model

### 1. Patient

Minimal patient profile used by MediVault.

Core fields:

- `id`
- `external_patient_ref`
- `given_name`
- `family_name`
- `middle_name`
- `birth_date`
- `sex_at_birth`
- `mobile_number`
- `created_at`

### 2. Patient Summary

Latest structured context that helps before a consult starts.

Suggested fields:

- allergies
- active medications
- chronic conditions
- past procedures
- last known vitals
- free-text summary
- source and last update metadata

### 3. Encounter

Represents one consultation or clinical touchpoint.

Suggested fields:

- `patient_id`
- `organization_id`
- `clinician_id`
- `encounter_type`
- `status`
- `started_at`
- `ended_at`
- `source`
- `chief_complaint`

Status values:

- `scheduled`
- `in_progress`
- `awaiting_review`
- `completed`
- `cancelled`

### 4. Note

The note is the main output artifact.

Suggested fields:

- `encounter_id`
- `note_type`
- `status`
- `subjective`
- `objective`
- `assessment`
- `plan`
- `doctor_reviewed_by`
- `doctor_reviewed_at`

Status values:

- `draft`
- `reviewed`
- `finalized`
- `superseded`

### 5. Attachment

Stores linked source files, not the blob itself.

Examples:

- audio file
- lab result PDF
- prescription photo
- scanned old chart

Suggested fields:

- `encounter_id`
- `patient_id`
- `file_kind`
- `storage_key`
- `mime_type`
- `uploaded_by`

### 6. Referral

Keeps handoff metadata even before interoperability exists.

Suggested fields:

- `encounter_id`
- `referred_to_name`
- `referred_to_org`
- `reason`
- `status`
- `document_attachment_id`

### 7. Record Event

Append-only event trail for audit and debugging.

Examples:

- note draft created
- note edited
- note approved
- attachment uploaded
- patient summary updated

## Recommended API Shape

### Patients

- `POST /patients`
- `GET /patients/:patientId`
- `PATCH /patients/:patientId`
- `GET /patients/:patientId/summary`
- `PUT /patients/:patientId/summary`

### Encounters

- `POST /encounters`
- `GET /encounters/:encounterId`
- `PATCH /encounters/:encounterId/status`
- `GET /patients/:patientId/encounters`

### Notes

- `POST /encounters/:encounterId/notes`
- `GET /encounters/:encounterId/notes`
- `GET /notes/:noteId`
- `PATCH /notes/:noteId`
- `POST /notes/:noteId/finalize`

### Attachments

- `POST /attachments`
- `GET /patients/:patientId/attachments`
- `GET /encounters/:encounterId/attachments`

### Referrals

- `POST /encounters/:encounterId/referrals`
- `GET /encounters/:encounterId/referrals`

### Events

- `GET /patients/:patientId/events`
- `GET /encounters/:encounterId/events`

## Critical Behavior Rules

### Doctor approval gate

- AI can create or update a `draft` note.
- Only a doctor can finalize a note.
- Finalized notes become read-only except through explicit versioning.

### Versioning

- Never silently overwrite finalized notes.
- If a finalized note needs changes, create a new version and mark the old one `superseded`.

### Attachment references

- Store files in object storage.
- Only store metadata and storage keys in the records DB.

### Idempotency

- Encounter and note creation endpoints should support idempotency keys.
- This matters when mobile sync retries or the transcription pipeline replays.

## Good MVP Build Order

### Phase 1

- patient table
- encounter table
- note table
- basic create/read/update endpoints

### Phase 2

- patient summary
- attachment metadata
- note finalization rules
- event log

### Phase 3

- referral support
- versioned finalized notes
- access hooks for consent / auth service

## How To Test It

Test at three levels.

### 1. Unit tests

Focus on pure business rules:

- note cannot finalize without doctor reviewer
- finalized note cannot be edited in place
- encounter status transitions are valid
- summary update records an event

### 2. Integration tests

Use a real test database.

Validate:

- create patient -> create encounter -> create draft note -> finalize note
- upload attachment metadata and fetch by encounter
- create second version of a finalized note
- query encounter timeline and patient history

### 3. API / contract tests

Hit the HTTP endpoints end to end.

Validate:

- request validation
- error handling
- idempotency behavior
- authorization hooks

## First Test Cases To Write

1. `creates a patient and returns stable patient id`
2. `creates an encounter for an existing patient`
3. `creates a draft SOAP note for an encounter`
4. `blocks note finalization when reviewer is missing`
5. `finalizes note when doctor reviewer is present`
6. `blocks direct mutation of finalized note`
7. `creates replacement note version for corrected finalized note`
8. `stores attachment metadata without storing file bytes in database`
9. `returns full encounter record with notes and attachments`
10. `writes record events for create, update, finalize actions`

## Practical Definition of Done

I would call the records service MVP-ready when you can:

1. create a patient
2. start an encounter
3. attach intake context to that encounter
4. save AI-generated draft notes
5. let a doctor edit and finalize them
6. retrieve the final encounter record later
7. inspect an audit trail of what changed and when

That gives your CTO's transcription agent a reliable home to write into.
