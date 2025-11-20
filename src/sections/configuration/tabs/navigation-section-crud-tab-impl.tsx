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
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
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

import { useConfig } from '@app/config/hooks/use-config';
import type { NavigationSectionConfig } from '@app/types';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

export function NavigationSectionCrudTab() {
  const { config, setValue } = useConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<NavigationSectionConfig | null>(null);
  const [formData, setFormData] = useState<Partial<NavigationSectionConfig>>({
    label: '',
    enabled: true,
    hidden: false,
    order: 0,
  });

  // Get all sections (system + custom)
  const allSections = [
    ...Object.values(config.navigation.sections),
    ...(config.navigation.customSections || []),
  ].sort((a, b) => a.order - b.order);

  const handleOpenDialog = (section?: NavigationSectionConfig) => {
    if (section) {
      setEditingSection(section);
      setFormData(section);
    } else {
      setEditingSection(null);
      setFormData({
        label: '',
        enabled: true,
        hidden: false,
        order: allSections.length + 1,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSection(null);
  };

  const handleSave = () => {
    if (!formData.label) {
      alert('Section label is required');
      return;
    }

    if (editingSection) {
      // Update existing section
      if (editingSection.isSystem) {
        // Update system section
        const sectionKey = editingSection.id as keyof typeof config.navigation.sections;
        setValue(`navigation.sections.${sectionKey}`, {
          ...editingSection,
          ...formData,
        });
      } else {
        // Update custom section
        const updatedSections = (config.navigation.customSections || []).map((s) =>
          s.id === editingSection.id ? { ...s, ...formData } : s
        );
        setValue('navigation.customSections', updatedSections);
      }
    } else {
      // Create new custom section
      const newSection: NavigationSectionConfig = {
        id: `section-${Date.now()}`,
        label: formData.label!,
        enabled: formData.enabled ?? true,
        hidden: formData.hidden ?? false,
        order: formData.order ?? allSections.length + 1,
        isSystem: false,
      };

      const updatedSections = [...(config.navigation.customSections || []), newSection];
      setValue('navigation.customSections', updatedSections);
    }

    handleCloseDialog();
  };

  const handleDelete = (section: NavigationSectionConfig) => {
    if (section.isSystem) {
      alert('Cannot delete system sections. You can disable them instead.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the "${section.label}" section?`)) {
      const updatedSections = (config.navigation.customSections || []).filter(
        (s) => s.id !== section.id
      );
      setValue('navigation.customSections', updatedSections);
    }
  };

  const handleToggleEnabled = (section: NavigationSectionConfig) => {
    if (section.isSystem) {
      const sectionKey = section.id as keyof typeof config.navigation.sections;
      setValue(`navigation.sections.${sectionKey}.enabled`, !section.enabled);
    } else {
      const updatedSections = (config.navigation.customSections || []).map((s) =>
        s.id === section.id ? { ...s, enabled: !s.enabled } : s
      );
      setValue('navigation.customSections', updatedSections);
    }
  };

  const handleToggleHidden = (section: NavigationSectionConfig) => {
    if (section.isSystem) {
      const sectionKey = section.id as keyof typeof config.navigation.sections;
      setValue(`navigation.sections.${sectionKey}.hidden`, !section.hidden);
    } else {
      const updatedSections = (config.navigation.customSections || []).map((s) =>
        s.id === section.id ? { ...s, hidden: !s.hidden } : s
      );
      setValue('navigation.customSections', updatedSections);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;

    const updated = [...allSections];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];

    // Update order values
    updated.forEach((section, idx) => {
      section.order = idx + 1;
    });

    // Separate and save
    const systemSections = updated.filter((s) => s.isSystem);
    const customSections = updated.filter((s) => !s.isSystem);

    systemSections.forEach((section) => {
      const sectionKey = section.id as keyof typeof config.navigation.sections;
      setValue(`navigation.sections.${sectionKey}.order`, section.order);
    });

    setValue('navigation.customSections', customSections);
  };

  const handleMoveDown = (index: number) => {
    if (index === allSections.length - 1) return;

    const updated = [...allSections];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];

    // Update order values
    updated.forEach((section, idx) => {
      section.order = idx + 1;
    });

    // Separate and save
    const systemSections = updated.filter((s) => s.isSystem);
    const customSections = updated.filter((s) => !s.isSystem);

    systemSections.forEach((section) => {
      const sectionKey = section.id as keyof typeof config.navigation.sections;
      setValue(`navigation.sections.${sectionKey}.order`, section.order);
    });

    setValue('navigation.customSections', customSections);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Create, edit, and manage navigation sections
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:add-circle-bold-duotone" />}
          onClick={() => handleOpenDialog()}
        >
          Add Section
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={100}>Order</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell>Hidden</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allSections.map((section, index) => (
                  <TableRow key={section.id}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>
                          {section.order}
                        </Typography>
                        <Stack direction="column" spacing={0.5}>
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
                            disabled={index === allSections.length - 1}
                          >
                            <Iconify icon="solar:alt-arrow-down-bold" width={16} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">{section.label}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {section.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {section.isSystem ? (
                        <Chip label="System" size="small" color="primary" variant="outlined" />
                      ) : (
                        <Chip label="Custom" size="small" color="success" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={section.enabled}
                        onChange={() => handleToggleEnabled(section)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={section.hidden || false}
                        onChange={() => handleToggleHidden(section)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(section)}
                          color="primary"
                        >
                          <Iconify icon="solar:pen-bold-duotone" width={18} />
                        </IconButton>
                        {!section.isSystem && (
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(section)}
                            color="error"
                          >
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
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSection ? 'Edit Section' : 'Create Section'}
          {editingSection?.isSystem && (
            <Chip label="System" size="small" color="primary" sx={{ ml: 1 }} />
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Section Label"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              fullWidth
              required
              helperText="The display name of the section (e.g., 'Overview', 'Reports')"
            />

            <TextField
              label="Display Order"
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value, 10) })}
              fullWidth
              inputProps={{ min: 1 }}
              helperText="Lower numbers appear first"
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

            {editingSection?.isSystem && (
              <Box sx={{ p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Note:</strong> This is a system section. You can modify its settings but
                  cannot delete it.
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingSection ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
