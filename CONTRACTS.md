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

## 10. Academic Engine Contracts (Phase 4)

Pure, deterministic mathematical and rule calculations with zero AI/LLM calls. Available for frontend dashboards, study plan generators, and revision prioritizers.

### 10.1 Mathematical Formulas & Rules

#### 1. Readiness Formula
$$\text{Readiness} = (\text{TopicCompletion} \times 0.40) + (\text{QuizPerformance} \times 0.30) + (\text{RevisionActivity} \times 0.20) + (\text{AssignmentCompletion} \times 0.10)$$

- **Topic Completion (40%)**: $(\text{Completed Topics} / \text{Total Topics}) \times 100$. If 0 topics exist, defaults to 0%.
- **Quiz Performance (30%)**: Average score (0–100%) of recent quiz attempts for the subject. If no quizzes taken, defaults to 0%.
- **Revision Activity (20%)**: Total logged study session duration in minutes measured against a 120-minute benchmark: $\min(100, (\text{duration} / 120) \times 100)$.
- **Assignment Completion (10%)**: $(\text{Completed Assignments} / \text{Total Assignments}) \times 100$. If 0 assignments are registered for the subject, defaults to 100% (no outstanding assignment debt).

#### 2. Reasoned Risk Rules
Every detected risk adheres strictly to `{ type, reason, severity, subject_id?, metadata? }`:
- **`HIGH_EXAM_RISK`**: Triggered when an exam is scheduled $\le 7$ days away and $\ge 2$ topics remain unfinished or marked weak. Severity: `high`.
- **`DEADLINE_RISK`**: Triggered when an assignment is pending and due within 2 days (48 hours). Severity: `high` (if $\le 24$ hours) or `medium` (if $24 < \text{hours} \le 48$).
- **`PERFORMANCE_RISK`**: Triggered when recent quiz performance drops by $\ge 10\%$ between attempts or falls below 60%. Severity: `high` (if $< 50\%$) or `medium` (if $50 \le \text{score} < 60\%$).
- **`WORKLOAD_RISK`**: Triggered when $\ge 2$ assignment deadlines or exams fall on the exact same calendar date. Severity: `high` (if $\ge 3$ deadlines) or `medium` (if 2 deadlines).

---

### 10.2 Get Subject Readiness
- **Method**: `GET`
- **Path**: `/api/readiness/:subjectId`
- **Auth**: Protected (Requires Bearer JWT)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
      "readiness_percentage": 59,
      "breakdown": {
        "topic_completion": 50,
        "quiz_performance": 80,
        "revision_activity": 25,
        "assignment_completion": 100
      },
      "risks": [
        {
          "type": "HIGH_EXAM_RISK",
          "reason": "Exam 'DBMS Mid-semester' is in 3 days, but 2 topics (B+ Trees, Transactions) remain unfinished or weak.",
          "severity": "high",
          "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
          "metadata": {
            "exam_id": "exam-1-uuid",
            "days_away": 3,
            "unfinished_count": 2
          }
        }
      ]
    }
  }
  ```

### 10.3 Get All Subjects Readiness
- **Method**: `GET`
- **Path**: `/api/readiness`
- **Auth**: Protected (Requires Bearer JWT)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 2,
    "data": [
      {
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "readiness_percentage": 59,
        "breakdown": {
          "topic_completion": 50,
          "quiz_performance": 80,
          "revision_activity": 25,
          "assignment_completion": 100
        },
        "risks": []
      },
      {
        "subject_id": "d2e7f4b9-5c3f-5b0a-9f3c-2b3d4e5f6a7b",
        "readiness_percentage": 92,
        "breakdown": {
          "topic_completion": 100,
          "quiz_performance": 90,
          "revision_activity": 85,
          "assignment_completion": 100
        },
        "risks": []
      }
    ]
  }
  ```

---

