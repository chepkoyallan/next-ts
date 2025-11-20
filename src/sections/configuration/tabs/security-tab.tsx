'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useConfig } from '@app/config/hooks/use-config';

export function SecurityTab() {
  const { config } = useConfig();
  return (
    <Stack spacing={3}>
      <Typography variant="h6">Security Settings</Typography>
      <Typography variant="body2" color="text.secondary">
        Configure CSRF, CORS, rate limiting, and security policies
      </Typography>
    </Stack>
  );
}
