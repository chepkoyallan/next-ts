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

import { useConfig } from '@app/config/hooks/use-config';
import type { CustomThemePreset } from '@app/types';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

export function ThemePresetsCrudTab() {
  const { config, setValue } = useConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CustomThemePreset | null>(null);
  const [formData, setFormData] = useState<Partial<CustomThemePreset>>({
    name: '',
    description: '',
    primaryColor: '#00AB55',
    secondaryColor: '#3366FF',
    errorColor: '#FF5630',
    warningColor: '#FFAB00',
    infoColor: '#00B8D9',
    successColor: '#36B37E',
  });

  const allPresets = config.ui?.customThemePresets || [];

  const handleOpenDialog = (preset?: CustomThemePreset) => {
    if (preset) {
      setEditingPreset(preset);
      setFormData(preset);
    } else {
      setEditingPreset(null);
      setFormData({
        name: '',
        description: '',
        primaryColor: '#00AB55',
        secondaryColor: '#3366FF',
        errorColor: '#FF5630',
        warningColor: '#FFAB00',
        infoColor: '#00B8D9',
        successColor: '#36B37E',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPreset(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.primaryColor || !formData.secondaryColor) {
      alert('Name, Primary Color, and Secondary Color are required');
      return;
    }

    const newPreset: CustomThemePreset = {
      id: editingPreset?.id || `preset-${Date.now()}`,
      name: formData.name!,
      description: formData.description,
      primaryColor: formData.primaryColor!,
      secondaryColor: formData.secondaryColor!,
      errorColor: formData.errorColor,
      warningColor: formData.warningColor,
      infoColor: formData.infoColor,
      successColor: formData.successColor,
      isSystem: editingPreset?.isSystem || false,
      createdAt: editingPreset?.createdAt || new Date().toISOString(),
    };

    let updatedPresets: CustomThemePreset[];

    if (editingPreset) {
      updatedPresets = allPresets.map((p) => (p.id === editingPreset.id ? newPreset : p));
    } else {
      updatedPresets = [...allPresets, newPreset];
    }

    setValue('ui.customThemePresets', updatedPresets);
    handleCloseDialog();
  };

  const handleDelete = (preset: CustomThemePreset) => {
    if (preset.isSystem) {
      alert('Cannot delete system presets');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the "${preset.name}" preset?`)) {
      const updatedPresets = allPresets.filter((p) => p.id !== preset.id);
      setValue('ui.customThemePresets', updatedPresets);
    }
  };

  const handleApply = (preset: CustomThemePreset) => {
    // Update branding colors to apply the preset
    setValue('branding.primaryColor', preset.primaryColor);
    setValue('branding.secondaryColor', preset.secondaryColor);
    alert(`"${preset.name}" preset applied! The theme will update automatically.`);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Create and manage custom color themes for your application
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:add-circle-bold-duotone" />}
          onClick={() => handleOpenDialog()}
        >
          Add Theme Preset
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Preview</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Primary</TableCell>
                  <TableCell>Secondary</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allPresets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                      <Stack alignItems="center" spacing={2}>
                        <Iconify
                          icon="solar:pallete-2-bold-duotone"
                          width={64}
                          sx={{ color: 'text.disabled' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          No custom theme presets yet. Click "Add Theme Preset" to create one.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : (
                  allPresets.map((preset) => (
                    <TableRow key={preset.id}>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: 0.5,
                              bgcolor: preset.primaryColor,
                              border: 1,
                              borderColor: 'divider',
                            }}
                          />
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: 0.5,
                              bgcolor: preset.secondaryColor,
                              border: 1,
                              borderColor: 'divider',
                            }}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2">{preset.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {preset.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={preset.primaryColor}
                          size="small"
                          sx={{ bgcolor: preset.primaryColor, color: 'white' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={preset.secondaryColor}
                          size="small"
                          sx={{ bgcolor: preset.secondaryColor, color: 'white' }}
                        />
                      </TableCell>
                      <TableCell>
                        {preset.isSystem ? (
                          <Chip label="System" size="small" color="primary" variant="outlined" />
                        ) : (
                          <Chip label="Custom" size="small" color="success" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            onClick={() => handleApply(preset)}
                            color="success"
                          >
                            <Iconify icon="solar:check-circle-bold-duotone" width={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(preset)}
                            color="primary"
                          >
                            <Iconify icon="solar:pen-bold-duotone" width={18} />
                          </IconButton>
                          {!preset.isSystem && (
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(preset)}
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPreset ? 'Edit Theme Preset' : 'Create Theme Preset'}
          {editingPreset?.isSystem && (
            <Chip label="System" size="small" color="primary" sx={{ ml: 1 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Preset Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              helperText="A descriptive name for this theme preset"
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              helperText="Optional description of this theme"
            />

            <Stack spacing={2}>
              <Typography variant="subtitle2">Colors</Typography>

              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    label="Primary Color"
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    label="Secondary Color"
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              </Stack>

              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    label="Error Color"
                    type="color"
                    value={formData.errorColor}
                    onChange={(e) => setFormData({ ...formData, errorColor: e.target.value })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    label="Warning Color"
                    type="color"
                    value={formData.warningColor}
                    onChange={(e) => setFormData({ ...formData, warningColor: e.target.value })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              </Stack>

              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    label="Info Color"
                    type="color"
                    value={formData.infoColor}
                    onChange={(e) => setFormData({ ...formData, infoColor: e.target.value })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    label="Success Color"
                    type="color"
                    value={formData.successColor}
                    onChange={(e) => setFormData({ ...formData, successColor: e.target.value })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              </Stack>
            </Stack>

            {/* Preview */}
            <Card sx={{ bgcolor: 'background.neutral' }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Preview
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label="Primary" sx={{ bgcolor: formData.primaryColor, color: 'white' }} />
                  <Chip
                    label="Secondary"
                    sx={{ bgcolor: formData.secondaryColor, color: 'white' }}
                  />
                  <Chip label="Error" sx={{ bgcolor: formData.errorColor, color: 'white' }} />
                  <Chip label="Warning" sx={{ bgcolor: formData.warningColor, color: 'white' }} />
                  <Chip label="Info" sx={{ bgcolor: formData.infoColor, color: 'white' }} />
                  <Chip label="Success" sx={{ bgcolor: formData.successColor, color: 'white' }} />
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingPreset ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
