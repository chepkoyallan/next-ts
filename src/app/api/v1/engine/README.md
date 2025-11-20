# Engine API Routes

RESTful API endpoints for interacting with the Flyte engine services.

## Base URL

```
/api/v1/engine
```

## Available Endpoints

### Health Check

#### GET `/api/v1/engine`

Get engine status and service health information.

**Response:**

```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "total": 8,
    "healthy": 8,
    "details": {
      "admin": true,
      "tasks": true,
      "workflows": true,
      "authMetadata": true,
      "dataProxy": true,
      "externalPlugin": false,
      "identity": true,
      "signal": true
    }
  },
  "timestamp": "2025-09-30T12:00:00.000Z"
}
```

---

## Tasks

### GET `/api/v1/engine/tasks`

List tasks with optional filtering.

**Query Parameters:**

- `project` (optional) - Filter by project
- `domain` (optional) - Filter by domain
- `name` (optional) - Filter by task name
- `version` (optional) - Filter by version
- `limit` (optional) - Maximum results (default: 50)
- `stats` (optional) - Return statistics instead of list (true/false)

**Example:**

```bash
GET /api/v1/engine/tasks?project=myproject&domain=development&limit=10
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tasks": [...],
    "token": "next-page-token"
  }
}
```

### GET `/api/v1/engine/tasks/:id`

Get specific task by ID.

**Path Parameters:**

- `id` - Task identifier in format: `project:domain:name:version`

**Example:**

```bash
GET /api/v1/engine/tasks/myproject:development:my-task:v1
```

### POST `/api/v1/engine/tasks`

Create a new task.

**Request Body:**

```json
{
  "id": {
    "project": "myproject",
    "domain": "development",
    "name": "my-task",
    "version": "v1"
  },
  "spec": {
    "template": { ... }
  }
}
```

---

## Workflows

### GET `/api/v1/engine/workflows`

List workflows with optional filtering.

**Query Parameters:**

- `project` (optional) - Filter by project
- `domain` (optional) - Filter by domain
- `name` (optional) - Filter by workflow name
- `version` (optional) - Filter by version
- `limit` (optional) - Maximum results (default: 50)

**Example:**

```bash
GET /api/v1/engine/workflows?project=myproject&domain=development
```

### GET `/api/v1/engine/workflows/:id`

Get specific workflow by ID.

**Path Parameters:**

- `id` - Workflow identifier in format: `project:domain:name:version`

### POST `/api/v1/engine/workflows`

Create a new workflow.

**Request Body:**

```json
{
  "id": {
    "project": "myproject",
    "domain": "development",
    "name": "my-workflow",
    "version": "v1"
  },
  "spec": {
    "template": { ... }
  }
}
```

---

## Executions

### GET `/api/v1/engine/executions`

List executions with optional filtering.

**Query Parameters:**

- `project` (optional) - Filter by project
- `domain` (optional) - Filter by domain
- `limit` (optional) - Maximum results (default: 50)
- `summary` (optional) - Return execution summary (true/false)

**Example (list):**

```bash
GET /api/v1/engine/executions?project=myproject&limit=20
```

**Example (summary):**

```bash
GET /api/v1/engine/executions?project=myproject&summary=true
```

**Summary Response:**

```json
{
  "success": true,
  "data": {
    "total": 150,
    "running": 10,
    "succeeded": 120,
    "failed": 15,
    "aborted": 5,
    "byPhase": {
      "RUNNING": 10,
      "SUCCEEDED": 120,
      "FAILED": 15,
      "ABORTED": 5
    }
  }
}
```

### GET `/api/v1/engine/executions/:id`

Get specific execution by ID.

**Path Parameters:**

- `id` - Execution identifier in format: `project:domain:name`

**Query Parameters:**

- `io` (optional) - Return I/O data instead of execution details (true/false)

**Example:**

```bash
GET /api/v1/engine/executions/myproject:development:exec-123
GET /api/v1/engine/executions/myproject:development:exec-123?io=true
```

### POST `/api/v1/engine/executions`

Create a new execution.

**Request Body:**

```json
{
  "project": "myproject",
  "domain": "development",
  "name": "my-execution",
  "workflowId": {
    "project": "myproject",
    "domain": "development",
    "name": "my-workflow",
    "version": "v1"
  },
  "inputs": { ... },
  "labels": {
    "environment": "production"
  },
  "annotations": {
    "owner": "team-name"
  }
}
```

### DELETE `/api/v1/engine/executions/:id`

Terminate an execution.

**Path Parameters:**

- `id` - Execution identifier in format: `project:domain:name`

**Request Body (optional):**

```json
{
  "reason": "User requested termination"
}
```

---

## Projects

### GET `/api/v1/engine/projects`

List all projects.

**Query Parameters:**

- `limit` (optional) - Maximum results (default: 50)
- `token` (optional) - Pagination token

**Example:**

```bash
GET /api/v1/engine/projects?limit=20
```

### POST `/api/v1/engine/projects`

Register a new project.

**Request Body:**