### 10.4 Get Subject Risks
- **Method**: `GET`
- **Path**: `/api/risks/:subjectId`
- **Auth**: Protected (Requires Bearer JWT)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 2,
    "data": [
      {
        "type": "DEADLINE_RISK",
        "reason": "Assignment 'Normalization Exercise' is pending and due in 18 hours.",
        "severity": "high",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "metadata": {
          "task_id": "task-1-uuid",
          "hours_remaining": 18
        }
      },
      {
        "type": "PERFORMANCE_RISK",
        "reason": "Recent quiz scores have declined by 15% (from 85% down to 70%).",
        "severity": "medium",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "metadata": {
          "latestScore": 70,
          "previousScore": 85,
          "drop": 15
        }
      }
    ]
  }
  ```

### 10.5 Get All Student Risks
- **Method**: `GET`
- **Path**: `/api/risks`
- **Auth**: Protected (Requires Bearer JWT)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 3,
    "data": [
      {
        "type": "HIGH_EXAM_RISK",
        "reason": "Exam 'DBMS Mid-semester' is in 3 days, but 2 topics (B+ Trees, Transactions) remain unfinished or weak.",
        "severity": "high",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "metadata": {
          "exam_id": "exam-1-uuid",
          "days_away": 3,
          "unfinished_count": 2
        }
      },
      {
        "type": "DEADLINE_RISK",
        "reason": "Assignment 'Normalization Exercise' is pending and due in 18 hours.",
        "severity": "high",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "metadata": {
          "task_id": "task-1-uuid",
          "hours_remaining": 18
        }
      },
      {
        "type": "WORKLOAD_RISK",
        "reason": "2 competing deadlines coincide on 2026-09-28: Normalization Exercise and Exam: Operating Systems Quiz.",
        "severity": "medium",
        "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "metadata": {
          "date": "2026-09-28",
          "count": 2,
          "titles": ["Normalization Exercise", "Exam: Operating Systems Quiz"]
        }
      }
    ]
  }
  ```

---

## 11. Adaptive Planner Unified Context (Phase 5)

Packages everything the adaptive planner and AI/RAG track needs in a **single call**, eliminating the need for five separate HTTP roundtrips across exams, topics, tasks, settings, and quizzes.

