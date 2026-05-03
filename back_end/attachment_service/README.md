# MediVault Attachment Service

Attachment service for:

- upload file metadata to PostgreSQL
- store file bytes in MinIO
- list attachments by patient or encounter
- stream downloads through the API

## Local setup

```bash
cd back_end/attachment_service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

## Run

```bash
uvicorn app.main:app --reload --port 8002
```

## Dependencies

- PostgreSQL database: `medivault_records_admin`
- MinIO bucket: `medivault-attachments`
