# LunaLearn — API Contracts & Integration Specification

> **Target Audience**: P1 (Frontend), P2 (Backend & Academic Engine), P3 (AI & RAG Track).  
> **Status**: Active & Authoritative for Layers 2 & 3.

---

## 1. Overview & General Standards

- **Backend Base URL**: `http://localhost:4000`
- **Default Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <access_token>
  ```
- **Security & Data Isolation**:
  - Every non-public route requires the `Authorization: Bearer <token>` header.
  - All database queries are executed via PostgreSQL **Row-Level Security (RLS)**.
  - The `profile_id` is automatically injected from the verified session JWT — clients **must not** and cannot supply another student's `profile_id`.

---

## 2. Standard Response Envelopes

Every API response adheres to a consistent envelope structure:

### Single Item Response (200 OK / 201 Created)
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable confirmation"
}
```

### List Response (200 OK)
```json
{
  "success": true,
  "data": [ ... ],
  "count": 3,
  "message": "Optional human-readable confirmation"
}
```

### Error Response (400 / 401 / 404 / 500)
```json
{
  "success": false,
  "error": "ValidationError | Unauthorized | NotFound | DatabaseError",
  "message": "Human readable detail describing what went wrong",
  "issues": [
    {
      "field": "name",
      "message": "Subject name is required"
    }
  ]
}
```

---

## 3. Authentication Routes (`/api/auth`)

### 3.1 Sign Up
- **Method**: `POST`
- **Path**: `/api/auth/signup`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "aarav@example.com",
    "password": "password123",
    "full_name": "Aarav Verma",
    "course": "B.Tech",
    "semester": 4
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Account created successfully",
    "user": {
      "id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
      "email": "aarav@example.com",
      "created_at": "2026-09-24T18:00:00.000Z"
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1Ni...",
      "refresh_token": "dGhpcy1pcy1yZWZyZXNo...",
      "expires_in": 3600,
      "token_type": "bearer"
    },
    "profile": {
      "id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
      "email": "aarav@example.com",
      "full_name": "Aarav Verma",
      "avatar_url": null,
      "course": "B.Tech",
      "semester": 4,
      "xp": 0,
      "level": 1,
      "preferred_focus_time": "Evenings",
      "created_at": "2026-09-24T18:00:00.000Z",
      "updated_at": "2026-09-24T18:00:00.000Z"
    }
  }
  ```

### 3.2 Login
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "aarav@example.com",
    "password": "password123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "user": {
      "id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
      "email": "aarav@example.com",
      "created_at": "2026-09-24T18:00:00.000Z"
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1Ni...",
      "refresh_token": "dGhpcy1pcy1yZWZyZXNo...",
      "expires_in": 3600,
      "token_type": "bearer"
    },
    "profile": {
      "id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
      "full_name": "Aarav Verma",
      "course": "B.Tech",
      "semester": 4,
      "xp": 2480,
      "level": 8
    }
  }
  ```

### 3.3 Current Student Profile
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Auth**: Protected (`Bearer <token>`)
- **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
      "email": "aarav@example.com",
      "created_at": "2026-09-24T18:00:00.000Z"
    },
    "profile": {
      "id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
      "email": "aarav@example.com",
      "full_name": "Aarav Verma",
      "course": "B.Tech",
      "semester": 4,
      "xp": 2480,
      "level": 8,
      "preferred_focus_time": "Evenings"
    }
  }
  ```

### 3.4 Logout
- **Method**: `POST`
- **Path**: `/api/auth/logout`
- **Auth**: Protected (`Bearer <token>`)
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

## 4. Subjects CRUD (`/api/subjects`)

### 4.1 List Subjects
- **Method**: `GET`
- **Path**: `/api/subjects`
- **Auth**: Protected
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "profile_id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
        "name": "Database Management",
        "code": "DBMS",
        "color": "#6C4CE8",
        "created_at": "2026-09-24T18:00:00.000Z",
        "updated_at": "2026-09-24T18:00:00.000Z"
      }
    ]
  }
  ```

