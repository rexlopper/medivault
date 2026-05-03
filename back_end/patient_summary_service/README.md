# MediVault Patient Summary Service

Patient summary service for:

- latest pre-consult patient summary
- versioned summary history
- doctor-ready summary retrieval

## Local setup

```bash
cd back_end/patient_summary_service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

## PostgreSQL local config

Default local connection:

- database: `medivault_records_admin`
- user: `postgres`
- password: `postgres`
- host: `localhost`
- port: `5432`

Override with:

```bash
export DATABASE_URL='postgresql+psycopg://YOUR_USER:YOUR_PASSWORD@localhost:5432/medivault_records_admin'
```

## Run

```bash
uvicorn app.main:app --reload --port 8001
```

## Test

```bash
pytest
```