### 11.1 Get Adaptive Planner Context
- **Method**: `GET`
- **Path**: `/api/planner/context` *(optional filter: `?subject_id=<uuid>` or `/api/planner/context/:subjectId`)*
- **Auth**: Protected (Requires Bearer JWT)
- **Description**: Deterministically aggregates the student's study availability, per-subject exam dates with countdowns, weak/unfinished topics, pending tasks, recent quiz performance, readiness breakdown, and active risks.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "student": {
        "id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
        "full_name": "Aarav Patel",
        "course": "Computer Science & Engineering",
        "semester": 4,
        "study_time_settings": {
          "preferred_focus_time": "Evening (5:30 PM - 8:30 PM)",
          "daily_study_target_minutes": 120,
          "weekly_study_target_minutes": 840,
          "available_hours_per_day": 2.0
        }
      },
      "subjects": [
        {
          "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
          "subject_name": "Database Management Systems",
          "subject_code": "CS-401",
          "subject_color": "#4B2DB8",
          "readiness_percentage": 59,
          "readiness_breakdown": {
            "topic_completion": 50,
            "quiz_performance": 70,
            "revision_activity": 75,
            "assignment_completion": 50
          },
          "exams": [
            {
              "id": "exam-1-uuid",
              "title": "DBMS Mid-sem",
              "exam_date": "2026-09-30T09:30:00.000Z",
              "days_until_exam": 6,
              "target_score": 85.0
            }
          ],
          "weak_and_unfinished_topics": [
            {
              "id": "top-2-uuid",
              "unit_id": "u1-uuid",
              "unit_title": "Relational Model & Normalization",
              "title": "Boyce-Codd Normal Form",
              "status": "in_progress",
              "is_weak": true,
              "mastery_score": 45
            },
            {
              "id": "top-3-uuid",
              "unit_id": "u2-uuid",
              "unit_title": "Transaction Processing",
              "title": "ACID Properties",
              "status": "completed",
              "is_weak": true,
              "mastery_score": 55
            },
            {
              "id": "top-4-uuid",
              "unit_id": "u2-uuid",
              "unit_title": "Transaction Processing",
              "title": "Concurrency Control Protocols",
              "status": "not_started",
              "is_weak": false,
              "mastery_score": 0
            }
          ],
          "pending_tasks": [
            {
              "id": "task-1-uuid",
              "title": "Schema Normalization Problem Set",
              "type": "Assignment",
              "priority": "High",
              "due_date": "2026-09-25T18:00:00.000Z",
              "days_until_due": 1,
              "is_completed": false
            }
          ],
          "recent_quiz_performance": [
            {
              "id": "quiz-1-uuid",
              "score": 65,
              "total_questions": 10,
              "correct_answers": 6,
              "weak_topics_identified": [
                "Boyce-Codd Normal Form"
              ],
              "created_at": "2026-09-24T18:00:00.000Z"
            }
          ],
          "active_risks": [
            {
              "type": "HIGH_EXAM_RISK",
              "reason": "Exam 'DBMS Mid-sem' is in 6 days, but 3 topics (Boyce-Codd Normal Form, ACID Properties, Concurrency Control Protocols) remain unfinished or weak.",
              "severity": "high",
              "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
              "metadata": {
                "exam_id": "exam-1-uuid",
                "days_away": 6,
                "unfinished_count": 3
              }
            },
            {
              "type": "DEADLINE_RISK",
              "reason": "Assignment 'Schema Normalization Problem Set' is pending and due in 24 hours.",
              "severity": "high",
              "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
              "metadata": {
                "task_id": "task-1-uuid",
                "hours_remaining": 24
              }
            }
          ]
        }
      ],
      "unassigned_pending_tasks": [
        {
          "id": "task-gen-1-uuid",
          "title": "Renew Library Book Borrowing",
          "type": "Task",
          "priority": "Low",
          "due_date": null,
          "days_until_due": null,
          "is_completed": false
        }
      ],
      "global_risks": [
        {
          "type": "HIGH_EXAM_RISK",
          "reason": "Exam 'DBMS Mid-sem' is in 6 days, but 3 topics remain unfinished or weak.",
          "severity": "high",
          "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a"
        },
        {
          "type": "DEADLINE_RISK",
          "reason": "Assignment 'Schema Normalization Problem Set' is pending and due in 24 hours.",
          "severity": "high",
          "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a"
        }
      ],
      "generated_at": "2026-09-24T18:00:00.000Z"
    }
  }
  ```

---

## 12. AI/RAG Track — Materials Upload & PDF Pipeline (`/api/rag/upload`)

> **Track Owner**: P3 (AI & RAG Track).  
> **Status**: Phase 1 Active.  
> **Core Pipeline**: PDF File Ingestion $\to$ Supabase Storage $\to$ Text Extraction $\to$ Overlapping Chunking $\to$ `materials` Record & `document_chunks` Batch Insertion.

### 12.1 Upload and Process PDF Document
- **Method**: `POST`
- **Path**: `/api/rag/upload`  
  *(Aliases: `/api/rag/materials/upload`, `/api/materials/upload/pdf`)*
- **Auth**: Protected (`Authorization: Bearer <access_token>`)
- **Supported Encodings**: `multipart/form-data` OR `application/json` (dual-mode support)

#### Request Format A: `multipart/form-data`
Recommended for browser file pickers and standard form uploads.
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `file` | Binary (PDF) | **Yes** | The PDF file buffer to upload and process |
| `subject_id` | UUID | **Yes** | Owning subject ID (validated under RLS) |
| `unit_id` | UUID | No | Optional syllabus unit ID to link the material to |
| `name` / `custom_name` | String | No | Custom display title for the material |

#### Request Format B: `application/json`
Recommended for automated tests, programmatic scripts, and base64 integrations.
```json
{
  "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
  "unit_id": "u1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6b",
  "file_name": "DBMS_Unit3_Normalization.pdf",
  "file_base64": "JVBERi0xLjQKMSAwIG9iai...",
  "custom_name": "Unit 3 · Normalization Lecture Notes"
}
```

#### Pipeline Execution Details:
1. **Security & RLS Validation**: Enforces that `subject_id` and `unit_id` exist and belong to the authenticated user.
2. **Supabase Storage**: Stores the raw binary file in the `materials` Supabase Storage bucket under `<profile_id>/<subject_id>/<timestamp>_<clean_name>.pdf`.
3. **Text Extraction**: Uses `PdfService` to extract clean text and detect per-page content and total page counts.
4. **Overlapping Chunking**: Splits extracted text using `ChunkingService` into chunks sized for embedding (~800 characters target, ~160 characters overlap) while preserving sentence and paragraph boundaries.
5. **Materials Metadata Record**: Creates or updates a record in the existing `materials` table with `processed: true`, `file_type: 'PDF'`, `size_bytes`, `storage_path`, and `processing_status: 'completed'`.
6. **Document Chunks Insertion**: Inserts each chunk into `document_chunks` table linking to `material_id`, `profile_id`, `chunk_index`, and `page_number`, with `embedding: null` (to be vectorized in Phase 2 Embedding Pipeline) and rich metadata linking back to `subject_id` and `unit_id`.

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "material": {
      "id": "mat-3f89a1-uuid",
      "profile_id": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f",
      "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
      "unit_id": "u1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6b",
      "name": "Unit 3 · Normalization Lecture Notes",
      "storage_path": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f/c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a/1727200000000_dbms_unit3_normalization.pdf",
      "file_type": "PDF",
      "size_bytes": 2457600,
      "processed": true,
      "processing_status": "completed",
      "created_at": "2026-09-24T18:00:00.000Z",
      "updated_at": "2026-09-24T18:00:00.000Z"
    },
    "chunks_created": 14,
    "total_pages": 3,
    "total_characters": 8920,
    "sample_chunks": [
      {
        "chunk_index": 0,
        "page_number": 1,
        "content_preview": "Unit 3: Relational Database Design and Normalization. Normalization is the process of organizing data...",
        "char_count": 780
      },
      {
        "chunk_index": 1,
        "page_number": 1,
        "content_preview": "First Normal Form (1NF) requires that all attribute values be atomic. Second Normal Form (2NF)...",
        "char_count": 810
      }
    ]
  },
  "message": "PDF uploaded, processed, and chunked successfully"
}
```

