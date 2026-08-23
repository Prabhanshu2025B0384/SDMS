# Secure Document Management System (Zero Cost)

## 1. Project Overview
The Secure Document Management System (DMS) is a self-hosted, 100% free, and highly secure platform designed to handle the ingestion, processing, and long-term auditing of sensitive files, primarily tailored for law enforcement or internal investigations.

## 2. Problem Statement
Handling highly confidential documents requires absolute certainty of file integrity, strict role-based access control, detailed cryptographic audit trails, and efficient searchability. Traditional enterprise solutions are prohibitively expensive and often expose data to third-party SaaS clouds. This system solves these problems by providing an entirely on-premise (or local-first) deployment that incorporates AI-driven metadata extraction and strict hierarchy-based authorization at zero recurring cost.

## 3. Key Features
- **Hierarchical RBAC**: Clearance-level-based document access.
- **Cryptographic Audit Log**: Deterministic SHA-256 hash chains for all mutations.
- **AI-Assisted Processing**: Local Ollama-based structured data extraction.
- **PostgreSQL FTS**: Native Full-Text Search inside PostgreSQL utilizing `TSVECTOR`.
- **Integrity Verification**: Verifies document bytes against the expected `file_hash`.
- **Closed Case Enforcement**: Prevents modifications and uploads on cases marked as `CLOSED`.

## 4. Feature Implementation & Lifecycle

### 1. Authentication
**What it does:** Verifies user identity using email/password and issues stateless JWTs.
**Implementation:** Implemented in `backend/app/api/auth.py`. Uses `passlib` (bcrypt) for password hashing and `PyJWT` for token generation.
**Lifecycle:** User provides credentials -> `/auth/login` validates against `users` table -> Issues JWT -> Frontend stores token and passes via `Authorization: Bearer <token>` header.

### 2. Basic Hierarchical RBAC
**What it does:** Assigns roles (`Admin`, `Senior Officer`, `Investigating Officer`) and clearance levels (1 to 5).
**Implementation:** Defined in `backend/app/core/authorization.py`. `check_document_access` strictly enforces `user.clearance_level >= document.classification_level`. 

### 3. Case Management
**What it does:** Groups documents logically by a Case ID (e.g., FIRs, statements).
**Implementation:** `cases` table in PostgreSQL. Admins can globally assign/reassign cases in `AdminDashboard.tsx`.
**Lifecycle:** `POST /cases/` -> Case created -> Visible in dropdown -> Documents uploaded to Case.

### 4. Case-Level Access Assignment
**What it does:** Users can only upload or edit documents inside cases they own or are assigned to.
**Implementation:** `case_assignments` table maps multiple users to a single case. Admin assigns via `PATCH /cases/{id}/reassign` or `POST /cases/{id}/assignments`. 

### 5. PDF Upload
**What it does:** Stores physical PDF documents securely.
**Implementation:** Implemented in `backend/app/api/documents.py`. Saves PDF locally in `./storage` and kicks off `process_document_background` `BackgroundTasks`.

### 6. SHA-256 Hashing
**What it does:** Hashes the exact bytes of the PDF upon upload to maintain a forensic fingerprint.
**Implementation:** Handled via Python's `hashlib.sha256()`. Stored in `DocumentVersion.file_hash`.

### 7. AI-Assisted PDF Extraction
**What it does:** Extracts text (OCR) and maps it to structured JSON (FIR Number, incident date, suspects, etc.).
**Implementation:** `extract_text_from_pdf` (uses `pypdf`, falls back to `pytesseract`) -> `extract_structured_data_with_ollama` (calls local `Ollama`).

### 8. PostgreSQL Full-Text Search
**What it does:** Allows keyword searching across document text and titles.
**Implementation:** `Document.search_vector` uses native `TSVECTOR`. Queries use `websearch_to_tsquery` and `ts_rank` via Alembic migrations.

### 9. Search Authorization Filtering
**What it does:** Search only returns documents the user has clearance and permission to see.
**Implementation:** `get_authorized_document_filter(user)` returns a complex SQLAlchemy `or_` filter condition that is appended to the search query.

### 10. Document Versioning
**What it does:** Modifications to a document (new PDF) create a new sequential version (e.g., v1.0 -> v2.0) while preserving the old file and its hash.
**Implementation:** `DocumentVersion` table maps to `Document`. A new upload via `POST /documents/{id}/versions` inserts a new row and updates `Document.current_version_id`.

### 11. Document Approval Workflow
**What it does:** Status transitions (`SUBMITTED` -> `UNDER_REVIEW` -> `APPROVED` -> `LOCKED`).
**Implementation:** Handled in `update_document_status`. Investigating Officers cannot approve their own documents; Requires `Senior Officer` or `Admin`.

### 12. Audit Timeline
**What it does:** Cryptographically chained logs of every action performed.
**Implementation:** `backend/app/core/audit.py` canonicalizes the JSON payload and chains `previous_hash` with `current_hash`.

### 13. Integrity Verification
**What it does:** Checks if the stored file matches its historic hash.
**Implementation:** `POST /documents/{id}/verify-integrity` re-hashes local bytes and compares it to `file_hash`. Returns `VERIFIED` or `TAMPERED`.

