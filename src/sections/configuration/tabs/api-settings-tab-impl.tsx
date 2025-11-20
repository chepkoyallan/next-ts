'use client';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useConfig } from '@app/config/hooks/use-config';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

export function APISettingsTab() {
  const { config, setValue } = useConfig();

  return (
    <Stack spacing={3}>
      <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold-duotone" />}>
        API configuration changes will affect all HTTP requests. Test changes in development first.
      </Alert>

      <Grid container spacing={3}>
        {/* Endpoint Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Endpoint Configuration</Typography>

                <TextField
                  label="Base URL"
                  value={config.api.baseURL}
                  onChange={(e) => setValue('api.baseURL', e.target.value)}
                  placeholder="https://api.example.com"
                  fullWidth
                  helperText="Base URL for all API requests"
                />

                <TextField
                  label="Timeout (ms)"
                  type="number"
                  value={config.api.timeout}
                  onChange={(e) => setValue('api.timeout', parseInt(e.target.value, 10))}
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                  }}
                  helperText="Request timeout in milliseconds"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Retry & Cache Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Retry & Cache Settings</Typography>

                <TextField
                  label="Max Retries"
                  type="number"
                  value={config.api.retries}
                  onChange={(e) => setValue('api.retries', parseInt(e.target.value, 10))}
                  fullWidth
                  inputProps={{ min: 0, max: 10 }}
                  helperText="Number of retry attempts for failed requests"
                />

                <TextField
                  label="Retry Delay (ms)"
                  type="number"
                  value={config.api.retryDelay}
                  onChange={(e) => setValue('api.retryDelay', parseInt(e.target.value, 10))}
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                  }}
                  helperText="Delay between retry attempts"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.api.enableCache}
                      onChange={(e) => setValue('api.enableCache', e.target.checked)}
                    />
                  }
                  label="Enable Response Caching"
                />

                {config.api.enableCache && (
                  <TextField
                    label="Cache Duration (minutes)"
                    type="number"
                    value={config.api.cacheDuration}
                    onChange={(e) => setValue('api.cacheDuration', parseInt(e.target.value, 10))}
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">min</InputAdornment>,
                    }}
                    helperText="How long to cache responses"
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
