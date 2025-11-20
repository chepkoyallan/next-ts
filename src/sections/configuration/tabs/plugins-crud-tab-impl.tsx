// Plugins CRUD Tab
// Manage, install, and configure plugins
// ----------------------------------------------------------------------

'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
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
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

import { useConfig } from '@app/config/hooks/use-config';
import type { Plugin, PluginType } from '@app/types';
import { pluginManager } from '@app/config/plugins/plugin-manager';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

const PLUGIN_TYPES: PluginType[] = ['ui', 'api', 'integration', 'theme', 'utility', 'full'];

export function PluginsCrudTab() {
  const { config, setValue } = useConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);

  const [formData, setFormData] = useState<Partial<Plugin>>({
    name: '',
    description: '',
    version: '1.0.0',
    author: '',
    enabled: false,
    type: 'utility',
  });

  const allPlugins = config.plugins || [];

  const handleOpenDialog = (plugin?: Plugin) => {
    if (plugin) {
      setEditingPlugin(plugin);
      setFormData(plugin);
    } else {
      setEditingPlugin(null);
      setFormData({
        name: '',
        description: '',
        version: '1.0.0',
        author: '',
        enabled: false,
        type: 'utility',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlugin(null);
  };

  const handleSave = () => {
    if (!formData.name) {
      alert('Plugin name is required');
      return;
    }

    const newPlugin: Plugin = {
      id: editingPlugin?.id || `plugin-${Date.now()}`,
      name: formData.name!,
      description: formData.description,
      version: formData.version || '1.0.0',
      author: formData.author,
      enabled: formData.enabled ?? false,
      type: formData.type || 'utility',
      status: 'inactive',
      routes: formData.routes,
      navigation: formData.navigation,
      components: formData.components,
      layouts: formData.layouts,
      sections: formData.sections,
      hooks: formData.hooks,
      apis: formData.apis,
      settings: formData.settings,
      dependencies: formData.dependencies,
      metadata: formData.metadata,
      installDate: editingPlugin?.installDate || new Date().toISOString(),
      updateDate: new Date().toISOString(),
      isSystem: editingPlugin?.isSystem || false,
      source: formData.source || 'local',
    };

    let updatedPlugins: Plugin[];

    if (editingPlugin) {
      updatedPlugins = allPlugins.map((p) => (p.id === editingPlugin.id ? newPlugin : p));
    } else {
      updatedPlugins = [...allPlugins, newPlugin];
    }

    setValue('plugins', updatedPlugins);
    handleCloseDialog();
  };

  const handleDelete = (plugin: Plugin) => {
    if (plugin.isSystem) {
      alert('Cannot delete system plugins');
      return;
    }

    if (window.confirm(`Are you sure you want to delete plugin "${plugin.name}"?`)) {
      const updatedPlugins = allPlugins.filter((p) => p.id !== plugin.id);
      setValue('plugins', updatedPlugins);
    }
  };

  const handleToggleEnabled = (plugin: Plugin) => {
    if (plugin.enabled) {
      pluginManager.disablePlugin(plugin.id);
    } else {
      pluginManager.enablePlugin(plugin.id);
    }
  };

  const getTypeColor = (type: PluginType) => {
    switch (type) {
      case 'ui':
        return 'primary';
      case 'api':
        return 'success';
      case 'integration':
        return 'info';
      case 'theme':
        return 'secondary';
      case 'utility':
        return 'warning';
      case 'full':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status?: Plugin['status']) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'error':
        return 'error';
      case 'loading':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Install and manage plugins to extend application functionality
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:add-circle-bold-duotone" />}
          onClick={() => handleOpenDialog()}
        >
          Add Plugin
        </Button>
      </Stack>

      <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold-duotone" />}>
        Plugins allow you to extend the application with custom routes, components, layouts, and
        more. Enable plugins to activate their functionality.
      </Alert>

      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Plugin</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allPlugins.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No plugins installed. Click "Add Plugin" to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {allPlugins.map((plugin) => (
              <TableRow key={plugin.id} hover>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle2">{plugin.name}</Typography>
                      {plugin.isSystem && (
                        <Chip label="System" size="small" color="default" variant="outlined" />
                      )}
                    </Stack>
                    {plugin.description && (
                      <Typography variant="caption" color="text.secondary">
                        {plugin.description}
                      </Typography>
                    )}
                    {plugin.author && (
                      <Typography variant="caption" color="text.disabled">
                        by {plugin.author}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={plugin.type} size="small" color={getTypeColor(plugin.type) as any} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    v{plugin.version}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={plugin.status || 'inactive'}
                    size="small"
                    color={getStatusColor(plugin.status) as any}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={plugin.enabled}
                    onChange={() => handleToggleEnabled(plugin)}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <IconButton size="small" onClick={() => handleOpenDialog(plugin)}>
                      <Iconify icon="solar:pen-bold-duotone" width={18} />
                    </IconButton>
                    {!plugin.isSystem && (
                      <IconButton size="small" color="error" onClick={() => handleDelete(plugin)}>
                        <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
                      </IconButton>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPlugin ? 'Edit Plugin' : 'Add Plugin'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Plugin Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Version"
                fullWidth
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              />

              <TextField
                label="Author"
                fullWidth
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              />
            </Stack>

            <FormControl fullWidth>
              <InputLabel>Plugin Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as PluginType })}
                label="Plugin Type"
              >
                {PLUGIN_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={type} size="small" color={getTypeColor(type) as any} />
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label="Enabled"
            />

            <Alert severity="info">
              <Typography variant="body2">
                Plugin configuration (routes, components, hooks) can be added programmatically after
                creation.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingPlugin ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
