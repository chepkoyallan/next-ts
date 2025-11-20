# Engine - Modern gRPC Client for Flyte

Modern, type-safe gRPC client implementation using pre-compiled protobuf definitions.

## Features

- ✅ **Type-Safe**: Full TypeScript support with generated protobuf types
- ✅ **No Runtime Proto Loading**: Pre-compiled definitions for faster startup
- ✅ **Connection Management**: Automatic reconnection and health checks
- ✅ **Retry Logic**: Configurable exponential backoff
- ✅ **Metadata Support**: Built-in auth, tracing, and custom headers
- ✅ **Error Handling**: Comprehensive error types and handling
- ✅ **Monitoring Ready**: Connection status and health metrics

## Quick Start

### Basic Usage

```typescript
import { createEngineServices } from '@/engine';

// Create services from environment variables
const engine = createEngineServicesFromEnv();

// Initialize all services
await engine.initialize();

// Use the services
const task = await engine.services.tasks?.getTaskById('my-project', 'development', 'my-task');

// Shutdown when done
await engine.shutdown();
```

### Manual Configuration

```typescript
import { createEngineServices, TaskService } from '@/engine';

const engine = createEngineServices({
  tasks: {
    name: 'task-service',
    host: 'localhost',
    port: 8089,
    secure: false,
    timeout: 30000,
  },
});

await engine.initialize();
```

## Services

### Task Service

High-level task management operations:

```typescript
import { TaskService } from '@/engine';

const taskService = new TaskService(config);
await taskService.initialize();

// Create a task
const task = await taskService.createTaskSimple({
  project: 'my-project',
  domain: 'development',
  name: 'my-task',
  version: 'v1',
  template: taskTemplate,
  description: 'My task description',
});

// Query tasks
const tasks = await taskService.queryTasks({
  project: 'my-project',
  domain: 'development',
  limit: 50,
});

// Get task statistics
const stats = await taskService.getTaskStatistics('my-project', 'development');
```

### Workflow Service

Workflow and execution management:

```typescript
import { WorkflowService } from '@/engine';

const workflowService = new WorkflowService(config);
await workflowService.initialize();

// Create an execution
const execution = await workflowService.createExecutionSimple({
  project: 'my-project',
  domain: 'development',
  name: 'my-execution',
  workflowId: workflowIdentifier,
  inputs: { key: 'value' },
});

// Get execution status
const status = await workflowService.getExecutionStatusSummary('my-project');

// Terminate an execution
await workflowService.terminateExecutionByName(
  'my-project',
  'development',
  'my-execution',
  'User requested termination'
);
```

### Admin Service

Low-level Flyte Admin API access:

```typescript
import { AdminService } from '@/engine';

const adminService = new AdminService(config);
await adminService.initialize();

// Direct access to all Flyte Admin APIs
const task = await adminService.getTask(request);
const workflow = await adminService.getWorkflow(request);
const execution = await adminService.getExecution(request);
```

## Configuration

### Environment Variables

```bash
# Flyte Admin Service
FLYTE_ADMIN_HOST=localhost
FLYTE_ADMIN_PORT=8089
FLYTE_ADMIN_SECURE=false
FLYTE_ADMIN_TIMEOUT=30000
FLYTE_ADMIN_AUTH_TYPE=insecure
FLYTE_ADMIN_TOKEN=your-token-here
FLYTE_ADMIN_HEALTH_CHECK=true
FLYTE_ADMIN_HEALTH_INTERVAL=30000
```

### Configuration Presets

```typescript
import { ConfigPresets } from '@/engine/config';

// Local development
const config = ConfigPresets.local('my-service');

// Production
const config = ConfigPresets.production('my-service', 'prod-host', 8089);

// Testing
const config = ConfigPresets.test('my-service');
```

## Utilities

### Metadata Builder

```typescript
import { MetadataBuilder } from '@/engine';

const metadata = new MetadataBuilder()
  .addAuth('my-token', 'Bearer')
  .addTracing({ traceId: '123', spanId: '456' })
  .addRequestId('req-789')
  .addCustom('x-my-header', 'value')
  .build();
```

### Retry Manager

```typescript
import { RetryManager } from '@/engine';

const retryManager = new RetryManager({
  maxAttempts: 3,
  initialBackoff: 1000,
  maxBackoff: 30000,
  backoffMultiplier: 2,
  retryableStatusCodes: [14, 4, 8],
});

const result = await retryManager.withRetry(
  () => makeGrpcCall(),
  (context) => console.log(`Retry attempt ${context.attempt}`)
);
```

### Serialization

```typescript
import { TaskSerializer, ProtoSerializer } from '@/engine';

// Task serialization
const bytes = TaskSerializer.encodeTask(task);
const task = TaskSerializer.decodeTask(bytes);
const json = TaskSerializer.taskToJSON(task);

// Generic serialization
const encoded = ProtoSerializer.encode(message, MessageType);
const decoded = ProtoSerializer.decode<MyType>(bytes, MessageType);
```

## Error Handling

```typescript
import { EngineGrpcError } from '@/engine';

try {
  await taskService.getTaskById('project', 'domain', 'task');
} catch (error) {
  if (error instanceof EngineGrpcError) {
    console.error('gRPC Error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      statusName: error.toJSON().statusName,
    });
  }
}
```

## Health Checks

```typescript
// Check if service is ready
const isReady = taskService.isReady();

// Get connection status
const status = taskService.getStatus();
console.log({
  connected: status.connected,
  state: status.state,
  lastError: status.lastError,
  reconnectAttempts: status.reconnectAttempts,
});

// Get health status
const health = taskService.getHealthStatus();
console.log({
  healthy: health.healthy,
  latencyMs: health.latencyMs,
  lastCheck: health.lastCheck,
});
```

## Architecture

```
engine/
├── grpc/
│   ├── client.ts         # Base gRPC client
│   ├── types.ts          # Type definitions
│   └── connection.ts     # Connection management
├── services/
│   ├── admin-service.ts  # Flyte Admin API
│   ├── task-service.ts   # Task management
│   └── workflow-service.ts # Workflow & execution
├── utils/
│   ├── metadata.ts       # Metadata helpers
│   ├── retry.ts          # Retry logic
│   └── serialization.ts  # Proto serialization
└── index.ts              # Public API
```

## Migration from Old Client

```typescript
// Old approach (proto loading)
import { GrpcClient } from 'src/app/api/lib/grpc/grpc-client';

const client = new GrpcClient({
  protoPath: './protos/admin.proto',
  packageName: 'flyteidl.service',
  serviceName: 'AdminService',
  // ...
});

// New approach (pre-compiled)
import { TaskService } from '@/engine';

const taskService = new TaskService({
  name: 'task-service',
  host: 'localhost',
  port: 8089,
});
```

## Best Practices

1. **Initialize once**: Create services at startup and reuse them
2. **Handle errors**: Use try/catch with EngineGrpcError
3. **Use retry logic**: Enable retries for transient failures
4. **Monitor health**: Check health status periodically
5. **Cleanup**: Call shutdown() when done
6. **Use type-safe methods**: Prefer service convenience methods over raw calls

## Testing

```typescript
import { ConfigPresets } from '@/engine/config';

// Use test preset for unit tests
const config = ConfigPresets.test('test-service');
const service = new TaskService(config);

// Mock gRPC calls
jest.mock('@/engine/services/task-service');
```
