'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Select from '@mui/material/Select';
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

import { useConfig } from '@app/config/hooks/use-config';
import type { CustomNavItem } from '@app/types';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

const ICON_OPTIONS = [
  { value: 'solar:home-2-bold-duotone', label: 'Home' },
  { value: 'solar:widget-2-bold-duotone', label: 'Widget' },
  { value: 'solar:settings-bold-duotone', label: 'Settings' },
  { value: 'solar:user-bold-duotone', label: 'User' },
  { value: 'solar:chart-2-bold-duotone', label: 'Chart' },
  { value: 'solar:document-text-bold-duotone', label: 'Document' },
  { value: 'solar:bag-4-bold-duotone', label: 'Shopping' },
  { value: 'solar:dollar-bold-duotone', label: 'Dollar' },
  { value: 'solar:layers-minimalistic-bold-duotone', label: 'Layers' },
  { value: 'solar:box-bold-duotone', label: 'Box' },
  { value: 'solar:card-bold-duotone', label: 'Card' },
  { value: 'solar:calendar-bold-duotone', label: 'Calendar' },
  { value: 'solar:bell-bold-duotone', label: 'Bell' },
  { value: 'solar:shield-check-bold-duotone', label: 'Shield' },
  { value: 'solar:lock-password-bold-duotone', label: 'Lock' },
  { value: 'solar:global-bold-duotone', label: 'Global' },
];

export function NavigationCrudTab() {
  const { config, setValue } = useConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomNavItem | null>(null);
  const [formData, setFormData] = useState<Partial<CustomNavItem>>({
    title: '',
    path: '',
    icon: ICON_OPTIONS[0].value,
    section: 'overview',
    enabled: true,
    hidden: false,
    external: false,
    roles: [],
    badge: '',
    order: 0,
  });

  const handleOpenDialog = (item?: CustomNavItem) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({
        title: '',
        path: '',
        icon: ICON_OPTIONS[0].value,
        section: 'overview',
        enabled: true,
        hidden: false,
        external: false,
        roles: [],
        badge: '',
        order: config.navigation.customItems.length,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSave = () => {
    if (!formData.title || !formData.path) {
      alert('Title and Path are required');
      return;
    }

    const newItem: CustomNavItem = {
      id: editingItem?.id || `custom-${Date.now()}`,
      title: formData.title!,
      path: formData.path!,
      icon: formData.icon,
      section: formData.section || 'custom',
      enabled: formData.enabled ?? true,
      hidden: formData.hidden ?? false,
      external: formData.external ?? false,
      roles: formData.roles || [],
      badge: formData.badge || undefined,
      order: formData.order ?? 0,
      parentId: formData.parentId || null,
    };

    let updatedItems: CustomNavItem[];

    if (editingItem) {
      // Update existing item
      updatedItems = config.navigation.customItems.map((item) =>
        item.id === editingItem.id ? newItem : item
      );
    } else {
      // Add new item
      updatedItems = [...config.navigation.customItems, newItem];
    }

    setValue('navigation.customItems', updatedItems);
    handleCloseDialog();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this navigation item?')) {
      const updatedItems = config.navigation.customItems.filter((item) => item.id !== id);
      setValue('navigation.customItems', updatedItems);
    }
  };

  const handleToggleEnabled = (id: string) => {
    const updatedItems = config.navigation.customItems.map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    setValue('navigation.customItems', updatedItems);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updatedItems = [...config.navigation.customItems];
    [updatedItems[index - 1], updatedItems[index]] = [updatedItems[index], updatedItems[index - 1]];
    // Update order values
    updatedItems.forEach((item, idx) => {
      item.order = idx;
    });
    setValue('navigation.customItems', updatedItems);
  };

  const handleMoveDown = (index: number) => {
    if (index === config.navigation.customItems.length - 1) return;
    const updatedItems = [...config.navigation.customItems];
    [updatedItems[index], updatedItems[index + 1]] = [updatedItems[index + 1], updatedItems[index]];
    // Update order values
    updatedItems.forEach((item, idx) => {
      item.order = idx;
    });
    setValue('navigation.customItems', updatedItems);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Create, edit, and manage custom navigation items
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:add-circle-bold-duotone" />}
          onClick={() => handleOpenDialog()}
        >
          Add Navigation Item
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={40}>Order</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Roles</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {config.navigation.customItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                      <Stack alignItems="center" spacing={2}>
                        <Iconify
                          icon="solar:inbox-line-bold-duotone"
                          width={64}
                          sx={{ color: 'text.disabled' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          No custom navigation items yet. Click "Add Navigation Item" to create one.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : (
                  config.navigation.customItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                          >
                            <Iconify icon="solar:alt-arrow-up-bold" width={16} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === config.navigation.customItems.length - 1}
                          >
                            <Iconify icon="solar:alt-arrow-down-bold" width={16} />
                          </IconButton>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {item.icon && <Iconify icon={item.icon} width={20} />}
                          <Typography variant="body2">{item.title}</Typography>
                          {item.badge && <Chip label={item.badge} size="small" color="error" />}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {item.path}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={item.section} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.enabled}
                          onChange={() => handleToggleEnabled(item.id)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {item.roles && item.roles.length > 0 ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {item.roles.map((role) => (
                              <Chip key={role} label={role} size="small" />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            All users
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(item)}
                            color="primary"
                          >
                            <Iconify icon="solar:pen-bold-duotone" width={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(item.id)}
                            color="error"
                          >
                            <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
                          </IconButton>
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Edit Navigation Item' : 'Create Navigation Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
              helperText="The display name of the navigation item"
            />

            <TextField
              label="Path"
              value={formData.path}
              onChange={(e) => setFormData({ ...formData, path: e.target.value })}
              fullWidth
              required
              helperText="URL path (e.g., /dashboard/custom or https://external.com)"
            />

            <FormControl fullWidth>
              <InputLabel>Icon</InputLabel>
              <Select
                value={formData.icon}
                label="Icon"
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              >
                {ICON_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Iconify icon={option.value} width={20} />
                      <span>{option.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Section</InputLabel>
              <Select
                value={formData.section}
                label="Section"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    section: e.target.value,
                  })
                }
              >
                <MenuItem value="overview">Overview (System)</MenuItem>
                <MenuItem value="management">Management (System)</MenuItem>
                <MenuItem value="otherCases">Other Cases (System)</MenuItem>
                {(config.navigation.customSections || []).map((section) => (
                  <MenuItem key={section.id} value={section.id}>
                    {section.label} (Custom)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Badge (optional)"
              value={formData.badge}
              onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
              fullWidth
              helperText="Optional badge text (e.g., 'NEW', '+5')"
            />

            <TextField
              label="Required Roles (comma-separated)"
              value={formData.roles?.join(', ') || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  roles: e.target.value
                    .split(',')
                    .map((r) => r.trim())
                    .filter(Boolean),
                })
              }
              fullWidth
              helperText="Leave empty for all users. E.g., 'admin, manager'"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.external ?? false}
                  onChange={(e) => setFormData({ ...formData, external: e.target.checked })}
                />
              }
              label="External Link (opens in new tab)"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled ?? true}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label="Enabled"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.hidden ?? false}
                  onChange={(e) => setFormData({ ...formData, hidden: e.target.checked })}
                />
              }
              label="Hidden"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
