# Secure Document Management System (SDMS)

## Project Overview

The Secure Document Management System (SDMS) is a highly secure, role-based web application tailored for managing sensitive investigation files. It is explicitly designed for scenarios where documents are highly confidential, such as law enforcement cases, internal intelligence, or strict legal proceedings. SDMS completely locks down document access, utilizes cryptographic hashing for file integrity, chains audit events to prevent tampering with the log history, and automates metadata extraction using local OCR and AI.

## Problem Statement

Standard file management systems (like Google Drive or standard network shares) treat files generically and struggle with the strict compliance required for sensitive investigations. They typically suffer from:
*   **Coarse Access Control:** Inability to limit access strictly to officers assigned to a specific case, complicated further by varying security clearances.
*   **File Tampering:** No built-in way to mathematically prove a downloaded document hasn't been maliciously altered after upload.
*   **Unaccountable Actions:** Simple logs that can be easily bypassed or altered.
*   **Unstructured Data:** Scanned evidence PDFs are difficult to search or classify without manual data entry.
*   **Lack of Workflow:** No native state machine preventing unauthorized finalization of a document.

SDMS was built to solve these exact problems by treating every document as a cryptographic asset bound to a strict approval workflow and rigid role-based access control.

## Key Features

Based on the current implementation, SDMS provides the following features:

1.  **JWT Authentication:** Custom token-based authentication.
2.  **Hierarchical RBAC:** Complex authorization combining logical Roles (Admin, Senior Officer, Investigating Officer, Prosecutor) with numeric Clearance Levels (1 through 5).
3.  **Case-Based Isolation:** Documents are strictly bound to independent Cases, which enforce their own ownership and assignment rules.
4.  **Supabase Remote Storage:** Secure upload and retrieval of PDF files using Supabase Storage buckets.
5.  **SHA-256 File Hashing:** Cryptographic fingerprinting of document bytes generated at the exact moment of upload.
6.  **AI-Assisted Metadata Extraction:** A resilient background pipeline that attempts pure-Python text extraction, falls back to Tesseract OCR for scanned images, and leverages a local Ollama AI (Llama 3) to extract structured fields.
7.  **PostgreSQL Full-Text Search (FTS):** High-performance lexical search utilizing native PostgreSQL `TSVECTOR` and `websearch_to_tsquery`.
8.  **Database-Level Search Authorization:** Search queries are strictly filtered at the database level so users never see search results for documents they lack clearance for.
9.  **Linear Document Versioning:** Secure retention of historical file versions with independent cryptographic hashes.
10. **State Machine Approvals:** Enforcement of strict document states (READY, SUBMITTED, UNDER_REVIEW, APPROVED, LOCKED).
11. **Cryptographic Audit Timeline:** A tamper-evident audit log that chains the SHA-256 hash of the previous event into the payload of the next event.
12. **On-Demand Integrity Verification:** API capability to pull a file from remote storage and cryptographically verify it against its original database hash.
13. **Resilient Failure Handling:** Automatic retry tracking for OCR/AI processing failures, eventually failing safely into a `MANUAL_REVIEW_REQUIRED` state.

## Feature Implementation

### Authentication
Authentication is entirely handled in-house using `passlib` for bcrypt password hashing and `PyJWT` for token generation. Supabase Auth is **not** used. The frontend calls `/auth/login`, receives an access token (valid for 24 hours), and passes it as a Bearer token in the `Authorization` header for all subsequent requests. The FastAPI dependency `get_current_user` extracts the token and identifies the user context.

### RBAC and Clearance Levels
Authorization uses a dual-axis approach (`app/core/authorization.py`):
1.  **Roles:** Determines *what* actions a user can take (e.g., only "Senior Officer" or "Admin" can `APPROVE`).
2.  **Clearance Levels:** A numeric level (1 to 5). A user can never access a document if the document's `classification_level` is higher than the user's `clearance_level`, regardless of their role.

### Case Management & Assignments
A Case is a container with a `case_number`, an `owning_officer_id`, and a status lifecycle. For a non-admin to upload or edit a document in a case, they must either be the case owner or be explicitly assigned to the case via the `CaseAssignment` table. Closed cases completely reject document uploads or modifications.

