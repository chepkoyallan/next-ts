#!/usr/bin/env node

/**
 * Plugin Generator CLI
 * Creates a new plugin with complete starter template
 *
 * Usage:
 *   node scripts/create-plugin.js my-plugin
 *   npm run create-plugin my-plugin
 *   pnpm create-plugin my-plugin
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

async function main() {
  console.log('🚀 Plugin Generator\n');

  // Get plugin name from args or prompt
  let pluginId = process.argv[2];

  if (!pluginId) {
    pluginId = await question('Plugin ID (e.g., my-awesome-plugin): ');
  }

  if (!pluginId) {
    console.error('❌ Plugin ID is required');
    process.exit(1);
  }

  // Validate plugin ID
  if (!/^[a-z0-9-]+$/.test(pluginId)) {
    console.error('❌ Plugin ID must contain only lowercase letters, numbers, and hyphens');
    process.exit(1);
  }

  // Get plugin details
  const pluginName = await question(`Plugin Name (${toPascalCase(pluginId)} Plugin): `) || `${toPascalCase(pluginId)} Plugin`;
  const description = await question('Description: ') || `${pluginName} functionality`;
  const author = await question('Author: ') || 'Your Team';

  // Features
  console.log('\n📦 Select features to include:');
  const hasRoutes = (await question('Include page routes? (y/n): ')).toLowerCase() === 'y';
  const hasApiRoutes = (await question('Include API routes? (y/n): ')).toLowerCase() === 'y';
  const hasNavigation = (await question('Include navigation items? (y/n): ')).toLowerCase() === 'y';
  const hasComponents = (await question('Include components? (y/n): ')).toLowerCase() === 'y';
  const hasHooks = (await question('Include React hooks? (y/n): ')).toLowerCase() === 'y';
  const hasEvents = (await question('Include event system? (y/n): ')).toLowerCase() === 'y';

  const pluginPath = path.join(__dirname, '..', 'packages', 'features', pluginId);

  // Check if plugin already exists
  if (fs.existsSync(pluginPath)) {
    console.error(`❌ Plugin "${pluginId}" already exists at ${pluginPath}`);
    process.exit(1);
  }

  console.log(`\n✨ Creating plugin at: ${pluginPath}\n`);

  // Create directory structure
  fs.mkdirSync(pluginPath, { recursive: true });
  if (hasComponents) fs.mkdirSync(path.join(pluginPath, 'components'), { recursive: true });
  if (hasHooks) fs.mkdirSync(path.join(pluginPath, 'hooks'), { recursive: true });
  if (hasApiRoutes) fs.mkdirSync(path.join(pluginPath, 'api'), { recursive: true });
  fs.mkdirSync(path.join(pluginPath, 'types'), { recursive: true });
  fs.mkdirSync(path.join(pluginPath, 'utils'), { recursive: true });

  // Generate files
  generatePluginJson(pluginPath, { pluginId, pluginName, description, author, hasRoutes, hasApiRoutes, hasNavigation, hasComponents, hasEvents });
  generateIndexTs(pluginPath, { pluginId, pluginName, hasRoutes, hasApiRoutes, hasNavigation, hasComponents, hasEvents });
  generatePackageJson(pluginPath, { pluginId, pluginName, description });
  generateReadme(pluginPath, { pluginId, pluginName, description, hasRoutes, hasApiRoutes, hasNavigation, hasComponents, hasHooks, hasEvents });
  generateTsConfig(pluginPath);

  if (hasComponents) {
    generateExampleComponent(pluginPath, { pluginId, pluginName });
  }

  if (hasHooks) {
    generateExampleHook(pluginPath, { pluginId });
  }

  if (hasApiRoutes) {
    generateExampleApiHandler(pluginPath, { pluginId });
  }

  generateTypes(pluginPath, { pluginId });

  console.log('✅ Plugin created successfully!\n');
  console.log('📁 Files created:');
  console.log(`   ${pluginPath}/plugin.json`);
  console.log(`   ${pluginPath}/index.ts`);
  console.log(`   ${pluginPath}/package.json`);
  console.log(`   ${pluginPath}/tsconfig.json`);
  console.log(`   ${pluginPath}/README.md`);
  if (hasComponents) console.log(`   ${pluginPath}/components/ExampleComponent.tsx`);
  if (hasHooks) console.log(`   ${pluginPath}/hooks/use${toPascalCase(pluginId)}.ts`);
  if (hasApiRoutes) console.log(`   ${pluginPath}/api/handlers.ts`);
  console.log(`   ${pluginPath}/types/index.ts`);

  console.log('\n🎯 Next steps:\n');
  console.log(`1. Review and customize: ${pluginPath}`);
  console.log(`2. Register plugin in: packages/core/config/src/config-manager.ts`);
  if (hasRoutes) console.log(`3. Create page routes in: src/app/${pluginId}/`);
  if (hasApiRoutes) console.log(`4. Create API routes in: src/app/api/${pluginId}/`);
  console.log(`5. Install dependencies: pnpm install`);
  console.log(`6. Start dev server: pnpm dev`);
  console.log('\n📚 Documentation: docs/PLUGIN_SYSTEM_GUIDE.md\n');

  rl.close();
}

function generatePluginJson(pluginPath, config) {
  const manifest = {
    id: config.pluginId,
    name: config.pluginName,
    version: '1.0.0',
    description: config.description,
    author: config.author,
    license: 'MIT',
    enabled: true,
    autoLoad: true,
    priority: 0
  };

  if (config.hasRoutes) {
    manifest.routes = [
      {
        id: `${config.pluginId}-dashboard`,
        path: `/${config.pluginId}`,
        layout: 'dashboard',
        protected: false,
        priority: 0
      }
    ];
  }

  if (config.hasNavigation) {
    manifest.navigation = [
      {
        id: `${config.pluginId}-nav`,
        title: config.pluginName.replace(' Plugin', ''),
        path: `/${config.pluginId}`,
        icon: 'star',
        section: 'main',
        order: 10
      }
    ];
  }

  if (config.hasComponents) {
    manifest.components = [
      {
        id: `${config.pluginId}-example`,
        name: 'ExampleComponent',
        category: 'examples',
        tags: [config.pluginId]
      }
    ];
  }

  if (config.hasEvents) {
    manifest.hooks = [
      {
        name: `${config.pluginId}.action`,
        description: `Emitted when ${config.pluginId} performs an action`
      }
    ];
  }

  manifest.config = {
    enabled: true,
    debug: false
  };

  fs.writeFileSync(
    path.join(pluginPath, 'plugin.json'),
    JSON.stringify(manifest, null, 2)
  );
}

function generateIndexTs(pluginPath, config) {
  const imports = ["import type { Plugin } from '@app/config/types';"];

  if (config.hasApiRoutes) {
    imports.push("import { apiRegistry } from '@app/config/registry';");
    imports.push("import { registerApiRoutes } from './api/handlers';");
  }

  if (config.hasEvents) {
    imports.push("import { hookRegistry } from '@app/config/registry';");
  }

  if (config.hasComponents) {
    imports.push("import ExampleComponent from './components/ExampleComponent';");
  }

  const content = `${imports.join('\n')}

/**
 * ${config.pluginName}
 * ${config.pluginName} functionality
 */