### 14. Failure + Retry Handling
**What it does:** If AI or OCR fails during background processing, it logs failure and allows manual retry.
**Implementation:** `doc.status = PROCESSING_FAILED`. User triggers `POST /documents/{id}/retry`. Caps at 3 retries, then shifts to `MANUAL_REVIEW_REQUIRED`.

## 5. End-to-End Document Lifecycle
1. **Upload:** User hits `POST /upload`. File is stored in `./storage`, hashed, and initial `Document` and `DocumentVersion` DB records are created as `PROCESSING`.
2. **Background AI:** FastAPI `BackgroundTasks` calls Ollama. Extracts OCR and structured data.
3. **Indexing:** Updates `TSVECTOR` search vector. Status changes to `READY`.
4. **Approval:** IO submits document (`SUBMITTED`). Senior officer approves (`APPROVED`).
5. **Closing:** The Case is set to `CLOSED`. Subsequent `UPLOAD` or `EDIT` attempts on any document in the case are explicitly blocked by the backend (HTTP 400).

## 6. Case Lifecycle
- `CREATED` -> `INVESTIGATION`
- `INVESTIGATION` -> `UNDER_REVIEW`
- `UNDER_REVIEW` -> `APPROVED` or `REJECTED`
- `APPROVED` -> `CLOSED`
Modifications are permanently locked for `CLOSED` cases via `check_document_access(..., required_action="EDIT")`.

## 7. System Architecture
The system employs a monolithic backend (FastAPI) acting as a REST API for the Single-Page Application (React). The backend leverages PostgreSQL for both relational mapping (SQLAlchemy) and Full-Text Search. Asynchronous `BackgroundTasks` manage heavy OCR processing (Tesseract/Poppler) and local AI inferences (Ollama). 

## 8. Architecture Diagram
```mermaid
graph TD;
    Client[React Frontend] -->|HTTPS/JWT| FastAPI[FastAPI Backend];
    FastAPI <-->|asyncpg| PostgreSQL[(PostgreSQL DB)];
    FastAPI -->|os.write| LocalStorage[Local File System];
    FastAPI -->|Background Task| OCR[Tesseract / pypdf];
    OCR -->|Text| AI[Local Ollama Inference];
    AI -->|JSON| FastAPI;
    FastAPI -->|TSVECTOR| PostgreSQL;
```

## 9. Technology Stack
| Layer | Technology | Purpose |
| ----- | ---------- | ------- |
| Frontend | React + Vite | SPA Framework |
| UI/UX | Material UI v9 | Component library |
| Backend | Python 3 + FastAPI | High-performance async REST API |
| Database | PostgreSQL | Relational storage & FTS (`asyncpg`) |
| ORM | SQLAlchemy 2.0 | Async database operations |
| Migrations | Alembic | Schema version control |
| Auth | PyJWT + bcrypt | Secure stateless sessions |
| Storage | OS local / Boto3 | Storage abstraction |
| AI Extraction | Ollama (requests) | JSON metadata parsing |
| OCR | pytesseract, pdf2image | Non-selectable PDF parsing |

## 10. Project Structure
```text
DMS/
├── backend/
│   ├── alembic/       # DB Migrations
│   ├── app/
│   │   ├── api/       # Router Endpoints
│   │   ├── core/      # Security, Config, Audit, Auth logic
│   │   ├── services/  # AI Extraction and OCR logic
│   │   ├── main.py    # FastAPI Entrypoint
│   │   └── models.py  # SQLAlchemy schemas
│   └── storage/       # Local Document Storage
└── frontend/
    ├── src/
    │   ├── context/   # React Auth Context
    │   └── pages/     # React Views (AdminDashboard, Documents, Search)
```

## 11. Prerequisites
- Python 3.9+
- Node.js 18+ and `npm`
- PostgreSQL 15+ (Running locally or via Docker)
- Tesseract-OCR (must be installed on OS `apt install tesseract-ocr` or Windows installer)
- Poppler (must be installed on OS for `pdf2image`)
- Local Ollama Engine (optional for AI, fallback exists)

## 12. Configuration
All backend configuration is loaded via `pydantic_settings`. 
Frontend configuration uses standard Vite environment variables (or relies on hardcoded `window.location.hostname` local IPs for development).

## 13. Environment Variables (`backend/.env`)
```env
DATABASE_URL="postgresql+asyncpg://postgres:root@localhost:5432/secure_dms"
# Optional Overrides
# STORAGE_TYPE="s3"
# OLLAMA_BASE_URL="http://localhost:11434"
```

## 14. Database Setup
Ensure PostgreSQL is running. Create an empty database matching the URL string:
```sql
CREATE DATABASE secure_dms;
```

## 15. Storage Setup
The application automatically creates `./storage` in the `backend/` directory upon startup via `lifespan` hook.

## 16. OCR Setup
Ensure `tesseract` and `poppler-utils` are available in your system `PATH`.

## 17. AI Setup
Start Ollama in the background on port `11434` with the Llama 3 model installed:
```bash
ollama run llama3
```

