# MediVault Records Service

MVP records service for:

- patients
- encounters
- SOAP notes
- note finalization
- audit events

## Local setup

```bash
cd back_end/records_service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

## PostgreSQL local config

The service now expects PostgreSQL for local development.

Default connection:

- database: `medivault_records_admin`
- user: `postgres`
- password: `postgres`
- host: `localhost`
- port: `5432`

Default SQLAlchemy URL:

```bash
postgresql+psycopg://postgres:postgres@localhost:5432/medivault_records_admin
```

You can override it with:

```bash
export DATABASE_URL='postgresql+psycopg://YOUR_USER:YOUR_PASSWORD@localhost:5432/medivault_records_admin'
```

## Run

```bash
uvicorn app.main:app --reload
```

## Test

```bash
pytest
```

## Default local database

The app creates tables on startup using the configured database URL.

For pgAdmin 4:

1. Open `pgAdmin 4`
2. Connect to your local PostgreSQL server
3. Right click `Databases`
4. Choose `Create -> Database...`
5. Set database name to `medivault_records_admin`
6. Save

Then run:

```bash
export DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:5432/medivault_records_admin'
uvicorn app.main:app --reload
```