export const ${toCamelCase(config.pluginId)}Plugin: Plugin = {
  id: '${config.pluginId}',
  name: '${config.pluginName}',
  version: '1.0.0',
  enabled: true,
  description: '${config.pluginName} functionality',

  ${config.hasRoutes ? `routes: [
    {
      id: '${config.pluginId}-dashboard',
      path: '/${config.pluginId}',
      layout: 'dashboard',
      pluginId: '${config.pluginId}',
    }
  ],\n` : ''}
  ${config.hasNavigation ? `navigation: [
    {
      id: '${config.pluginId}-nav',
      title: '${config.pluginName.replace(' Plugin', '')}',
      path: '/${config.pluginId}',
      icon: 'star',
      pluginId: '${config.pluginId}',
    }
  ],\n` : ''}
  ${config.hasComponents ? `components: {
    ExampleComponent
  },\n` : ''}
  hooks: {
    ${config.hasEvents ? `definitions: [
      { name: '${config.pluginId}.action', description: 'Plugin action event' }
    ],\n` : ''}
    onInit: async () => {
      console.log('[${config.pluginName}] Initializing...');

      ${config.hasApiRoutes ? `// Register API routes
      registerApiRoutes('${config.pluginId}');\n` : ''}
      ${config.hasEvents ? `// Subscribe to events
      hookRegistry.subscribe('app.ready', () => {
        console.log('[${config.pluginName}] App is ready');
      }, '${config.pluginId}');\n` : ''}
      console.log('[${config.pluginName}] Initialized successfully');
    },

    onLoad: async () => {
      console.log('[${config.pluginName}] Loaded');
    },

    onUnload: () => {
      console.log('[${config.pluginName}] Unloading...');
      ${config.hasApiRoutes ? `apiRegistry.unregisterPluginRoutes('${config.pluginId}');` : ''}
    },

    onDestroy: () => {
      console.log('[${config.pluginName}] Destroyed');
    },

    onError: (error: Error) => {
      console.error('[${config.pluginName}] Error:', error);
    }
  }
};

export default ${toCamelCase(config.pluginId)}Plugin;
`;

  fs.writeFileSync(path.join(pluginPath, 'index.ts'), content);
}

function generatePackageJson(pluginPath, config) {
  const packageJson = {
    name: `@features/${config.pluginId}`,
    version: '1.0.0',
    description: config.description,
    private: true,
    main: 'index.ts',
    types: 'types/index.ts'
  };

  fs.writeFileSync(
    path.join(pluginPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

function generateReadme(pluginPath, config) {
  const readme = `# ${config.pluginName}

${config.description}

## Features

${config.hasRoutes ? '- ✅ Page routes\n' : ''}${config.hasApiRoutes ? '- ✅ API endpoints\n' : ''}${config.hasNavigation ? '- ✅ Navigation items\n' : ''}${config.hasComponents ? '- ✅ Reusable components\n' : ''}${config.hasHooks ? '- ✅ Custom React hooks\n' : ''}${config.hasEvents ? '- ✅ Event system integration\n' : ''}
## Installation

