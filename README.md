# MediVault Local Stack

This repo now contains:

- `back_end/records_service`
- `back_end/patient_summary_service`
- `back_end/attachment_service`
- `back_end/consult_orchestration_service`
- `front_end`
- Docker orchestration for PostgreSQL, pgAdmin 4, MinIO, all FastAPI services, and the static frontend

## Services

- Frontend: `http://localhost:8080`
- Records service: `http://localhost:8000`
- Patient summary service: `http://localhost:8001`
- Attachment service: `http://localhost:8002`
- Consult orchestration service: `http://localhost:8003`
- pgAdmin 4: `http://localhost:5050`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- PostgreSQL: `localhost:5432`

## Docker start

```bash
docker compose up --build
```

Run detached:

```bash
docker compose up --build -d
```

Stop everything:

```bash
docker compose down
```

Stop and remove database volumes too:

```bash
docker compose down -v
```

If you are switching to PostgreSQL 18 after an older local Docker Postgres setup, use `docker compose down -v` before starting again so the database can initialize with the new data directory layout.

## What To Install On macOS

For this local stack, you only need:

- `Docker Desktop for Mac`

Optional but helpful:

- `pgAdmin 4` desktop app

You do not need AWS S3 or GCS for attachments. MinIO is included in Docker and acts as local S3-compatible object storage.

## Default Docker credentials

### PostgreSQL

- database: `medivault_records_admin`
- username: `rexlopper`
- password: `bryitkids`

### pgAdmin 4

- email: `admin@medivault.app`
- password: `admin`

### MinIO

- access key: `minioadmin`
- secret key: `minioadmin`
- bucket: `medivault-attachments`

## pgAdmin connection values

When adding the Docker PostgreSQL server in pgAdmin, use:

- Name: `medivault`
- Host: `postgres`
- Port: `5432`
- Maintenance database: `medivault_records_admin`
- Username: `rexlopper`
- Password: `bryitkids`

If you are using pgAdmin outside Docker on your host machine, use:

- Name: `medivault`
- Host: `localhost`
- Port: `5432`
- Maintenance database: `medivault_records_admin`
- Username: `rexlopper`
- Password: `bryitkids`

## Frontend demo

Login:

```text
http://localhost:8080/login.html
```

Open:

```text
http://localhost:8080/intake-demo.html
```

Doctor-facing queue:

```text
http://localhost:8080/doctor-dashboard.html
```

Doctor pre-visit summary:

```text
http://localhost:8080/previsit-summary.html
```

Doctor AI note assistant:

```text
http://localhost:8080/ai-note-assistant.html
```

Doctor review & approve:

```text
http://localhost:8080/review-approve.html
```

Doctor saved record:

```text
http://localhost:8080/saved-record.html
```

Default test URLs in the page:

- records service: `http://127.0.0.1:8000`
- patient summary service: `http://127.0.0.1:8001`

The intake demo will:

1. create a patient in `records_service`
2. create a versioned patient summary in `patient_summary_service`
3. create an encounter in `records_service`
4. create a consult session in `consult_orchestration_service`
5. create a draft intake note in `records_service`
6. optionally upload a supporting attachment to MinIO through `attachment_service`

## API docs

- Records service Swagger: `http://localhost:8000/docs`
- Patient summary Swagger: `http://localhost:8001/docs`
- Attachment service Swagger: `http://localhost:8002/docs`
- Consult orchestration Swagger: `http://localhost:8003/docs`
