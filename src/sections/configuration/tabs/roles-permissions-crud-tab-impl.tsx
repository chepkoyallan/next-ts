'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import { useConfig } from '@app/config/hooks/use-config';
import type { CustomRole } from '@app/types';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

// Common permission templates
const COMMON_PERMISSIONS = [
  'read',
  'write',
  'delete',
  'admin',
  'manage_users',
  'manage_roles',
  'manage_settings',
  'view_reports',
  'export_data',
  'manage_team',
  'approve',
  'review',
];

export function RolesPermissionsCrudTab() {
  const { config, setValue } = useConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [formData, setFormData] = useState<Partial<CustomRole>>({
    name: '',
    description: '',
    permissions: [],
    inheritsFrom: [],
    color: '#2196F3',
    priority: 10,
  });

  const allRoles = config.customRoles || [];

  const handleOpenDialog = (role?: CustomRole) => {
    if (role) {
      setEditingRole(role);
      setFormData(role);
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        description: '',
        permissions: [],
        inheritsFrom: [],
        color: '#2196F3',
        priority: 10,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRole(null);
  };

  const handleSave = () => {
    if (!formData.name) {
      alert('Role name is required');
      return;
    }

    const newRole: CustomRole = {
      id: editingRole?.id || formData.name.toLowerCase().replace(/\s+/g, '_'),
      name: formData.name!,
      description: formData.description,
      permissions: formData.permissions || [],
      inheritsFrom: formData.inheritsFrom,
      color: formData.color,
      isSystem: editingRole?.isSystem || false,
      priority: formData.priority || 10,
      createdAt: editingRole?.createdAt || new Date().toISOString(),
    };

    let updatedRoles: CustomRole[];

    if (editingRole) {
      updatedRoles = allRoles.map((r) => (r.id === editingRole.id ? newRole : r));
    } else {
      // Check for duplicate ID
      if (allRoles.some((r) => r.id === newRole.id)) {
        alert('A role with this name already exists');
        return;
      }
      updatedRoles = [...allRoles, newRole];
    }

    setValue('customRoles', updatedRoles);
    handleCloseDialog();
  };

  const handleDelete = (role: CustomRole) => {
    if (role.isSystem) {
      alert('Cannot delete system roles');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the "${role.name}" role?`)) {
      const updatedRoles = allRoles.filter((r) => r.id !== role.id);
      setValue('customRoles', updatedRoles);
    }
  };

  const handleAddPermission = (permission: string) => {
    if (!formData.permissions?.includes(permission)) {
      setFormData({
        ...formData,
        permissions: [...(formData.permissions || []), permission],
      });
    }
  };

  const handleRemovePermission = (permission: string) => {
    setFormData({
      ...formData,
      permissions: formData.permissions?.filter((p) => p !== permission) || [],
    });
  };

  const getInheritedPermissions = (role: CustomRole): string[] => {
    if (!role.inheritsFrom || role.inheritsFrom.length === 0) return [];

    const inherited = new Set<string>();
    role.inheritsFrom.forEach((parentId) => {
      const parent = allRoles.find((r) => r.id === parentId);
      if (parent) {
        parent.permissions.forEach((p) => inherited.add(p));
        // Recursively get inherited permissions
        getInheritedPermissions(parent).forEach((p) => inherited.add(p));
      }
    });
    return Array.from(inherited);
  };

  const getAllPermissions = (role: CustomRole): string[] => {
    const inherited = getInheritedPermissions(role);
    const combined = new Set([...role.permissions, ...inherited]);
    return Array.from(combined);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Create and manage custom roles with specific permissions
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:add-circle-bold-duotone" />}
          onClick={() => handleOpenDialog()}
        >
          Add Role
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Role</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <Stack alignItems="center" spacing={2}>
                        <Iconify
                          icon="solar:shield-user-bold-duotone"
                          width={64}
                          sx={{ color: 'text.disabled' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          No roles configured. Click "Add Role" to create one.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : (
                  allRoles
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((role) => {
                      const allPerms = getAllPermissions(role);

                      return (
                        <TableRow key={role.id}>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Chip
                                label={role.name}
                                size="small"
                                sx={{ bgcolor: role.color, color: 'white' }}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {role.description || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              {allPerms.slice(0, 3).map((perm) => (
                                <Chip key={perm} label={perm} size="small" variant="outlined" />
                              ))}
                              {allPerms.length > 3 && (
                                <Chip
                                  label={`+${allPerms.length - 3}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {allPerms.length === 0 && (
                                <Typography variant="caption" color="text.disabled">
                                  No permissions
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip label={role.priority || 0} size="small" />
                          </TableCell>
                          <TableCell>
                            {role.isSystem ? (
                              <Chip
                                label="System"
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label="Custom"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(role)}
                                color="primary"
                              >
                                <Iconify icon="solar:pen-bold-duotone" width={18} />
                              </IconButton>
                              {!role.isSystem && (
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(role)}
                                  color="error"
                                >
                                  <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
                                </IconButton>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRole ? 'Edit Role' : 'Create Role'}
          {editingRole?.isSystem && (
            <Chip label="System" size="small" color="primary" sx={{ ml: 1 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Role Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
                disabled={editingRole?.isSystem}
                helperText="A unique name for this role"
              />
              <TextField
                label="Color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                sx={{ width: 120 }}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              helperText="Optional description of this role"
            />

            <TextField
              label="Priority"
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) })}
              fullWidth
              helperText="Higher priority roles override lower ones (0-100)"
              inputProps={{ min: 0, max: 100 }}
            />

            {/* Inherit from roles */}
            <FormControl fullWidth>
              <InputLabel>Inherit Permissions From</InputLabel>
              <Select
                multiple
                value={formData.inheritsFrom || []}
                label="Inherit Permissions From"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inheritsFrom: e.target.value as string[],
                  })
                }
                renderValue={(selected) => (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {(selected as string[]).map((roleId) => {
                      const role = allRoles.find((r) => r.id === roleId);
                      return (
                        <Chip
                          key={roleId}
                          label={role?.name || roleId}
                          size="small"
                          sx={{ bgcolor: role?.color, color: 'white' }}
                        />
                      );
                    })}
                  </Stack>
                )}
              >
                {allRoles
                  .filter((r) => r.id !== editingRole?.id)
                  .map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      <Chip
                        label={role.name}
                        size="small"
                        sx={{ bgcolor: role.color, color: 'white', mr: 1 }}
                      />
                      {role.description}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {/* Permissions */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Permissions
              </Typography>

              {/* Quick add from common permissions */}
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                {COMMON_PERMISSIONS.filter((p) => !formData.permissions?.includes(p)).map(
                  (permission) => (
                    <Chip
                      key={permission}
                      label={permission}
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddPermission(permission)}
                      sx={{ cursor: 'pointer' }}
                    />
                  )
                )}
              </Stack>

              {/* Current permissions */}
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
                {formData.permissions && formData.permissions.length > 0 ? (
                  formData.permissions.map((permission) => (
                    <Chip
                      key={permission}
                      label={permission}
                      size="small"
                      onDelete={() => handleRemovePermission(permission)}
                      color="primary"
                    />
                  ))
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    No direct permissions. Click permissions above to add.
                  </Typography>
                )}
              </Stack>

              {/* Custom permission input */}
              <TextField
                size="small"
                placeholder="Add custom permission (press Enter)"
                fullWidth
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value.trim()) {
                      handleAddPermission(input.value.trim());
                      input.value = '';
                    }
                  }
                }}
              />

              {/* Show inherited permissions */}
              {formData.inheritsFrom && formData.inheritsFrom.length > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Inherited Permissions:
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                    {getInheritedPermissions(formData as CustomRole).map((perm) => (
                      <Chip key={perm} label={perm} size="small" variant="outlined" color="info" />
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingRole ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