The plugin is automatically loaded when enabled in \`plugin.json\`.

## Configuration

Edit \`plugin.json\` to configure:

\`\`\`json
{
  "enabled": true,
  "config": {
    "debug": false
  }
}
\`\`\`

## Usage

${config.hasComponents ? `### Using Components

\`\`\`typescript
import { useComponent } from '@app/config/registry';

function MyPage() {
  const ExampleComponent = useComponent('${config.pluginId}-example');
  return ExampleComponent ? <ExampleComponent /> : null;
}
\`\`\`
` : ''}
${config.hasHooks ? `### Using Hooks

\`\`\`typescript
import { use${toPascalCase(config.pluginId)} } from '@features/${config.pluginId}/hooks';

function MyComponent() {
  const data = use${toPascalCase(config.pluginId)}();
  return <div>{data}</div>;
}
\`\`\`
` : ''}
${config.hasEvents ? `### Events

**Emitted Events:**
- \`${config.pluginId}.action\` - When an action occurs

**Subscribe to Events:**
\`\`\`typescript
import { hookRegistry } from '@app/config/registry';

hookRegistry.subscribe('${config.pluginId}.action', (data) => {
  console.log('Action occurred:', data);
}, 'my-plugin');
\`\`\`
` : ''}
${config.hasApiRoutes ? `### API Endpoints

- \`GET /api/${config.pluginId}\` - Get data
- \`POST /api/${config.pluginId}\` - Create data
` : ''}
## Development

\`\`\`bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests (if configured)
pnpm test
\`\`\`

## Documentation

See [Plugin System Guide](../../../docs/PLUGIN_SYSTEM_GUIDE.md) for more information.

## License

MIT
`;

  fs.writeFileSync(path.join(pluginPath, 'README.md'), readme);
}

function generateTsConfig(pluginPath) {
  const tsconfig = {
    extends: '../../../tsconfig.json',
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@/*': ['../../../src/*'],
        '@app/*': ['../../core/*']
      }
    },
    include: ['./**/*'],
    exclude: ['node_modules']
  };

  fs.writeFileSync(
    path.join(pluginPath, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );
}

function generateExampleComponent(pluginPath, config) {
  const content = `'use client';

/**
 * Example Component for ${config.pluginName}
 */
export default function ExampleComponent() {
  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>${config.pluginName} Component</h3>
      <p>This is an example component from ${config.pluginId} plugin.</p>
      <button onClick={() => alert('Hello from ${config.pluginName}!')}>
        Click Me
      </button>
    </div>
  );
}
`;

  fs.writeFileSync(
    path.join(pluginPath, 'components', 'ExampleComponent.tsx'),
    content
  );
}

function generateExampleHook(pluginPath, config) {
  const content = `'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook for ${config.pluginId}
 */
export function use${toPascalCase(config.pluginId)}() {
  const [data, setData] = useState<string>('');

  useEffect(() => {
    // Fetch or compute data
    setData('Hello from ${config.pluginId}!');
  }, []);

  return data;
}

export default use${toPascalCase(config.pluginId)};
`;

  fs.writeFileSync(
    path.join(pluginPath, 'hooks', `use${toPascalCase(config.pluginId)}.ts`),
    content
  );
}

function generateExampleApiHandler(pluginPath, config) {
  const content = `import { apiRegistry } from '@app/config/registry';

/**
 * Register API routes for ${config.pluginId}
 */
export function registerApiRoutes(pluginId: string) {
  // GET endpoint
  apiRegistry.registerRoute({
    id: \`\${pluginId}.get\`,
    path: \`/api/\${pluginId}\`,
    method: 'GET',
    handler: async (req, res) => {
      res.status(200).json({
        message: 'Hello from ${config.pluginId} API',
        timestamp: Date.now()
      });
    },
    pluginId,
    description: 'Get ${config.pluginId} data',
    tags: [pluginId]
  });

  // POST endpoint
  apiRegistry.registerRoute({
    id: \`\${pluginId}.create\`,
    path: \`/api/\${pluginId}\`,
    method: 'POST',
    handler: async (req, res) => {
      const body = await req.json();
      res.status(201).json({
        message: 'Created successfully',
        data: body
      });
    },
    pluginId,
    description: 'Create ${config.pluginId} data',
    tags: [pluginId],
    protected: false
  });

  console.log(\`[API] Registered routes for \${pluginId}\`);
}
`;

  fs.writeFileSync(
    path.join(pluginPath, 'api', 'handlers.ts'),
    content
  );
}

function generateTypes(pluginPath, config) {
  const content = `/**
 * Type definitions for ${config.pluginId}
 */

export interface ${toPascalCase(config.pluginId)}Config {
  enabled: boolean;
  debug?: boolean;
}

export interface ${toPascalCase(config.pluginId)}Data {
  id: string;
  name: string;
  createdAt: Date;
}

// Add more types as needed
`;

  fs.writeFileSync(
    path.join(pluginPath, 'types', 'index.ts'),
    content
  );
}

// Run the CLI
main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