```json
{
  "project": {
    "id": "myproject",
    "name": "My Project",
    "description": "Project description"
  }
}
```

---

## Launch Plans

### GET `/api/v1/engine/launch-plans`

List launch plans with optional filtering.

**Query Parameters:**

- `project` (optional) - Filter by project
- `domain` (optional) - Filter by domain
- `name` (optional) - Filter by name
- `limit` (optional) - Maximum results (default: 50)
- `active` (optional) - Get only active launch plans (true/false)

**Example (all):**

```bash
GET /api/v1/engine/launch-plans?project=myproject&domain=development
```

**Example (active only):**

```bash
GET /api/v1/engine/launch-plans?project=myproject&domain=development&active=true
```

### POST `/api/v1/engine/launch-plans`

Create a new launch plan.

**Request Body:**

```json
{
  "id": {
    "project": "myproject",
    "domain": "development",
    "name": "my-launch-plan",
    "version": "v1"
  },
  "spec": {
    "workflowId": { ... },
    "defaultInputs": { ... }
  }
}
```

---

## Authentication

### GET `/api/v1/engine/auth`

Get authentication metadata.

**Query Parameters:**

- `endpoint` - Type of metadata to retrieve (`oauth2` or `config`)

**Example (OAuth2):**

```bash
GET /api/v1/engine/auth?endpoint=oauth2
```

**Example (Public Client Config):**

```bash
GET /api/v1/engine/auth?endpoint=config
```

---

## Data Proxy

### POST `/api/v1/engine/data-proxy`

Create upload/download locations for data artifacts.

**Query Parameters:**

- `action` - Action to perform (`upload`, `download`, or `download-link`)

**Example (upload):**

```bash
POST /api/v1/engine/data-proxy?action=upload
Content-Type: application/json

{
  "project": "myproject",
  "domain": "development",
  "filename": "data.parquet",
  "expiresIn": "1h"
}
```

**Example (download):**

```bash
POST /api/v1/engine/data-proxy?action=download
Content-Type: application/json

{
  "project": "myproject",
  "domain": "development",
  "artifact": "artifact-id"
}
```

**Example (download link):**

```bash
POST /api/v1/engine/data-proxy?action=download-link
Content-Type: application/json

{
  "artifactType": "INPUT",
  "expiresIn": "24h"
}
```

---

## Signals

### GET `/api/v1/engine/signals`

List signals for a workflow execution.

**Query Parameters:**

- `workflowExecutionId` (required) - Workflow execution ID (JSON string)
- `limit` (optional) - Maximum results (default: 50)

**Example:**

```bash
GET /api/v1/engine/signals?workflowExecutionId={"project":"myproject","domain":"dev","name":"exec-1"}&limit=10
```

### POST `/api/v1/engine/signals`

Create or set a signal.

**Query Parameters:**

- `action` - Action to perform (`get-or-create` or `set`)

**Example (get or create):**

```bash
POST /api/v1/engine/signals?action=get-or-create
Content-Type: application/json

{
  "id": {
    "executionId": {
      "project": "myproject",
      "domain": "development",
      "name": "exec-1"
    },
    "signalId": "approval-signal"
  },
  "type": { ... }
}
```

**Example (set value):**

```bash
POST /api/v1/engine/signals?action=set
Content-Type: application/json

{
  "id": {
    "executionId": {
      "project": "myproject",
      "domain": "development",
      "name": "exec-1"
    },
    "signalId": "approval-signal"
  },
  "value": { ... }
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable (engine service not initialized)

---

## Authentication

All endpoints require authentication. Include your authentication token in the request headers:

```
Authorization: Bearer <your-token>
```

---

## Rate Limiting

API requests are subject to rate limiting. Current limits:

- 100 requests per minute per user
- 1000 requests per hour per user

---

## Examples

### cURL Examples

**Get engine status:**

```bash
curl -X GET http://localhost:3000/api/v1/engine \
  -H "Authorization: Bearer <token>"
```

**List tasks:**

```bash
curl -X GET "http://localhost:3000/api/v1/engine/tasks?project=myproject&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Create execution:**

```bash
curl -X POST http://localhost:3000/api/v1/engine/executions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "myproject",
    "domain": "development",
    "name": "my-execution",
    "workflowId": {
      "project": "myproject",
      "domain": "development",
      "name": "my-workflow",
      "version": "v1"
    }
  }'
```

### JavaScript/TypeScript Examples

```typescript
// Get engine status
const status = await fetch('/api/v1/engine', {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await status.json();

// List tasks
const tasks = await fetch('/api/v1/engine/tasks?project=myproject', {
  headers: { Authorization: `Bearer ${token}` },
});

// Create execution
const execution = await fetch('/api/v1/engine/executions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    project: 'myproject',
    domain: 'development',
    name: 'my-execution',
    workflowId: {
      project: 'myproject',
      domain: 'development',
      name: 'my-workflow',
      version: 'v1',
    },
  }),
});
```

---

## Support

For issues or questions about the Engine API, please contact the development team or file an issue in the repository.