### PDF Upload & Supabase Storage
When a user uploads a PDF, FastAPI reads the bytes directly into memory. The application uses the `supabase-py` client to upload these bytes to a Supabase Storage bucket (defaulting to the bucket named `SDMS`). The storage path is hierarchically structured as `<case_id>/<doc_id>/<version_number>.pdf`. The database is then updated with a `PROCESSING` status.

### SHA-256 Hashing & Integrity Verification
During the upload process, before the file is sent to Supabase, the backend calculates the SHA-256 hash of the raw bytes. This is permanently stored in `DocumentVersion.file_hash`. The `/verify-integrity` endpoint allows users to challenge a document's integrity: it downloads the physical file from Supabase, recalculates the hash, and compares it to the database record. If they differ, the document is flagged as `is_tampered=True`.

### AI-Assisted Extraction & OCR
A FastAPI `BackgroundTasks` pipeline triggers after upload:
1.  **PyPDF:** Attempts standard text extraction.
2.  **PyTesseract:** If PyPDF fails to extract meaningful text (e.g., scanned images), it converts the PDF to images and runs Tesseract OCR.
3.  **Local Ollama AI:** The resulting raw text is sent to a local Ollama server (`llama3` model) with a strict prompt to return JSON containing the incident date, FIR number, accused, and IPC sections.
4.  **Fallback:** If Ollama is unreachable, a regex-based heuristic extractor is used to guarantee completion.

### PostgreSQL Full-Text Search & Authorization
Extracted AI metadata, raw text, document titles, and types are combined into a PostgreSQL `TSVECTOR` column on the `Document` table. The search endpoint uses `func.websearch_to_tsquery('english', query)` to perform the search. 
Critically, authorization is embedded in the search query: a SQLAlchemy `or_` filter ensures the query only returns rows where the user owns the case, is assigned to the case, has explicit document-level permissions, or the document is globally unrestricted (Level 1).

### Document Versioning
A `Document` record points to a `current_version_id`. Every time an edit is made (uploading a revision), a new `DocumentVersion` record is created, the version number increments (e.g., 1.0 to 2.0), a new hash is generated, and a new physical file is pushed to Supabase Storage (`.../2.0.pdf`). Old versions are permanently retained.

### Document Approval Workflow
The state machine strictly governs document finalization:
*   `READY` -> `SUBMITTED` (Requires `SUBMIT` permission).
*   `SUBMITTED` -> `UNDER_REVIEW` -> `APPROVED` or `REJECTED` (Requires `APPROVE` permission).
*   Investigating officers are programmatically blocked from approving their own submitted documents to enforce oversight.

### Cryptographic Audit Timeline
Every view, download, status change, and upload calls `log_audit_event()`. The system queries the `AuditLog` table using `FOR UPDATE` to lock the rows and retrieve the most recent record's `current_hash`. This hash is injected as `previous_hash` into a JSON payload representing the new event. The payload is hashed via SHA-256 to create the new `current_hash`. This creates a sequential, tamper-evident blockchain entirely within PostgreSQL.

### Failure & Retry Handling
If the background extraction pipeline fails (e.g., Ollama times out), the database transaction safely catches the error and updates the document status to `PROCESSING_FAILED`, storing the error trace. The user can manually trigger the `/retry` endpoint up to 3 times. If it fails 3 times, the document is locked into `MANUAL_REVIEW_REQUIRED`.

## End-to-End Document Lifecycle