### 4.2 Create Subject
- **Method**: `POST`
- **Path**: `/api/subjects`
- **Auth**: Protected
- **Request Body**:
  ```json
  {
    "name": "Database Management",
    "code": "DBMS",
    "color": "#6C4CE8"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Subject created successfully",
    "data": {
      "id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
      "profile_id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
      "name": "Database Management",
      "code": "DBMS",
      "color": "#6C4CE8",
      "created_at": "2026-09-24T18:00:00.000Z",
      "updated_at": "2026-09-24T18:00:00.000Z"
    }
  }
  ```

### 4.3 Get Single Subject
- **Method**: `GET`
- **Path**: `/api/subjects/:id`
- **Auth**: Protected

### 4.4 Update Subject
- **Method**: `PATCH`
- **Path**: `/api/subjects/:id`
- **Auth**: Protected
- **Request Body** *(at least one required)*:
  ```json
  {
    "name": "Advanced Database Management",
    "color": "#4B2DB8"
  }
  ```

### 4.5 Delete Subject
- **Method**: `DELETE`
- **Path**: `/api/subjects/:id`
- **Auth**: Protected
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Subject deleted successfully",
    "data": {
      "deletedId": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a"
    }
  }
  ```

---

## 5. Units CRUD (`/api/units`)

### 5.1 List Units
- **Method**: `GET`
- **Path**: `/api/units?subject_id=<uuid>` *(optional query filter)*
- **Auth**: Protected
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 2,
    "data": [
      {
        "id": "u1-uuid",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "unit_number": 3,
        "title": "Unit 3 · Normalization",
        "created_at": "2026-09-24T18:00:00.000Z"
      },
      {
        "id": "u2-uuid",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "unit_number": 4,
        "title": "Unit 4 · Transactions",
        "created_at": "2026-09-24T18:00:00.000Z"
      }
    ]
  }
  ```

### 5.2 Create Unit
- **Method**: `POST`
- **Path**: `/api/units`
- **Auth**: Protected
- **Request Body**:
  ```json
  {
    "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
    "unit_number": 3,
    "title": "Unit 3 · Normalization"
  }
  ```

### 5.3 Update Unit
- **Method**: `PATCH`
- **Path**: `/api/units/:id`
- **Request Body**:
  ```json
  {
    "title": "Unit 3 · Normalization & BCNF"
  }
  ```

### 5.4 Delete Unit
- **Method**: `DELETE`
- **Path**: `/api/units/:id`

---

## 6. Topics CRUD (`/api/topics`)

### 6.1 List Topics
- **Method**: `GET`
- **Path**: `/api/topics?unit_id=<uuid>` *(optional query filter)*
- **Auth**: Protected
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "t1-uuid",
        "unit_id": "u1-uuid",
        "title": "3NF & BCNF",
        "status": "in_progress",
        "is_weak": true,
        "mastery_score": 45.0,
        "created_at": "2026-09-24T18:00:00.000Z"
      }
    ]
  }
  ```

### 6.2 Create Topic
- **Method**: `POST`
- **Path**: `/api/topics`
- **Request Body**:
  ```json
  {
    "unit_id": "u1-uuid",
    "title": "3NF & BCNF",
    "status": "in_progress",
    "is_weak": true,
    "mastery_score": 45.0
  }
  ```

### 6.3 Update Topic
- **Method**: `PATCH`
- **Path**: `/api/topics/:id`
- **Request Body**:
  ```json
  {
    "status": "completed",
    "is_weak": false,
    "mastery_score": 85.0
  }
  ```

### 6.4 Delete Topic
- **Method**: `DELETE`
- **Path**: `/api/topics/:id`

---

## 7. Tasks CRUD (`/api/tasks`)

### 7.1 List Tasks
- **Method**: `GET`
- **Path**: `/api/tasks?subject_id=<uuid>&is_completed=false` *(optional filters)*
- **Auth**: Protected
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "task-1-uuid",
        "profile_id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "title": "Normalize the library schema",
        "type": "Assignment",
        "priority": "High",
        "due_date": "2026-09-24T18:00:00.000Z",
        "is_completed": false,
        "completed_at": null,
        "created_at": "2026-09-24T18:00:00.000Z"
      }
    ]
  }
  ```

### 7.2 Create Task
- **Method**: `POST`
- **Path**: `/api/tasks`
- **Request Body**:
  ```json
  {
    "title": "Normalize the library schema",
    "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
    "type": "Assignment",
    "priority": "High",
    "due_date": "2026-09-24T18:00:00.000Z",
    "is_completed": false
  }
  ```

