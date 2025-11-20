// Example Custom Layout Plugin
// Demonstrates layout and section extensions
// ----------------------------------------------------------------------

'use client';

import type { Plugin } from '@app/config/types';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

// Custom layout component
function CustomLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          py: 2,
        }}
      >
        <Container>
          <Typography variant="h6">Custom Plugin Layout</Typography>
        </Container>
      </Box>
      <Container sx={{ py: 4 }}>{children}</Container>
      <Box
        sx={{
          bgcolor: 'grey.200',
          py: 2,
          mt: 'auto',
        }}
      >
        <Container>
          <Typography variant="caption" color="text.secondary">
            Powered by Custom Layout Plugin
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

// Custom configuration section
function CustomConfigSection() {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Custom Plugin Settings
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This configuration section was added by a plugin!
      </Typography>
    </Box>
  );
}

// Plugin definition
export const customLayoutPlugin: Plugin = {
  id: 'custom-layout',
  name: 'Custom Layout Pack',
  version: '1.0.0',
  description: 'Provides custom layouts and UI sections',
  author: 'UI Team',
  enabled: false,
  type: 'ui',
  status: 'inactive',

  // Custom layouts
  layouts: [
    {
      id: 'custom-layout',
      name: 'Custom Layout',
      component: CustomLayout,
      isDefault: false,
    },
  ],

  // Custom sections
  sections: [
    {
      id: 'custom-config',
      name: 'Custom Settings',
      component: CustomConfigSection,
      configTab: true,
      order: 999,
    },
  ],

  // Hooks
  hooks: {
    onInit: async () => {
      console.log('[Custom Layout Plugin] Layouts registered');
    },
  },

  settings: {
    headerColor: '#1976d2',
    footerEnabled: true,
  },

  metadata: {
    tags: ['layout', 'ui', 'theme'],
    license: 'MIT',
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