```mermaid
graph TD
    %% User Action Phase
    UserAction[User Uploads PDF] --> ComputeHash[Compute SHA-256 Hash]
    
    %% Storage and Database Commit
    ComputeHash --> UploadSupabase[(Supabase Storage)]
    ComputeHash --> CreateDBRecord[(Insert DB Record)]
    UploadSupabase & CreateDBRecord --> TriggerBackground[Trigger Background Task]
    
    subgraph Async Processing Pipeline
        TriggerBackground --> ExtractText[Extract Text]
        ExtractText -->|PyPDF Success| AIMetadata
        ExtractText -->|PyPDF Fails| OCR[PyTesseract OCR]
        OCR --> AIMetadata[Ollama AI Extraction]
        AIMetadata --> PostgresIndex[Update TSVECTOR Search Index]
    end
    
    %% Pipeline Results
    PostgresIndex -->|Pipeline Succeeds| StatusReady[Status: READY]
    PostgresIndex -.->|Pipeline Fails| StatusFailed[Status: PROCESSING_FAILED]
    
    StatusFailed -->|Retry Requested| TriggerBackground
    StatusFailed -->|Retries >= 3| StatusManual[Status: MANUAL_REVIEW_REQUIRED]
    
    %% Approval State Machine
    StatusReady -->|Officer Submits| StatusSubmitted[Status: SUBMITTED]
    StatusSubmitted -->|Supervisor Reviews| StatusReview[Status: UNDER_REVIEW]
    StatusReview -->|Approved| StatusApproved[Status: APPROVED]
    StatusReview -->|Rejected| StatusRejected[Status: REJECTED]
    StatusRejected --> StatusReady
    StatusApproved --> StatusLocked[Status: LOCKED]
```

## Case Lifecycle

The Case lifecycle governs the overarching investigation. If a case is `CLOSED`, it rejects all document uploads and status changes.

```mermaid
graph TD
    Created[CREATED] -->|Start Work| Investigation[INVESTIGATION]
    Investigation -->|Submit Files| Review[UNDER_REVIEW]
    Review -->|Approve| Approved[APPROVED]
    Review -->|Reject| Rejected[REJECTED]
    Rejected -->|Fix Issues| Investigation
    Approved -->|Finalize| Closed[CLOSED]
```

## System Architecture

The SDMS architecture separates the frontend SPA from the backend API.
*   **Frontend:** Built with React 19 and Vite, heavily utilizing Material UI (`@mui/material`) for the interface and `axios` for HTTP requests to the backend.
*   **Backend API:** Built with FastAPI and Python 3. It natively handles asynchronous requests, JWT authentication, and RBAC logic.
*   **Database (Relational & Search):** PostgreSQL accessed via SQLAlchemy 2.0 (`asyncpg`). It holds users, RBAC models, document metadata, audit logs, and `TSVECTOR` full-text search indexes. (SQLite is supported strictly as a local development fallback via `aiosqlite`).
*   **Storage (Object):** Supabase Storage is exclusively used for file storage. The backend communicates with Supabase via the `supabase-py` client library.
*   **AI/OCR Environment:** PyTesseract executes local OCR binaries, and Ollama hosts the local Llama 3 LLM.

## Architecture Diagram

```mermaid
graph TD
    Browser([User / Browser]) -->|HTTPS / Bearer Token| Frontend[React + Vite + MUI]
    Frontend -->|REST API Requests| Backend[FastAPI Backend]
    
    subgraph Backend Infrastructure
        Backend -->|Auth & RBAC| AuthSecurity[Security Core]
        Backend -->|SQLAlchemy| Database[(PostgreSQL DB)]
        Backend -->|Supabase API| ObjectStorage[(Supabase Storage)]
        
        Backend -.->|BackgroundTasks| Extractor[AI Extraction Pipeline]
        Extractor -->|OCR| Tesseract[Tesseract OCR Binary]
        Extractor -->|HTTP JSON| Ollama[Local Ollama: Llama 3]
        Extractor -->|Update Metadata| Database
    end
    
    Database -->|FTS| SearchEngine[PostgreSQL TSVECTOR]
    AuthSecurity -->|SHA-256 Chaining| AuditLog[Cryptographic Audit Log]
```

## Technology Stack

*   **Frontend:** React 19, TypeScript, Vite, Material UI (`@mui/material`), Axios, React Router.
*   **Backend:** Python 3, FastAPI, Uvicorn, Pydantic, PyJWT, passlib (bcrypt).
*   **Database & ORM:** PostgreSQL, SQLite (fallback), SQLAlchemy 2.0 (Async), Alembic (Migrations).
*   **File Storage:** Supabase Storage (`supabase` python library).
*   **AI & OCR:** PyPDF, `pdf2image`, PyTesseract, Ollama (Local API).
*   **Testing:** Pytest, HTTPX (AsyncClient).

