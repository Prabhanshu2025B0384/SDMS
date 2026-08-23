# 🛡️ Secure DMS — Zero-Cost Document Management System

A high-performance, open-source, zero-cost Document Management System (DMS) built for law enforcement, legal, and enterprise compliance workflows. It features **5-Level Clearance Hierarchy**, **Granular Multi-User Document Permissions**, **AI-Powered OCR & Metadata Extraction**, and **Cryptographically Hashed Audit Logging**.

---

## 🌟 Key Features

### 1. 🎖️ Organizational Clearance Hierarchy (Levels 1 to 5)
Enforces military/intelligence-grade access control across cases and documents:
- **Level 1 (Restricted)**: Constable / Junior Officers (General public record view).
- **Level 2 (Confidential)**: Sub-Inspectors (Standard investigation files).
- **Level 3 (Secret)**: Investigating Officers / Inspectors (Confidential case evidence).
- **Level 4 (Top Secret)**: Senior Officers / Superintendents of Police (Sensitive forensic dossiers).
- **Level 5 (Executive / Admin)**: System Directors & Admins (Unrestricted global system access).

### 2. 👥 Multi-User Document Permissions (Granular Sharing)
- Share sensitive documents with specific individual officers or multiple users simultaneously.
- Assign granular permissions: **`VIEW`**, **`DOWNLOAD`**, or **`EDIT`**.
- Explicit shares override hierarchy restrictions for authorized users while maintaining strict isolation for unauthorized personnel.
- Easy revocation of access rights by document owners and administrators.

### 3. 🧠 AI Metadata Extraction & OCR Pipeline
- Automatically extracts text from uploaded PDF documents.
- Uses local LLMs (**Ollama**) with a heuristic fallback engine to parse structured legal metadata:
  - FIR / Reference numbers
  - Incident dates & Police stations
  - Complainants & Accused entities
  - IPC / Legal Sections
- Generates SHA-256 integrity checksums for every document version to detect tampering.

### 4. 📜 Cryptographic Audit Logging & Access Intelligence
- Cryptographically tracks every critical action: `LOGIN`, `VIEW`, `DOWNLOAD`, `UPLOAD`, `SHARE`, `PASSWORD_CHANGE`.
- **Admin Audit Intelligence Dashboard**: Real-time analytics cards, event category filtering, and per-document chronological visitor & download history.

### 5. 👤 User Profile & Security Management
- User profile modal displaying avatar, role, department, and visual security clearance hierarchy rank.
- Self-service password change interface with password hashing (bcrypt).

---

## 🏗️ System Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │             React + TypeScript + Material-UI             │
   │               (Vite 8 Frontend on :5173)                │
   └───────────────────────────┬─────────────────────────────┘
                               │ HTTP / JWT Auth
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │               FastAPI Async Backend (:8000)             │
   │  ┌─────────────────┐ ┌────────────────┐ ┌────────────┐  │
   │  │ Hierarchy & RBAC│ │ Granular Share │ │ Audit Logs │  │
   │  └─────────────────┘ └────────────────┘ └────────────┘  │
   └───────────────┬─────────────────────────┬───────────────┘
                   │                         │
     ┌─────────────▼────────────┐     ┌──────▼─────────────────────┐
     │  SQLite / PostgreSQL DB  │     │ Storage Engine (Local / S3)│
     │   (SQLAlchemy Async ORM) │     │    + OCR & AI Pipelines    │
     └──────────────────────────┘     └────────────────────────────┘
```

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 (Async), SQLite / PostgreSQL, PyJWT, Pydantic v2, Passlib (Bcrypt).
- **Frontend**: React 18, Vite 8, TypeScript, Material-UI (MUI v6), Lucide / MUI Icons, React Router v6.
- **Document Processing**: `pypdf`, `pdf2image`, `pytesseract`, and local LLM extraction (`ollama`).

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

---

### 1. Clone & Setup Backend

```powershell
# Navigate to the backend directory
cd backend

# Install Python dependencies
pip install -r requirement.txt

# Start the FastAPI backend server
python -m uvicorn app.main:app --reload --port 8000
```
> The backend server will be running at: **`http://127.0.0.1:8000`**  
> Interactive API Docs (Swagger UI): **`http://127.0.0.1:8000/docs`**

---

### 2. Setup & Start Frontend

```powershell
# Navigate to the frontend directory
cd ../frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
> The frontend application will be running at: **`http://localhost:5173`**

---

## 🔑 Default Administrator Credentials

Upon initial launch, the system seeds a default Executive Administrator account:

| Field | Value |
|---|---|
| **Email** | `admin12032008@gmail.com` |
| **Password** | `adminhumai` |
| **Role** | `Admin` |
| **Clearance Level** | `Level 5 (Executive / Admin)` |

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| **POST** | `/auth/login` | Authenticate user and receive JWT bearer token |
| **GET** | `/auth/me` | Get current user profile, role, department & clearance |
| **POST** | `/auth/change-password` | Change account password securely |
| **POST** | `/auth/signup` | Register a new officer account |
| **GET** | `/documents` | List all accessible documents for the logged-in user |
| **POST** | `/documents/upload` | Upload PDF with classification level & trigger OCR |
| **GET** | `/documents/{id}` | View document details & extracted AI metadata |
| **GET** | `/documents/{id}/download` | Download original PDF file (audited) |
| **GET** | `/documents/{id}/permissions` | List user permissions for a document |
| **POST** | `/documents/{id}/permissions` | Grant multi-user permissions (VIEW/DOWNLOAD/EDIT) |
| **DELETE**| `/documents/{id}/permissions/{uid}` | Revoke user document access |
| **GET** | `/cases` | List cases assigned to or owned by the user |
| **POST** | `/cases` | Create a new case file |
| **GET** | `/search/documents?query=...` | Full-text vector search across document contents |
| **GET** | `/admin/users` | (Admin) List all system users and clearance levels |
| **PATCH**| `/admin/users/{id}` | (Admin) Update user clearance, department, role |
| **GET** | `/admin/audit-logs` | (Admin) Fetch audit intelligence logs with metrics |
| **GET** | `/admin/documents/{id}/access-history` | (Admin) Chronological visitor & download history |

---

## 🧪 Running Automated Tests

Run the end-to-end test suite verifying hierarchy clearance, multi-user sharing, password change flows, and audit logs:

```powershell
cd backend
python tests/test_hierarchy_and_permissions.py
```

To test the frontend production build:
```powershell
cd frontend
npm run build
```

---

## 🔒 Security Best Practices
- Passwords are encrypted using salted `bcrypt` algorithms.
- Multi-factor-ready OAuth2 JWT bearer token authentication.
- Cryptographic hash chaining on audit logs ensuring unforgeable record logs.
- Automatic boundary checking preventing vertical hierarchy privilege escalations.

---

## 📄 License
This project is open-source and free to use under the MIT License.
