# @app/engine

gRPC engine and service clients for the application.

## Features

- gRPC client connections
- Service implementations (workflow, task, signal, admin, identity, etc.)
- Protocol buffer loading
- Connection management
- Serialization utilities
- Retry logic
- Metadata handling

## Usage

```typescript
import { createGrpcClient } from '@app/engine';
import { WorkflowService } from '@app/engine/services/workflow-service';

// Create gRPC client
const client = createGrpcClient(config);

// Use service
const workflowService = new WorkflowService(client);
```

## Services

- Admin Service
- Auth Metadata Service
- Data Proxy Service
- External Plugin Service
- Identity Service
- Signal Service
- Task Service
- Workflow Service

## Documentation

See `IMPLEMENTATION_COMPLETE.md` and `SERVICE_COVERAGE.md` for detailed documentation.