## 18. Installation
Clone the repository.
```bash
git clone <repository_url>
cd DMS
```

## 19. Backend Startup
```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux
source venv/bin/activate

pip install -r requirement.txt
alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```
Swagger UI is available at `http://localhost:8000/docs`.

## 20. Frontend Startup
```bash
cd frontend
npm install
npm run dev
```
Accessible at `http://localhost:5173`.

## 21. Default Administrator Credentials
The application automatically seeds a default Admin upon first startup inside `app/main.py`:
- **Username:** `admin12032008@gmail.com`
- **Password:** `adminhumai`
- **Role:** Admin (Clearance Level 5)

## 22. API Endpoint Overview
| Method | Endpoint | Authentication | Authorization | Purpose |
| ------ | -------- | -------------- | ------------- | ------- |
| POST | `/auth/login` | None | None | JWT Issue |
| GET | `/auth/me` | JWT | Any | Get user profile |
| POST | `/auth/change-password` | JWT | Any | Update password |
| POST | `/auth/signup` | None | None | Register new user |
| GET | `/cases/` | JWT | Any | List cases |
| POST | `/cases/` | JWT | Any | Create case |
| PATCH | `/cases/{id}/reassign` | JWT | Admin | Transfer case ownership |
| POST | `/cases/{id}/assignments`| JWT | Admin | Add officer to case |
| PATCH | `/cases/{id}/status` | JWT | Owner/Admin | Change Case Status |
| GET | `/documents/` | JWT | Filtered | List accessible documents |
| POST | `/documents/upload` | JWT | Assigned/Admin| Upload new document |
| GET | `/documents/{id}` | JWT | Filtered | Document details |
| GET | `/documents/{id}/download` | JWT | Filtered | Get PDF file |
| POST | `/documents/{id}/versions`| JWT | Edit Perms | Upload new version |
| POST | `/documents/{id}/status` | JWT | Review Perms| Change Doc Status |
| GET | `/search/` | JWT | Filtered | FTS Postgres Search |
| GET | `/admin/users` | JWT | Admin | List all users |
| GET | `/admin/audit-logs` | JWT | Admin | View chained audit logs |

## 23. Authentication & Authorization
Uses robust stateless JWTs issued on login, transmitting user IDs to middleware.

## 24. RBAC
Roles determine capability boundaries (`Investigating Officer`, `Senior Officer`, `Admin`). Clearance levels determine exact hierarchical visibility bounds per document.

## 25. Case-Level Access Control
Isolated boundaries per case unless globally administered.

## 26. Search Authorization
PostgreSQL level filtering logic ensures that if a document doesn't match case assignments or explicit shares, it physically cannot be searched by the user.

## 27. Document Versioning
Append-only modifications prevent overwriting. 

## 28. Approval Workflow
Sequential state machine (SUBMITTED -> UNDER REVIEW -> APPROVED -> LOCKED).

## 29. Audit Timeline
Cryptographically validated. Changing historic entries breaks the hash chaining.

## 30. Integrity Verification
A manual endpoint `/verify-integrity` actively reads physical blocks and compares `sha256` results to expected database hashes.

## 31. Failure & Retry Handling
Intelligent state monitoring tags failed background OCR pipelines and limits retry attempts to avoid DoS.

## 32. Testing Methodology
- **Routing Testing:** Forced unauthenticated requests against the API to ensure `401 Unauthorized` cascades properly.
- **API Testing:** Executed automated integration scripts querying protected resources to verify business logic.
- **Security & Penetration Testing:** Assessed horizontal privilege escalation (BOLA/IDOR) by attempting to upload documents into cases owned by different users.

## 33. Routing Testing Results
- `/auth/login` and `/auth/signup` are successfully publicly available.
- All backend routes effectively return `401` when requests omit Bearer tokens.

## 34. API Testing Results
- Attempting to bypass Case assignments triggers a strict `HTTP 403`.
- Invalid routes gracefully return standard `HTTP 404`.
- AI Processing cleanly intercepts network errors and sets document statuses to `PROCESSING_FAILED` instead of crashing.

## 35. Penetration Testing Results
- **Authentication Bypass:** FAILED. JWTs are strictly validated via pyJWT algorithm.
- **IDOR / Cross-Case Uploads:** FAILED. Uploads verify `case.owning_officer_id` and explicit DB `case_assignments` before permitting storage writes.
- **Role Escalation:** FAILED. Junior users receive `HTTP 403` when attempting to access `/admin/users`.

## 36. Security Findings
*No Critical or High severity vulnerabilities were identified during standard local penetration testing. The API is inherently heavily gated.*

## 37. Known Limitations
- The system heavily relies on `asyncpg` concurrency. Large scale un-batched bulk uploads may bottleneck the local Ollama LLM if `BackgroundTasks` spin up too many parallel requests to port 11434.

## 38. Troubleshooting
- **Missing FTS Error:** Ensure you ran `alembic upgrade head` so the DB schema adds `TSVECTOR` correctly.
- **Cannot Upload Documents:** Verify your User Role is cleared for uploads AND that the Case is not in the `CLOSED` state.
- **OCR Not Working:** Install `tesseract-ocr` externally on the server host machine.
