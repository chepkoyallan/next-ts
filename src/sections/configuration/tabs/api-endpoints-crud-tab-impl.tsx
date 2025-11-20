'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';

import { useConfig } from '@app/config/hooks/use-config';
import type { APIEndpointConfig } from '@app/types';
import {
  useDiscoveredEndpoints,
  discoveredToConfig,
} from 'src/app/api/lib/discovery/use-discovered-endpoints';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

const HTTP_METHODS: APIEndpointConfig['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function APIEndpointsCrudTab() {
  const { config, setValue } = useConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<APIEndpointConfig | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState<APIEndpointConfig | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());

  // Use discovery hook
  const {
    endpoints: discoveredEndpoints,
    loading: discoveryLoading,
    error: discoveryError,
  } = useDiscoveredEndpoints();

  const [formData, setFormData] = useState<Partial<APIEndpointConfig>>({
    name: '',
    description: '',
    path: '/',
    method: 'GET',
    enabled: true,
    proxy: {
      enabled: false,
      targetUrl: '',
      headers: {},
      timeout: 30000,
      followRedirects: true,
    },
    auth: {
      required: false,
      roles: [],
      permissions: [],
      apiKeyAllowed: false,
    },
    rateLimit: {
      enabled: false,
      windowMs: 60000,
      maxRequests: 100,
    },
    tags: [],
  });

  const allEndpoints = config.customEndpoints || [];

  const handleOpenDialog = (endpoint?: APIEndpointConfig) => {
    if (endpoint) {
      setEditingEndpoint(endpoint);
      setFormData(endpoint);
    } else {
      setEditingEndpoint(null);
      setFormData({
        name: '',
        description: '',
        path: '/',
        method: 'GET',
        enabled: true,
        proxy: {
          enabled: false,
          targetUrl: '',
          headers: {},
          timeout: 30000,
          followRedirects: true,
        },
        auth: {
          required: false,
          roles: [],
          permissions: [],
          apiKeyAllowed: false,
        },
        rateLimit: {
          enabled: false,
          windowMs: 60000,
          maxRequests: 100,
        },
        tags: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEndpoint(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.path) {
      alert('Name and Path are required');
      return;
    }

    const newEndpoint: APIEndpointConfig = {
      id: editingEndpoint?.id || `endpoint-${Date.now()}`,
      name: formData.name!,
      description: formData.description,
      path: formData.path!,
      method: formData.method || 'GET',
      enabled: formData.enabled ?? true,
      proxy: formData.proxy,
      auth: formData.auth,
      rateLimit: formData.rateLimit,
      requestHeaders: formData.requestHeaders,
      responseHeaders: formData.responseHeaders,
      tags: formData.tags,
      version: formData.version,
      deprecated: formData.deprecated,
      isSystem: editingEndpoint?.isSystem || false,
      createdAt: editingEndpoint?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedEndpoints: APIEndpointConfig[];

    if (editingEndpoint) {
      updatedEndpoints = allEndpoints.map((e) => (e.id === editingEndpoint.id ? newEndpoint : e));
    } else {
      updatedEndpoints = [...allEndpoints, newEndpoint];
    }

    setValue('customEndpoints', updatedEndpoints);
    handleCloseDialog();
  };

  const handleDelete = (endpoint: APIEndpointConfig) => {
    if (endpoint.isSystem) {
      alert('Cannot delete system endpoints');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${endpoint.name}"?`)) {
      const updatedEndpoints = allEndpoints.filter((e) => e.id !== endpoint.id);
      setValue('customEndpoints', updatedEndpoints);
    }
  };

  const handleToggleEnabled = (endpoint: APIEndpointConfig) => {
    const updatedEndpoints = allEndpoints.map((e) =>
      e.id === endpoint.id ? { ...e, enabled: !e.enabled } : e
    );
    setValue('customEndpoints', updatedEndpoints);
  };

  const handleTest = (endpoint: APIEndpointConfig) => {
    setTestingEndpoint(endpoint);
    setTestResult(null);
    setTestDialogOpen(true);
  };

  const runTest = async () => {
    if (!testingEndpoint) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const url = `/api/dynamic${testingEndpoint.path}`;
      const options: RequestInit = {
        method: testingEndpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await fetch(url, options);
      const data = await response.json();

      setTestResult({
        success: true,
        status: response.status,
        statusText: response.statusText,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleOpenImportDialog = () => {
    setSelectedEndpoints(new Set());
    setImportDialogOpen(true);
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setSelectedEndpoints(new Set());
  };

  const handleToggleEndpoint = (endpointId: string) => {
    setSelectedEndpoints((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(endpointId)) {
        newSet.delete(endpointId);
      } else {
        newSet.add(endpointId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedEndpoints.size === discoveredEndpoints.length) {
      setSelectedEndpoints(new Set());
    } else {
      setSelectedEndpoints(new Set(discoveredEndpoints.map((ep) => ep.id)));
    }
  };

  const handleImportSelected = () => {
    const endpointsToImport = discoveredEndpoints
      .filter((ep) => selectedEndpoints.has(ep.id))
      .map((ep) => {
        const config = discoveredToConfig(ep);
        return {
          ...config,
          id: ep.id,
          name: config.name || `${ep.methods[0]} ${ep.routePath}`,
          path: config.path || ep.routePath.replace('/api/v1', ''),
          method: config.method || (ep.methods[0] as any),
          enabled: false, // Start disabled by default
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as APIEndpointConfig;
      });

    // Merge with existing endpoints (avoid duplicates)
    const existingIds = new Set(allEndpoints.map((e) => e.id));
    const newEndpoints = endpointsToImport.filter((e) => !existingIds.has(e.id));

    if (newEndpoints.length === 0) {
      alert('All selected endpoints are already imported');
      return;
    }

    setValue('customEndpoints', [...allEndpoints, ...newEndpoints]);
    handleCloseImportDialog();
    alert(`Successfully imported ${newEndpoints.length} endpoint(s)`);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'info';
      case 'POST':
        return 'success';
      case 'PUT':
        return 'warning';
      case 'PATCH':
        return 'secondary';
      case 'DELETE':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Create and manage custom API endpoints with proxying and authentication
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Iconify icon="solar:import-bold-duotone" />}
            onClick={handleOpenImportDialog}
          >
            Import Discovered
          </Button>
          <Button
            variant="contained"
            startIcon={<Iconify icon="solar:add-circle-bold-duotone" />}
            onClick={() => handleOpenDialog()}
          >
            Add API Endpoint
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold-duotone" />}>
        Custom endpoints are available at <code>/api/dynamic/[your-path]</code>. They can proxy to
        external APIs or serve custom responses.
      </Alert>

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Method</TableCell>
                  <TableCell>Name & Path</TableCell>
                  <TableCell>Proxy</TableCell>
                  <TableCell>Auth</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allEndpoints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <Stack alignItems="center" spacing={2}>
                        <Iconify
                          icon="solar:server-bold-duotone"
                          width={64}
                          sx={{ color: 'text.disabled' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          No custom API endpoints yet. Click "Add API Endpoint" to create one.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : (
                  allEndpoints.map((endpoint) => (
                    <TableRow key={endpoint.id}>
                      <TableCell>
                        <Chip
                          label={endpoint.method}
                          size="small"
                          color={getMethodColor(endpoint.method) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack>
                          <Typography variant="subtitle2">{endpoint.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            /api/dynamic{endpoint.path}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {endpoint.proxy?.enabled ? (
                          <Stack>
                            <Chip label="Enabled" size="small" color="success" variant="outlined" />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                              {endpoint.proxy.targetUrl}
                            </Typography>
                          </Stack>
                        ) : (
                          <Chip label="Disabled" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        {endpoint.auth?.required ? (
                          <Chip label="Required" size="small" color="warning" variant="outlined" />
                        ) : (
                          <Chip label="Public" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={endpoint.enabled}
                          onChange={() => handleToggleEnabled(endpoint)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            onClick={() => handleTest(endpoint)}
                            color="success"
                            disabled={!endpoint.enabled}
                          >
                            <Iconify icon="solar:play-circle-bold-duotone" width={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(endpoint)}
                            color="primary"
                          >
                            <Iconify icon="solar:pen-bold-duotone" width={18} />
                          </IconButton>
                          {!endpoint.isSystem && (
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(endpoint)}
                              color="error"
                            >
                              <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
                            </IconButton>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingEndpoint ? 'Edit API Endpoint' : 'Create API Endpoint'}
          {editingEndpoint?.isSystem && (
            <Chip label="System" size="small" color="primary" sx={{ ml: 1 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* Basic Info */}
            <TextField
              label="Endpoint Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              helperText="A descriptive name for this endpoint"
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            <Stack direction="row" spacing={2}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Method</InputLabel>
                <Select
                  value={formData.method}
                  label="Method"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      method: e.target.value as APIEndpointConfig['method'],
                    })
                  }
                >
                  {HTTP_METHODS.map((method) => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Path"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                fullWidth
                required
                helperText="Will be available at /api/dynamic{path}"
                placeholder="/my-endpoint"
              />
            </Stack>

            {/* Proxy Configuration */}
            <Accordion>
              <AccordionSummary expandIcon={<Iconify icon="solar:alt-arrow-down-bold" />}>
                <Typography variant="subtitle2">Proxy Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.proxy?.enabled || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            proxy: { ...formData.proxy!, enabled: e.target.checked },
                          })
                        }
                      />
                    }
                    label="Enable Proxy"
                  />

                  {formData.proxy?.enabled && (
                    <>
                      <TextField
                        label="Target URL"
                        value={formData.proxy.targetUrl}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            proxy: { ...formData.proxy!, targetUrl: e.target.value },
                          })
                        }
                        fullWidth
                        placeholder="https://api.example.com/endpoint"
                        helperText="Full URL to proxy requests to"
                      />

                      <TextField
                        label="Timeout (ms)"
                        type="number"
                        value={formData.proxy.timeout}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            proxy: { ...formData.proxy!, timeout: parseInt(e.target.value, 10) },
                          })
                        }
                        fullWidth
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.proxy.followRedirects}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                proxy: { ...formData.proxy!, followRedirects: e.target.checked },
                              })
                            }
                          />
                        }
                        label="Follow Redirects"
                      />
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Authentication */}
            <Accordion>
              <AccordionSummary expandIcon={<Iconify icon="solar:alt-arrow-down-bold" />}>
                <Typography variant="subtitle2">Authentication</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.auth?.required || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            auth: { ...formData.auth!, required: e.target.checked },
                          })
                        }
                      />
                    }
                    label="Require Authentication"
                  />

                  {formData.auth?.required && (
                    <>
                      <TextField
                        label="Required Roles (comma-separated)"
                        value={formData.auth.roles?.join(', ') || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            auth: {
                              ...formData.auth!,
                              roles: e.target.value
                                .split(',')
                                .map((r) => r.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        fullWidth
                        helperText="Leave empty to allow any authenticated user"
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.auth.apiKeyAllowed || false}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                auth: { ...formData.auth!, apiKeyAllowed: e.target.checked },
                              })
                            }
                          />
                        }
                        label="Allow API Key Authentication"
                      />
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Rate Limiting */}
            <Accordion>
              <AccordionSummary expandIcon={<Iconify icon="solar:alt-arrow-down-bold" />}>
                <Typography variant="subtitle2">Rate Limiting</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.rateLimit?.enabled || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rateLimit: { ...formData.rateLimit!, enabled: e.target.checked },
                          })
                        }
                      />
                    }
                    label="Enable Rate Limiting"
                  />

                  {formData.rateLimit?.enabled && (
                    <>
                      <TextField
                        label="Time Window (ms)"
                        type="number"
                        value={formData.rateLimit.windowMs}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rateLimit: {
                              ...formData.rateLimit!,
                              windowMs: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        fullWidth
                        helperText="60000 = 1 minute"
                      />

                      <TextField
                        label="Max Requests"
                        type="number"
                        value={formData.rateLimit.maxRequests}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rateLimit: {
                              ...formData.rateLimit!,
                              maxRequests: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        fullWidth
                        helperText="Maximum requests allowed per time window"
                      />
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingEndpoint ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Dialog */}
      <Dialog
        open={testDialogOpen}
        onClose={() => setTestDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Test Endpoint: {testingEndpoint?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>URL:</strong> /api/dynamic{testingEndpoint?.path}
              </Typography>
              <Typography variant="body2">
                <strong>Method:</strong> {testingEndpoint?.method}
              </Typography>
            </Alert>

            <Button
              variant="contained"
              onClick={runTest}
              disabled={testLoading}
              startIcon={<Iconify icon="solar:play-circle-bold-duotone" />}
            >
              {testLoading ? 'Testing...' : 'Send Test Request'}
            </Button>

            {testResult && (
              <Card sx={{ bgcolor: 'background.neutral' }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Response:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }}
                  >
                    {JSON.stringify(testResult, null, 2)}
                  </Box>
                </CardContent>
              </Card>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Import Discovered Endpoints Dialog */}
      <Dialog open={importDialogOpen} onClose={handleCloseImportDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">Import Discovered Endpoints</Typography>
              <Typography variant="body2" color="text.secondary">
                Select endpoints from /api/v1/ to import and configure
              </Typography>
            </Box>
            <Chip
              label={`${selectedEndpoints.size} selected`}
              color={selectedEndpoints.size > 0 ? 'primary' : 'default'}
            />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {discoveryLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {discoveryError && (
              <Alert severity="error">Failed to discover endpoints: {discoveryError}</Alert>
            )}

            {!discoveryLoading && !discoveryError && discoveredEndpoints.length === 0 && (
              <Alert severity="info">No endpoints discovered in /api/v1/</Alert>
            )}

            {!discoveryLoading && !discoveryError && discoveredEndpoints.length > 0 && (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Found {discoveredEndpoints.length} endpoints
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleSelectAll}
                    startIcon={<Iconify icon="solar:checklist-bold-duotone" />}
                  >
                    {selectedEndpoints.size === discoveredEndpoints.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </Stack>

                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={
                              selectedEndpoints.size === discoveredEndpoints.length &&
                              discoveredEndpoints.length > 0
                            }
                            indeterminate={
                              selectedEndpoints.size > 0 &&
                              selectedEndpoints.size < discoveredEndpoints.length
                            }
                            onChange={handleSelectAll}
                          />
                        </TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Path</TableCell>
                        <TableCell>Domain</TableCell>
                        <TableCell>Auth</TableCell>
                        <TableCell>Rate Limit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {discoveredEndpoints.map((endpoint) => (
                        <TableRow
                          key={endpoint.id}
                          hover
                          onClick={() => handleToggleEndpoint(endpoint.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox checked={selectedEndpoints.has(endpoint.id)} />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5}>
                              {endpoint.methods.map((method) => (
                                <Chip
                                  key={method}
                                  label={method}
                                  size="small"
                                  color={getMethodColor(method) as any}
                                />
                              ))}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {endpoint.routePath}
                            </Typography>
                            {endpoint.description && (
                              <Typography variant="caption" color="text.secondary">
                                {endpoint.description}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip label={endpoint.domain} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            {endpoint.auth.required ? (
                              <Chip label="Required" size="small" color="warning" />
                            ) : (
                              <Chip label="Optional" size="small" color="default" />
                            )}
                          </TableCell>
                          <TableCell>
                            {endpoint.rateLimit ? (
                              <Chip
                                label={`${endpoint.rateLimit.maxRequests}/${
                                  endpoint.rateLimit.windowMs / 1000
                                }s`}
                                size="small"
                                color="info"
                              />
                            ) : (
                              <Chip label="None" size="small" color="default" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog}>Cancel</Button>
          <Button
            onClick={handleImportSelected}
            variant="contained"
            disabled={selectedEndpoints.size === 0}
            startIcon={<Iconify icon="solar:import-bold-duotone" />}
          >
            Import {selectedEndpoints.size > 0 && `(${selectedEndpoints.size})`}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