#### Error Responses
- **400 Bad Request** (`ValidationError`): Missing `subject_id`, invalid UUID, or empty file buffer.
- **400 Bad Request** (`ProcessingError`): Invalid PDF format, corrupted PDF structure, or scanned document with 0 extractable text.
- **401 Unauthorized** (`Unauthorized`): Missing or invalid Bearer token.
- **404 Not Found** (`ProcessingError`): Subject or Unit ID does not exist or belongs to another user.
- **415 Unsupported Media Type** (`UnsupportedMediaType`): Content-Type header is neither `multipart/form-data` nor `application/json`.

---

### 12.2 Semantic Search & Vector Retrieval (`/api/rag/search`)

> **Track Owner**: P3 (AI & RAG Track).  
> **Status**: Phase 2 Active.  
> **Core Pipeline**: Natural Language Query $\to$ Gemini Embedding API (`gemini-embedding-001`, 1536-dim vector) $\to$ pgvector Cosine Distance Search (`document_chunks` scoped to `profile_id` & optional `subject_id`/`material_id`) $\to$ Top Matching Chunks with Similarity Scores and Source Material Metadata.

#### Endpoint Details
- **Method**: `POST`
- **Path**: `/api/rag/search`  
  *(Alias: `/api/rag/retrieve`)*
- **Auth**: Protected (`Authorization: Bearer <access_token>`)
- **Headers**:
  ```http
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```

#### Request Body (`application/json`)
| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `query` | String | **Yes** | — | Natural-language query string (1 to 2000 characters) |
| `subject_id` | UUID | No | `null` | Optional scope filter to chunks belonging to a specific subject |
| `material_id` | UUID | No | `null` | Optional scope filter to chunks from a specific uploaded document |
| `top_k` | Integer | No | `5` | Maximum number of top matching chunks to return (1 to 50) |
| `threshold` | Number | No | `0.3` | Minimum cosine similarity threshold (0.0 to 1.0) |

##### Example Request:
```json
{
  "query": "What is Boyce-Codd Normal Form and how does it handle functional dependencies?",
  "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
  "top_k": 3,
  "threshold": 0.4
}
```

#### Pipeline & Retrieval Execution
1. **Model Resolution**: Uses Google Gemini's currently recommended embedding model: `gemini-embedding-001` with `outputDimensionality: 1536` (matching Postgres `vector(1536)`). Configurable via `GEMINI_EMBEDDING_MODEL` environment variable.
2. **Query Vectorization**: Generates high-dimensional vector representation of the student's natural-language query via the Gemini API embedding endpoint.
3. **Database Scoping & RLS**: Guarantees strict multi-tenant isolation by enforcing `profile_id = auth.uid()` on all queries.
4. **pgvector Similarity Search**: Executes vector similarity ranking using Postgres cosine distance operator (`1 - (embedding <=> query_vector)`).
   - Primary: Supabase RPC `match_document_chunks` for fast indexed ANN vector retrieval.
   - Dual-Mode Fallback: High-precision in-memory cosine similarity calculation when running in local development or test environments.
