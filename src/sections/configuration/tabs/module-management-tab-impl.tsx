'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import type { ModulesConfig } from '@app/types';
import { useConfig } from '@app/config/hooks/use-config';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

export function ModuleManagementTab() {
  const { config, setValue } = useConfig();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const handleToggleModule = (module: keyof ModulesConfig) => {
    setValue(`modules.${module}.enabled`, !config.modules[module].enabled);
  };

  const handleToggleHidden = (module: keyof ModulesConfig) => {
    setValue(`modules.${module}.hidden`, !config.modules[module].hidden);
  };

  const handleAddPermission = (module: keyof ModulesConfig, permission: string) => {
    const currentPermissions = config.modules[module].permissions;
    if (!currentPermissions.includes(permission)) {
      setValue(`modules.${module}.permissions`, [...currentPermissions, permission]);
    }
  };

  const handleRemovePermission = (module: keyof ModulesConfig, permission: string) => {
    const currentPermissions = config.modules[module].permissions;
    setValue(
      `modules.${module}.permissions`,
      currentPermissions.filter((p) => p !== permission)
    );
  };

  const modules = Object.keys(config.modules) as Array<keyof ModulesConfig>;

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        Configure which modules are enabled and set required permissions
      </Typography>

      <Grid container spacing={2}>
        {modules.map((moduleKey) => {
          const module = config.modules[moduleKey];
          const isExpanded = expandedModule === moduleKey;

          return (
            <Grid item xs={12} sm={6} md={4} key={moduleKey}>
              <Card
                sx={{
                  border: 2,
                  borderColor: module.enabled ? 'primary.main' : 'divider',
                  height: '100%',
                }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    {/* Header */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={module.enabled}
                            onChange={() => handleToggleModule(moduleKey)}
                            color="primary"
                          />
                        }
                        label={
                          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                            {moduleKey}
                          </Typography>
                        }
                        sx={{ m: 0 }}
                      />

                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {module.beta && <Chip label="BETA" size="small" color="warning" />}
                        {module.badge && <Chip label={module.badge} size="small" color="error" />}
                        <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
                          <IconButton
                            size="small"
                            onClick={() => setExpandedModule(isExpanded ? null : moduleKey)}
                          >
                            <Iconify
                              icon={
                                isExpanded
                                  ? 'eva:arrow-ios-upward-fill'
                                  : 'eva:arrow-ios-downward-fill'
                              }
                            />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <Stack spacing={2}>
                        {/* Hidden Toggle */}
                        <FormControlLabel
                          control={
                            <Switch
                              checked={module.hidden || false}
                              onChange={() => handleToggleHidden(moduleKey)}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="caption" color="text.secondary">
                              Hide in navigation
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />

                        {/* Permissions */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" gutterBottom>
                            Required Roles
                          </Typography>
                          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                            {module.permissions.length === 0 ? (
                              <Chip label="All Users" size="small" variant="outlined" />
                            ) : (
                              module.permissions.map((permission) => (
                                <Chip
                                  key={permission}
                                  label={permission}
                                  size="small"
                                  onDelete={() => handleRemovePermission(moduleKey, permission)}
                                />
                              ))
                            )}
                          </Stack>

                          {/* Add Permission */}
                          <TextField
                            size="small"
                            placeholder="Add role (press Enter)"
                            fullWidth
                            sx={{ mt: 1 }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement;
                                if (input.value.trim()) {
                                  handleAddPermission(moduleKey, input.value.trim());
                                  input.value = '';
                                }
                              }
                            }}
                          />
                        </Box>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}
