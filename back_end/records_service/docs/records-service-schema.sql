CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_patient_ref TEXT UNIQUE,
  given_name TEXT NOT NULL,
  middle_name TEXT,
  family_name TEXT NOT NULL,
  birth_date DATE,
  sex_at_birth TEXT,
  mobile_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE patient_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  summary_version INTEGER NOT NULL DEFAULT 1,
  allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  chronic_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  past_procedures JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_known_vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary_text TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX patient_summaries_patient_version_idx
  ON patient_summaries(patient_id, summary_version);

CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id TEXT,
  clinician_id TEXT,
  encounter_type TEXT NOT NULL DEFAULT 'consultation',
  status TEXT NOT NULL DEFAULT 'scheduled',
  source TEXT NOT NULL DEFAULT 'doctor_app',
  chief_complaint TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('scheduled', 'in_progress', 'awaiting_review', 'completed', 'cancelled'))
);

CREATE INDEX encounters_patient_idx ON encounters(patient_id, created_at DESC);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  note_type TEXT NOT NULL DEFAULT 'soap',
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT NOT NULL DEFAULT 'manual',
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  authored_by TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  supersedes_note_id UUID REFERENCES notes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('draft', 'reviewed', 'finalized', 'superseded'))
);

CREATE UNIQUE INDEX notes_encounter_version_idx
  ON notes(encounter_id, version);

CREATE INDEX notes_encounter_idx ON notes(encounter_id, created_at DESC);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  file_kind TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT,
  mime_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX attachments_patient_idx ON attachments(patient_id, created_at DESC);
CREATE INDEX attachments_encounter_idx ON attachments(encounter_id, created_at DESC);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  referred_to_name TEXT,
  referred_to_org TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  document_attachment_id UUID REFERENCES attachments(id),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('draft', 'issued', 'cancelled'))
);

CREATE TABLE record_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX record_events_patient_idx ON record_events(patient_id, created_at DESC);
CREATE INDEX record_events_encounter_idx ON record_events(encounter_id, created_at DESC);
CREATE INDEX record_events_note_idx ON record_events(note_id, created_at DESC);
