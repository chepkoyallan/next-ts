'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useConfig } from '@app/config/hooks/use-config';

export function LocalizationTab() {
  const { config } = useConfig();
  return (
    <Stack spacing={3}>
      <Typography variant="h6">Localization & Regional Settings</Typography>
      <Typography variant="body2" color="text.secondary">
        Configure language, date/time format, timezone, and currency
      </Typography>
    </Stack>
  );
}
