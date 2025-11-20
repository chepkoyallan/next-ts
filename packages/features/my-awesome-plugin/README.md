# y

smaple plugin

## Features

- ✅ Page routes
- ✅ API endpoints
- ✅ Navigation items
- ✅ Reusable components
- ✅ Custom React hooks
- ✅ Event system integration

## Installation

The plugin is automatically loaded when enabled in `plugin.json`.

## Configuration

Edit `plugin.json` to configure:

```json
{
  "enabled": true,
  "config": {
    "debug": false
  }
}
```

## Usage

### Using Components

```typescript
import { useComponent } from '@app/config/registry';

function MyPage() {
  const ExampleComponent = useComponent('my-awesome-plugin-example');
  return ExampleComponent ? <ExampleComponent /> : null;
}
```

### Using Hooks

```typescript
import { useMyAwesomePlugin } from '@features/my-awesome-plugin/hooks';

function MyComponent() {
  const data = useMyAwesomePlugin();
  return <div>{data}</div>;
}
```

### Events

**Emitted Events:**
- `my-awesome-plugin.action` - When an action occurs

**Subscribe to Events:**
```typescript
import { hookRegistry } from '@app/config/registry';

hookRegistry.subscribe('my-awesome-plugin.action', (data) => {
  console.log('Action occurred:', data);
}, 'my-plugin');
```

### API Endpoints

- `GET /api/my-awesome-plugin` - Get data
- `POST /api/my-awesome-plugin` - Create data

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests (if configured)
pnpm test
```

## Documentation

See [Plugin System Guide](../../../docs/PLUGIN_SYSTEM_GUIDE.md) for more information.

## License

MIT
