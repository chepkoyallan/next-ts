'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useConfig } from '@app/config/hooks/use-config';

export function NotificationsTab() {
  const { config } = useConfig();
  return (
    <Stack spacing={3}>
      <Typography variant="h6">Notification Settings</Typography>
      <Typography variant="body2" color="text.secondary">
        Configure how and when you receive notifications
      </Typography>
    </Stack>
  );
}
