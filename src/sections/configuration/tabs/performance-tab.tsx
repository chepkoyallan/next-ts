'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useConfig } from '@app/config/hooks/use-config';

export function PerformanceTab() {
  const { config } = useConfig();
  return (
    <Stack spacing={3}>
      <Typography variant="h6">Performance Optimization</Typography>
      <Typography variant="body2" color="text.secondary">
        Configure caching, lazy loading, and performance settings
      </Typography>
    </Stack>
  );
}