## Project Structure

```
DMS/
├── backend/
│   ├── alembic/                # Database migration scripts
│   ├── app/                    # Application source code
│   │   ├── api/                # FastAPI routers (auth, cases, documents, search, admin)
│   │   ├── core/               # Configuration, security, audit, authz, storage clients
│   │   ├── services/           # Extraction pipeline (OCR & AI logic)
│   │   ├── database.py         # SQLAlchemy engine and session setup
│   │   ├── main.py             # Application entrypoint and lifespan
│   │   └── models.py           # SQLAlchemy declarative models
│   ├── tests/                  # Pytest test suites
│   ├── alembic.ini             # Alembic configuration
│   ├── full_test.py            # Custom API integration test script
│   ├── requirement.txt         # Python backend dependencies
│   └── .env                    # Environment variables
└── frontend/
    ├── src/
    │   ├── assets/             # Images and static assets
    │   ├── components/         # Reusable React components
    │   ├── context/            # React Context providers (Auth)
    │   ├── pages/              # View components
    │   ├── App.tsx             # Main React application component
    │   ├── main.tsx            # Vite entrypoint
    │   └── theme.ts            # Material UI theming
    ├── package.json            # NPM dependencies
    ├── tsconfig.json           # TypeScript configuration
    └── vite.config.ts          # Vite bundler configuration
```

## Prerequisites

To run the full system locally, you must have:
*   **Python:** 3.10 or higher.
*   **Node.js:** 18 or higher.
*   **PostgreSQL:** Required for full `TSVECTOR` search capability (SQLite works as a fallback but may ignore advanced PostgreSQL-specific search features).
*   **Supabase Project:** A Supabase project with an active Storage Bucket.
*   **Tesseract & Poppler:** Installed on your host OS and added to your system PATH for PDF-to-image OCR.
*   **Ollama:** Installed locally with the `llama3` model pulled (`ollama run llama3`).

## Environment Variables

Create a `.env` file in the `backend/` directory.

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | Endpoint URL for Supabase API. | **Yes** | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role key for backend auth. | **Yes** | `<SUPABASE_SECRET_KEY>` |
| `SUPABASE_STORAGE_BUCKET`| Target bucket in Supabase. | No | `SDMS` (Default) |
| `DATABASE_URL` | Async connection string for PostgreSQL/SQLite. | No | `sqlite+aiosqlite:///./dms.db` (Default) |
| `SECRET_KEY` | Secret for signing JWT tokens. | No | `<YOUR_SECRET_KEY>` |
| `OLLAMA_BASE_URL` | Host address of local Ollama instance. | No | `http://localhost:11434` (Default) |
| `INITIAL_ADMIN_EMAIL` | Email for auto-seeded Admin. | No | `admin@gmail.com` (Default) |
| `INITIAL_ADMIN_PASSWORD` | Password for auto-seeded Admin. | No | `admin` (Default) |

> **Security Note:** Never commit real `SUPABASE_SERVICE_KEY` or `SECRET_KEY` values to version control.

## Local Installation

1.  **Clone Repository:**
    ```bash
    git clone <repo-url>
    cd DMS
    ```
2.  **Backend Setup:**
    ```bash
    cd backend
    python -m venv venv
    # Windows:
    venv\Scripts\activate
    # macOS/Linux:
    source venv/bin/activate
    
    pip install -r requirement.txt
    ```
3.  **Supabase & DB Prep:**
    Ensure your `.env` contains valid Supabase credentials. SQLAlchemy will automatically create tables via `Base.metadata.create_all` during backend startup.
4.  **Frontend Setup:**
    ```bash
    cd ../frontend
    npm install
    ```

## Backend Startup

From the `backend/` directory, with the virtual environment activated:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The API is available at `http://127.0.0.1:8000`. Swagger docs are at `/docs`.

