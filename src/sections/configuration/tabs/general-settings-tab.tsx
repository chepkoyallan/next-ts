'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';

import { useConfig } from '@app/config/hooks/use-config';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

export function GeneralSettingsTab() {
  const { config } = useConfig();

  const activeFeatures = Object.entries(config.features).filter(([_, enabled]) => enabled);
  const activeModules = Object.entries(config.modules).filter(([_, module]) => module.enabled);

  const stats = [
    {
      label: 'Active Features',
      value: activeFeatures.length,
      total: Object.keys(config.features).length,
      color: 'primary' as const,
      icon: 'solar:widget-2-bold-duotone',
    },
    {
      label: 'Active Modules',
      value: activeModules.length,
      total: Object.keys(config.modules).length,
      color: 'success' as const,
      icon: 'solar:layers-minimalistic-bold-duotone',
    },
    {
      label: 'Color Presets',
      value: config.ui.availableColorPresets.length,
      total: config.ui.availableColorPresets.length,
      color: 'info' as const,
      icon: 'solar:pallete-2-bold-duotone',
    },
    {
      label: 'Languages',
      value: config.localization.availableLanguages.length,
      total: config.localization.availableLanguages.length,
      color: 'warning' as const,
      icon: 'solar:global-bold-duotone',
    },
  ];

  return (
    <Stack spacing={4}>
      {/* Overview Stats */}
      <Grid container spacing={3}>
        {stats.map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.label}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: `${stat.color}.lighter`,
                        color: `${stat.color}.main`,
                      }}
                    >
                      <Iconify icon={stat.icon} width={24} />
                    </Box>
                  </Stack>

                  <div>
                    <Typography variant="h3">{stat.value}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </div>

                  <LinearProgress
                    variant="determinate"
                    value={(stat.value / stat.total) * 100}
                    color={stat.color}
                    sx={{ height: 6, borderRadius: 1 }}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Application Info */}
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant="h6">Application Information</Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Application Name
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {config.branding.appName}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Company Name
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {config.branding.companyName}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Version
                    </Typography>
                    <Chip label={config.version} size="small" color="primary" />
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Environment
                    </Typography>
                    <Chip
                      label={config.environment.toUpperCase()}
                      size="small"
                      color={
                        config.environment === 'production'
                          ? 'error'
                          : config.environment === 'staging'
                            ? 'warning'
                            : 'success'
                      }
                    />
                  </Box>
                </Stack>
              </Grid>

              <Grid item xs={12} md={6}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Current Theme
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {config.ui.defaultTheme.charAt(0).toUpperCase() +
                        config.ui.defaultTheme.slice(1)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Layout
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {config.ui.defaultLayout.charAt(0).toUpperCase() +
                        config.ui.defaultLayout.slice(1)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Default Language
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {config.localization.defaultLanguage.toUpperCase()}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Auth Provider
                    </Typography>
                    <Chip label={config.auth.provider.toUpperCase()} size="small" color="info" />
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* Active Features */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Active Features</Typography>
            <Typography variant="body2" color="text.secondary">
              Currently enabled features in your application
            </Typography>
            <Divider />
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {activeFeatures.map(([feature]) => (
                <Chip
                  key={feature}
                  label={feature.replace('enable', '')}
                  color="primary"
                  variant="outlined"
                  icon={<Iconify icon="solar:check-circle-bold-duotone" width={16} />}
                />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Active Modules */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Active Modules</Typography>
            <Typography variant="body2" color="text.secondary">
              Currently enabled modules with their configurations
            </Typography>
            <Divider />
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {activeModules.map(([moduleName, moduleConfig]) => (
                <Chip
                  key={moduleName}
                  label={
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <span>{moduleName}</span>
                      {moduleConfig.beta && (
                        <Chip label="BETA" size="small" color="warning" sx={{ height: 16 }} />
                      )}
                    </Stack>
                  }
                  color="success"
                  variant="outlined"
                  icon={<Iconify icon="solar:check-circle-bold-duotone" width={16} />}
                />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">System Status</Typography>
            <Divider />
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:check-circle-bold-duotone" width={20} color="success.main" />
                  <Typography variant="body2">Configuration Valid</Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:check-circle-bold-duotone" width={20} color="success.main" />
                  <Typography variant="body2">Auto-save Enabled</Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:check-circle-bold-duotone" width={20} color="success.main" />
                  <Typography variant="body2">LocalStorage Available</Typography>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
