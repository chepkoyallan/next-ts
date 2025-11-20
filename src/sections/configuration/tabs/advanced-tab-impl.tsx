'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useConfig } from '@app/config/hooks/use-config';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

export function AdvancedTab() {
  const { config, setValue, resetConfig, updateConfig } = useConfig();
  const [jsonInput, setJsonInput] = useState('');

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(jsonInput || '{}');
      alert('Valid JSON configuration!');
    } catch (error) {
      alert('Invalid JSON format');
    }
  };

  const handleImportJSON = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      updateConfig(parsed);
      alert('Configuration imported successfully!');
      setJsonInput('');
    } catch (error) {
      alert('Failed to import: Invalid JSON format');
    }
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(config, null, 2);
    setJsonInput(json);
  };

  const handleCopyToClipboard = () => {
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json);
    alert('Configuration copied to clipboard!');
  };

  return (
    <Stack spacing={3}>
      {/* Warning */}
      <Alert severity="warning" icon={<Iconify icon="solar:danger-triangle-bold-duotone" />}>
        <Typography variant="subtitle2" gutterBottom>
          Advanced Settings
        </Typography>
        <Typography variant="body2">
          These settings are for advanced users only. Incorrect configuration may cause application
          errors.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* JSON Editor */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    JSON Configuration Editor
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Import or export configuration as JSON
                  </Typography>
                </Box>

                <TextField
                  multiline
                  rows={20}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste JSON configuration here..."
                  fullWidth
                  sx={{ fontFamily: 'monospace', fontSize: 12 }}
                />

                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={<Iconify icon="solar:import-bold-duotone" />}
                    onClick={handleImportJSON}
                    disabled={!jsonInput}
                  >
                    Import
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Iconify icon="solar:export-bold-duotone" />}
                    onClick={handleExportJSON}
                  >
                    Export to Editor
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Iconify icon="solar:copy-bold-duotone" />}
                    onClick={handleCopyToClipboard}
                  >
                    Copy Current
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Iconify icon="solar:document-text-bold-duotone" />}
                    onClick={handleValidate}
                    disabled={!jsonInput}
                  >
                    Validate
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Advanced Options */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Debug Mode */}
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Debug Settings</Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.environment === 'development'}
                        onChange={(e) =>
                          setValue('environment', e.target.checked ? 'development' : 'production')
                        }
                      />
                    }
                    label="Development Mode"
                  />

                  <Typography variant="caption" color="text.secondary">
                    Enable development features and detailed logging
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">System Information</Typography>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Version
                    </Typography>
                    <Typography variant="body2">{config.version}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Environment
                    </Typography>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {config.environment}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Storage
                    </Typography>
                    <Typography variant="body2">LocalStorage</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card sx={{ bgcolor: 'error.lighter' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" color="error.main">
                    Danger Zone
                  </Typography>

                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<Iconify icon="solar:restart-bold-duotone" />}
                    onClick={() => {
                      if (window.confirm('Reset all configuration to defaults?')) {
                        resetConfig();
                      }
                    }}
                  >
                    Reset All Settings
                  </Button>

                  <Typography variant="caption" color="text.secondary">
                    This will reset ALL configuration to default values. This action cannot be
                    undone.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