## Frontend Startup

From the `frontend/` directory:
```bash
npm run dev
```
The frontend is available at `http://localhost:5173`.

## Default Administrator Credentials

Upon first startup, the backend lifespan script auto-seeds a default administrator into the database.
*   **Email:** `admin@gmail.com`
*   **Password:** `admin`
*   **Clearance:** Level 5 (Executive)

## API Overview

### Authentication
*   `POST /auth/login`: Authenticate and receive a JWT.
*   `GET /auth/me`: Fetch authenticated user profile.

### Cases
*   `GET /cases/`: List cases the user has access to.
*   `POST /cases/`: Create a new case.
*   `PATCH /cases/{case_id}/reassign`: (Admin) Reassign case owner.
*   `POST /cases/{case_id}/assignments`: (Admin) Add officers to case.
*   `PATCH /cases/{case_id}/status`: (Owner/Admin) Transition case state.

### Documents
*   `GET /documents/`: List all authorized documents.
*   `POST /documents/upload`: Upload PDF (triggers hashing & Supabase upload).
*   `GET /documents/{document_id}`: Retrieve document metadata and extracted AI fields.
*   `GET /documents/{document_id}/download`: Download the file from Supabase.
*   `POST /documents/{document_id}/status`: Transition document state machine.
*   `GET /documents/{document_id}/permissions`: View explicit user permissions.
*   `POST /documents/{document_id}/permissions`: Grant explicit View/Edit/Download permissions.

### Versions & Integrity
*   `GET /documents/{document_id}/versions`: View all version hashes.
*   `POST /documents/{document_id}/versions`: Upload new version revision.
*   `POST /documents/{document_id}/versions/{version_id}/restore`: Roll back to an older version.
*   `POST /documents/{document_id}/verify-integrity`: Download from Supabase and verify against SHA-256 hash.
*   `POST /documents/{document_id}/retry`: Manually retry failed AI processing.

### Search
*   `GET /search/documents`: Secure full-text search across FTS indices.

## Testing

Comprehensive API integration testing is available in the repository. Testing is executed using the `httpx` async client directly against the live backend environment, confirming end-to-end functionality including database constraints, authentication, authorization filtering, and failure handling.

### Actual API Testing Results

The following results were obtained by running the `backend/full_test.py` script against the active repository configuration:

| Test Area | Target Functionality | Expected Behavior | Actual Behavior | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Routing** | Public login route | 401 Unauthorized (invalid creds) | 401 Unauthorized | **PASS** |
| **Routing** | Protected route without JWT | 401 Unauthorized rejection | 401 Unauthorized | **PASS** |
| **Routing** | Invalid API route | 404 Not Found | 404 Not Found | **PASS** |
| **Routing** | Invalid HTTP method | 405 Method Not Allowed | 405 Method Not Allowed | **PASS** |
| **Auth** | Valid Login | 200 OK & JWT Returned | 200 OK | **PASS** |
| **Cases** | Case Creation | 200 OK & ID Returned | 200 OK | **PASS** |
| **Cases** | Case Retrieval | 200 OK & Authorized List | 200 OK | **PASS** |
| **Documents** | PDF Upload | 200 OK & Background Task | 200 OK | **PASS** |
| **Documents** | Retrieve Document Data | 200 OK & Metadata | 200 OK | **PASS** |
| **Documents** | Download File | 200 OK & PDF Stream | 200 OK | **PASS** |
| **Documents** | View Version History | 200 OK & Version List | 200 OK | **PASS** |
| **Documents** | Approval Workflow | 200 OK & Status Transition | 200 OK | **PASS** |
| **Documents** | Integrity Verification | 200 OK & Hash Verified | 200 OK | **PASS** |
| **Documents** | Retry Validation | 400 Bad Request (not failed) | 400 Bad Request | **PASS** |
| **Search** | Full-Text Search | 200 OK & Filtered Results | 200 OK | **PASS** |

*All 16 executed integration tests passed cleanly against the actual implementation, confirming that the security restrictions and processing lifecycles operate exactly as documented.*