5. **Metadata Hydration**: Enriches matching chunks with parent `materials` metadata (document name, storage path, file type) and page/chunk index positions.

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "query": "What is Boyce-Codd Normal Form and how does it handle functional dependencies?",
    "matches_count": 2,
    "results": [
      {
        "chunk_id": "f5a2b3c4-1234-5678-90ab-cdef12345678",
        "material_id": "mat-3f89a1-uuid",
        "content": "Boyce-Codd Normal Form (BCNF) is a stricter version of 3NF. A relation R is in BCNF if and only if for every non-trivial functional dependency X -> Y, X is a superkey of R. Unlike 3NF, BCNF does not permit Y to be a prime attribute when X is not a superkey.",
        "similarity": 0.892,
        "page_number": 4,
        "chunk_index": 7,
        "material": {
          "id": "mat-3f89a1-uuid",
          "name": "Unit 3 · Normalization Lecture Notes",
          "storage_path": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f/c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a/dbms_unit3.pdf",
          "file_type": "PDF"
        },
        "metadata": {
          "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
          "unit_id": "u1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6b",
          "char_count": 248,
          "word_count": 42
        }
      },
      {
        "chunk_id": "e4d3c2b1-5678-90ab-cdef-1234567890ab",
        "material_id": "mat-3f89a1-uuid",
        "content": "Third Normal Form vs BCNF: If a relation is in 3NF, it may still suffer from anomalies if there are multiple overlapping candidate keys. BCNF resolves this by removing all dependencies where the determinant is not a superkey.",
        "similarity": 0.824,
        "page_number": 5,
        "chunk_index": 8,
        "material": {
          "id": "mat-3f89a1-uuid",
          "name": "Unit 3 · Normalization Lecture Notes",
          "storage_path": "e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f/c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a/dbms_unit3.pdf",
          "file_type": "PDF"
        },
        "metadata": {
          "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
          "unit_id": "u1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6b",
          "char_count": 215,
          "word_count": 34
        }
      }
    ]
  },
  "message": "Top 2 matching chunks retrieved"
}
```

#### Error Responses
- **400 Bad Request** (`ValidationError`): Missing `query` string, empty string, or invalid UUID format for `subject_id`/`material_id`.
- **401 Unauthorized** (`Unauthorized`): Missing or invalid Bearer token.
- **405 Method Not Allowed** (`MethodNotAllowed`): Sent `GET` instead of `POST`.
- **500 Internal Server Error** (`SearchError`): Gemini API connection or embedding failure.

---

## 13. AI/RAG Track — AI Study Assistant (`/api/assistant/chat`)

> **Track Owner**: P3 (AI & RAG Track).  
> **Status**: Phase 3 Active.  
> **Core Pipeline**: Student Real Context Gathering (Planner Context) $\to$ Grounded Vector Retrieval (Phase 2 Semantic Search) $\to$ Grounded System Prompting $\to$ Gemini Chat API (`gemini-3.8-flash`) $\to$ Answer with Source Citations and Academic State Summary.

### 13.1 Ask AI Study Assistant
- **Method**: `POST`
- **Path**: `/api/assistant/chat`  
  *(Aliases: `/api/assistant/ask`, `/api/rag/assistant`)*
- **Auth**: Protected (`Authorization: Bearer <access_token>`)
- **Headers**:
  ```http
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```

#### Request Body (`application/json`)
| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `message` | String | **Yes** | — | The student's question, prompt, or study request (1 to 4000 characters) |
| `subject_id` | UUID | No | `null` | Optional scope to a specific subject (auto-resolved from query if omitted) |
| `material_id` | UUID | No | `null` | Optional scope to a specific uploaded lecture note or document |
| `conversation_history` | Array | No | `[]` | Recent chat history messages (`{ "role": "user" \| "assistant", "content": string }`, max 20) |

##### Example Request:
```json
{
  "message": "Can you explain Boyce-Codd Normal Form from my Unit 3 notes and give me an example?",
  "subject_id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
  "conversation_history": [
    { "role": "user", "content": "Hi! I am preparing for my DBMS exam." },
    { "role": "assistant", "content": "Hello Aarav! I see your DBMS exam is in 6 days and BCNF is currently marked as a weak area. How can I help you review?" }
  ]
}
```

#### Execution & Grounding Details:
1. **Academic Context Aggregation**: Automatically gathers the student's real profile, enrolled subjects, upcoming exams with countdowns, weak and unfinished topics, pending assignments, and recent quiz scores via `PlannerContextService`.
2. **Absence-of-Context Guard**: If the student has zero subjects in their account, the assistant explicitly states that no subjects or study materials have been added yet, guiding them to add a subject or syllabus rather than fabricating answers.
3. **Phase 2 Vector Retrieval**: Retrieves the top relevant document chunks matching the question from `document_chunks` using `gemini-embedding-001` cosine similarity.
4. **Grounded System Prompting**: Instructs the Gemini chat model to ground answers about course materials directly in the retrieved chunks, cite source document names and page numbers (e.g. `[Unit 3 · Normalization Lecture Notes, Page 4]`), explain concepts, simplify difficult topics, provide relatable examples, generate practice questions, explain quiz mistakes, and recommend what to study next based on real deadlines and weak topics.
5. **Model Resolution**: Uses Google Gemini's currently recommended chat model: `gemini-3.8-flash` (configurable via `GEMINI_CHAT_MODEL`, with automatic fallback to `gemini-flash-latest`).

#### Success Response A: Grounded Answer with Retrieved Sources (200 OK)
```json
{
  "success": true,
  "data": {
    "answer": "Based on your course materials in [Unit 3 · Normalization Lecture Notes, Page 4]:\n\nBoyce-Codd Normal Form (BCNF) is a stricter version of 3NF. A relation R is in BCNF if and only if for every non-trivial functional dependency X -> Y, X is strictly a superkey of R.\n\n### Example of BCNF Violation [Page 5]:\nConsider relation R(Student, Course, Instructor) where:\n1. (Student, Course) -> Instructor\n2. Instructor -> Course\n\nHere, the determinant `Instructor` is NOT a candidate key or superkey by itself. This causes redundancy whenever an instructor teaches multiple courses.\n\n### Recommendation for your Exam (in 6 days):\nSince BCNF was identified as a weak area in your recent quiz (score: 65%), I recommend completing the 'Schema Decomposition Problem Set' due in 2 days to reinforce multi-attribute key decomposition!",
    "sources": [
      {
        "material_id": "mat-3f89a1-uuid",
        "material_name": "Unit 3 · Normalization Lecture Notes",
        "storage_path": "materials/dbms_unit3.pdf",
        "page_number": 4,
        "chunk_index": 7,
        "similarity": 0.892,
        "preview": "Boyce-Codd Normal Form (BCNF) requires that for every non-trivial functional dependency X -> Y, X must strictly be a superkey of relation R. It resolves anomalies that persist even in 3NF when candidate keys overlap."
      },
      {
        "material_id": "mat-3f89a1-uuid",
        "material_name": "Unit 3 · Normalization Lecture Notes",
        "storage_path": "materials/dbms_unit3.pdf",
        "page_number": 5,
        "chunk_index": 8,
        "similarity": 0.824,
        "preview": "Example of BCNF violation: Consider relation R(Student, Course, Instructor) where (Student, Course) -> Instructor, and Instructor -> Course. Here Instructor is not a superkey, causing redundancy and update anomalies."
      }
    ],
    "academic_context": {
      "has_academic_profile": true,
      "student_name": "Aarav Patel",
      "total_subjects": 1,
      "active_subject": {
        "id": "c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a",
        "name": "Database Management Systems",
        "code": "CS-401",
        "readiness_percentage": 59,
        "days_until_exam": 6,
        "weak_topics": [
          "Boyce-Codd Normal Form",
          "Transactions"
        ],
        "pending_tasks_count": 1
      },
      "global_risks_count": 2
    },
    "model": "gemini-3.8-flash"
  },
  "message": "Assistant response generated successfully"
}
```

#### Success Response B: When No Academic Context or Subjects Exist (200 OK)
Returned when a brand-new student account asks questions before configuring any coursework:
```json
{
  "success": true,
  "data": {
    "answer": "You haven't added any subjects or uploaded study materials to LunaLearn yet. Please add your first subject or import your syllabus/notes so I can explain your course concepts, generate customized practice questions, and recommend what to study next!",
    "sources": [],
    "academic_context": {
      "has_academic_profile": false,
      "student_name": "New Student",
      "total_subjects": 0,
      "global_risks_count": 0
    },
    "model": "gemini-3.8-flash"
  },
  "message": "Assistant response generated successfully"
}
```

#### Error Responses
- **400 Bad Request** (`ValidationError`): Missing or empty `message` string, or invalid UUID format for `subject_id`/`material_id`.
- **401 Unauthorized** (`Unauthorized`): Missing or invalid Bearer token.
- **405 Method Not Allowed** (`MethodNotAllowed`): Sent `GET` instead of `POST`.
- **500 Internal Server Error** (`AssistantError`): Upstream server or unrecoverable AI assistant failure.





