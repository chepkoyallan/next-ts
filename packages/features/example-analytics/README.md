# Analytics Plugin Example

This is an example plugin demonstrating the complete plugin system with:

- **Plugin Manifest** (`plugin.json`) - JSON-based configuration
- **Route Registry** - Dynamic route registration
- **Navigation Registry** - Dynamic navigation items
- **Component Registry** - Component discovery and override system
- **Provider Registry** - Dynamic context provider composition
- **Hook Registry** - Cross-plugin event communication

## Features

- Real-time analytics tracking
- Custom event tracking
- User behavior tracking
- Report generation
- Dashboard visualizations

## Manifest Features Demonstrated

### Routes
- `/analytics` - Main analytics dashboard
- `/analytics/reports` - Reports page

### Navigation
- Analytics menu item with icon
- Reports submenu item

### Components
- `AnalyticsWidget` - Dashboard widget
- `AnalyticsChart` - Chart visualization

### Hooks
- `analytics.pageview` - Track page views
- `analytics.event` - Track custom events
- `analytics.report.generated` - Report generation events

### Permissions
- User data access
- Navigation modification
- Route registration
- Component registration
- Hook emission

## Usage

The plugin is automatically loaded by the PluginManager when `enabled: true` in the manifest.

### Subscribing to Analytics Events

```typescript
import { hookRegistry } from '@app/config/registry';

// Subscribe to page view events
hookRegistry.subscribe('analytics.pageview', (data) => {
  console.log('Page viewed:', data);
}, 'my-plugin');

// Subscribe to custom events
hookRegistry.subscribe('analytics.event', (data) => {
  console.log('Event tracked:', data);
}, 'my-plugin');
```

### Emitting Analytics Events

```typescript
import { hookRegistry } from '@app/config/registry';

// Track a page view
await hookRegistry.emit('analytics.pageview', {
  path: '/dashboard',
  timestamp: Date.now()
});

// Track a custom event
await hookRegistry.emit('analytics.event', {
  category: 'user',
  action: 'login',
  label: 'success'
});
```

## Configuration

The plugin can be configured via the `config` section in `plugin.json`:

```json
{
  "config": {
    "trackingId": "UA-XXXXX-Y",
    "sampleRate": 100,
    "enableDebug": false,
    "endpoints": {
      "track": "/api/analytics/track",
      "report": "/api/analytics/report"
    }
  }
}
```