### 7.3 Update Task
- **Method**: `PATCH`
- **Path**: `/api/tasks/:id`
- **Request Body**:
  ```json
  {
    "is_completed": true
  }
  ```

### 7.4 Delete Task
- **Method**: `DELETE`
- **Path**: `/api/tasks/:id`

---

## 8. Exams CRUD (`/api/exams`)

### 8.1 List Exams
- **Method**: `GET`
- **Path**: `/api/exams?subject_id=<uuid>` *(optional query filter)*
- **Auth**: Protected
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "exam-1-uuid",
        "profile_id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "title": "DBMS Mid-semester",
        "exam_date": "2026-09-30T09:30:00.000Z",
        "target_score": 85.0,
        "created_at": "2026-09-24T18:00:00.000Z"
      }
    ]
  }
  ```

### 8.2 Create Exam
- **Method**: `POST`
- **Path**: `/api/exams`
- **Request Body**:
  ```json
  {
    "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
    "title": "DBMS Mid-semester",
    "exam_date": "2026-09-30T09:30:00.000Z",
    "target_score": 85.0
  }
  ```

### 8.3 Update Exam
- **Method**: `PATCH`
- **Path**: `/api/exams/:id`

### 8.4 Delete Exam
- **Method**: `DELETE`
- **Path**: `/api/exams/:id`

---

## 9. Materials Metadata CRUD (`/api/materials`)

> **Track Note**: File uploading to storage and chunk embeddings are owned by **P3 (AI/RAG)**. P2 provides this metadata API to index and query material assets.

### 9.1 List Materials
- **Method**: `GET`
- **Path**: `/api/materials?subject_id=<uuid>&unit_id=<uuid>` *(optional filters)*
- **Auth**: Protected
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "mat-1-uuid",
        "profile_id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "unit_id": "u1-uuid",
        "name": "Normalization Unit 3.pdf",
        "storage_path": "materials/dbms/normalization_unit3.pdf",
        "file_type": "PDF",
        "size_bytes": 2457600,
        "processed": true,
        "created_at": "2026-09-24T18:00:00.000Z"
      }
    ]
  }
  ```

### 9.2 Create Material Metadata
- **Method**: `POST`
- **Path**: `/api/materials`
- **Request Body**:
  ```json
  {
    "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
    "unit_id": "u1-uuid",
    "name": "Normalization Unit 3.pdf",
    "storage_path": "materials/dbms/normalization_unit3.pdf",
    "file_type": "PDF",
    "size_bytes": 2457600,
    "processed": false
  }
  ```

### 9.3 Update Material Metadata
- **Method**: `PATCH`
- **Path**: `/api/materials/:id`
- **Request Body**:
  ```json
  {
    "name": "Normalization Unit 3 - Revised.pdf",
    "processed": true
  }
  ```

### 9.4 Delete Material Metadata
- **Method**: `DELETE`
- **Path**: `/api/materials/:id`

---

## 10. Academic Engine Contracts Preview (Layer 4)

For P1 (Dashboard widgets) and P3 (Planner & AI assistant inputs):

### Readiness Formula
$$\text{Readiness} = (\text{TopicCompletion} \times 0.40) + (\text{QuizPerformance} \times 0.30) + (\text{RevisionActivity} \times 0.20) + (\text{AssignmentCompletion} \times 0.10)$$

### Risk Object Standard
Every academic risk object follows `{ type, reason, severity }`:
```typescript
interface AcademicRisk {
  type: 'HIGH_EXAM_RISK' | 'DEADLINE_RISK' | 'PERFORMANCE_RISK' | 'WORKLOAD_RISK';
  reason: string;     // Explicit human-readable explanation, never a bare label
  severity: 'high' | 'medium' | 'low';
  subject_id?: string;
  metadata?: Record<string, unknown>;
}
```
Example Risk Payload:
```json
{
  "type": "HIGH_EXAM_RISK",
  "reason": "DBMS Mid-semester is in 6 days and 2 critical topics (Normalization, Transactions) are marked as weak.",
  "severity": "high",
  "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a"
}
```
