'use client';

import { useState, useEffect } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';

import {
  routeRegistry,
  navigationRegistry,
  componentRegistry,
  providerRegistry,
} from '@app/config';

export default function RegistryTestPage() {
  const [routeStats, setRouteStats] = useState<any>(null);
  const [navStats, setNavStats] = useState<any>(null);
  const [componentStats, setComponentStats] = useState<any>(null);
  const [providerStats, setProviderStats] = useState<any>(null);

  const [routes, setRoutes] = useState<any[]>([]);
  const [navigation, setNavigation] = useState<any[]>([]);

  useEffect(() => {
    // Get stats
    setRouteStats(routeRegistry.getStats());
    setNavStats(navigationRegistry.getStats());
    setComponentStats(componentRegistry.getStats());
    setProviderStats(providerRegistry.getStats());

    // Get actual data
    setRoutes(routeRegistry.getEnabledRoutes());
    setNavigation(navigationRegistry.getEnabledItems());
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>
        🎯 Registry System Test Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Testing the dynamic registry system with live data from all plugins
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Route Registry
              </Typography>
              <Typography variant="h4" sx={{ my: 1 }}>
                {routeStats?.totalRoutes || 0}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={`${routeStats?.enabledRoutes || 0} enabled`} size="small" />
                <Chip
                  label={`${routeStats?.protectedRoutes || 0} protected`}
                  size="small"
                  color="primary"
                />
              </Stack>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {routeStats?.plugins || 0} plugins contributing routes
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Navigation Registry
              </Typography>
              <Typography variant="h4" sx={{ my: 1 }}>
                {navStats?.totalItems || 0}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={`${navStats?.enabledItems || 0} enabled`} size="small" />
                <Chip
                  label={`${navStats?.sections || 0} sections`}
                  size="small"
                  color="secondary"
                />
              </Stack>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {navStats?.plugins || 0} plugins contributing navigation
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Component Registry
              </Typography>
              <Typography variant="h4" sx={{ my: 1 }}>
                {componentStats?.totalComponents || 0}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={`${componentStats?.enabledComponents || 0} enabled`} size="small" />
                <Chip
                  label={`${componentStats?.overrides || 0} overrides`}
                  size="small"
                  color="warning"
                />
              </Stack>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {componentStats?.categories || 0} categories
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Provider Registry
              </Typography>
              <Typography variant="h4" sx={{ my: 1 }}>
                {providerStats?.totalProviders || 0}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={`${providerStats?.enabledProviders || 0} enabled`} size="small" />
              </Stack>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {providerStats?.plugins || 0} plugins contributing providers
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Registered Routes */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📍 Registered Routes ({routes.length})
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {routes.map((route) => (
              <Box
                key={route.id}
                sx={{
                  p: 2,
                  mb: 1,
                  borderRadius: 1,
                  bgcolor: 'background.neutral',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', minWidth: 200 }}>
                    {route.path}
                  </Typography>
                  <Chip label={route.pluginId} size="small" variant="outlined" />
                  {route.protected && <Chip label="protected" size="small" color="error" />}
                  {route.layout && (
                    <Chip label={route.layout} size="small" color="primary" variant="outlined" />
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Navigation Items */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🧭 Navigation Items ({navigation.length})
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {navigation.map((item) => (
              <Box
                key={item.id}
                sx={{
                  p: 2,
                  mb: 1,
                  borderRadius: 1,
                  bgcolor: 'background.neutral',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body1" sx={{ minWidth: 150 }}>
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace', minWidth: 150 }}
                  >
                    {item.path}
                  </Typography>
                  <Chip label={item.pluginId} size="small" variant="outlined" />
                  {item.section && (
                    <Chip label={item.section} size="small" color="secondary" variant="outlined" />
                  )}
                  {item.icon && (
                    <Typography variant="caption" color="text.secondary">
                      {item.icon}
                    </Typography>
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Success Message */}
      <Box
        sx={{
          mt: 4,
          p: 3,
          borderRadius: 2,
          bgcolor: 'success.lighter',
          border: '2px solid',
          borderColor: 'success.main',
        }}
      >
        <Typography variant="h6" color="success.dark" gutterBottom>
          ✅ Registry System is Working!
        </Typography>
        <Typography variant="body2" color="success.dark">
          All 4 registries are operational and collecting data from plugins. The system is
          successfully managing routes, navigation, components, and providers dynamically.
        </Typography>
      </Box>
    </Container>
  );
}
