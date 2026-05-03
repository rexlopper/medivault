# MediVault Consult Orchestration Service

Consult orchestration service for:

- create consult sessions above encounters
- track lifecycle state for one visit
- record workflow events such as intake completed, transcription started, and doctor review
- provide a doctor-facing consult timeline

## Local setup

```bash
cd back_end/consult_orchestration_service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

## Run

```bash
uvicorn app.main:app --reload --port 8003
```

## Dependencies

- PostgreSQL database: `medivault_records_admin`
- existing `patients` and optional `encounters` rows from `records_service`
