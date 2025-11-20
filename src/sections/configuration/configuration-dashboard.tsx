'use client';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { useConfig } from '@app/config/hooks/use-config';

import Iconify from '@app/components/iconify';

import { UIThemeTab } from './tabs/ui-theme-tab';
import { BrandingTab } from './tabs/branding-tab';
import { SecurityTab } from './tabs/security-tab';
import { AdvancedTab } from './tabs/advanced-tab';
import { NavigationTab } from './tabs/navigation-tab';
import { PerformanceTab } from './tabs/performance-tab';
import { APISettingsTab } from './tabs/api-settings-tab';
import { LocalizationTab } from './tabs/localization-tab';
import { FeatureFlagsTab } from './tabs/feature-flags-tab';
import { NotificationsTab } from './tabs/notifications-tab';
import { AuthenticationTab } from './tabs/authentication-tab';
import { GeneralSettingsTab } from './tabs/general-settings-tab';
import { ModuleManagementTab } from './tabs/module-management-tab';
import { ThemePresetsCrudTab } from './tabs/theme-presets-crud-tab';
import { RolesPermissionsCrudTab } from './tabs/roles-permissions-crud-tab';
import { APIEndpointsCrudTab } from './tabs/api-endpoints-crud-tab';
import { PluginsCrudTab } from './tabs/plugins-crud-tab';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'general',
    label: 'General',
    icon: 'solar:home-2-bold-duotone',
    description: 'Overview and basic information',
  },
  {
    value: 'features',
    label: 'Features',
    icon: 'solar:widget-2-bold-duotone',
    description: 'Enable or disable features',
  },
  {
    value: 'modules',
    label: 'Modules',
    icon: 'solar:layers-minimalistic-bold-duotone',
    description: 'Configure modules and permissions',
  },
  {
    value: 'ui',
    label: 'UI & Theme',
    icon: 'solar:pallete-2-bold-duotone',
    description: 'Customize appearance and theme',
  },
  {
    value: 'themes',
    label: 'Theme Presets',
    icon: 'solar:pallete-2-bold-duotone',
    description: 'Create and manage custom color themes',
  },
  {
    value: 'navigation',
    label: 'Navigation',
    icon: 'solar:menu-dots-bold-duotone',
    description: 'Configure navigation sections and behavior',
  },
  {
    value: 'roles',
    label: 'Roles & Permissions',
    icon: 'solar:shield-user-bold-duotone',
    description: 'Manage roles and their permissions',
  },
  {
    value: 'auth',
    label: 'Authentication',
    icon: 'solar:shield-user-bold-duotone',
    description: 'Authentication and security settings',
  },
  {
    value: 'branding',
    label: 'Branding',
    icon: 'solar:medal-star-bold-duotone',
    description: 'Logo, colors, and brand identity',
  },
  {
    value: 'api',
    label: 'API',
    icon: 'solar:server-bold-duotone',
    description: 'API endpoints and configuration',
  },
  {
    value: 'endpoints',
    label: 'API Endpoints',
    icon: 'solar:routing-2-bold-duotone',
    description: 'Manage custom API endpoints and proxies',
  },
  {
    value: 'plugins',
    label: 'Plugins',
    icon: 'solar:plugin-bold-duotone',
    description: 'Install and manage application plugins',
  },
  {
    value: 'notifications',
    label: 'Notifications',
    icon: 'solar:bell-bold-duotone',
    description: 'Notification preferences',
  },
  {
    value: 'localization',
    label: 'Localization',
    icon: 'solar:global-bold-duotone',
    description: 'Language and regional settings',
  },
  {
    value: 'performance',
    label: 'Performance',
    icon: 'solar:chart-2-bold-duotone',
    description: 'Performance optimization',
  },
  {
    value: 'security',
    label: 'Security',
    icon: 'solar:shield-check-bold-duotone',
    description: 'Security and access control',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    icon: 'solar:settings-bold-duotone',
    description: 'Advanced configuration options',
  },
];

export function ConfigurationDashboard() {
  const { config, updateConfig, resetConfig } = useConfig();
  const [currentTab, setCurrentTab] = useState('general');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info',
  });

  const handleChangeTab = useCallback((event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
  }, []);

  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
      setSnackbar({ open: true, message, severity });
    },
    []
  );

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const handleReset = useCallback(() => {
    if (
      window.confirm(
        '⚠️ Are you sure you want to reset ALL configuration to defaults?\n\nThis action cannot be undone. All your custom settings will be lost.'
      )
    ) {
      resetConfig();
      showSnackbar('Configuration reset to defaults successfully!', 'info');
    }
  }, [resetConfig, showSnackbar]);

  const handleExport = useCallback(() => {
    try {
      const dataStr = JSON.stringify(config, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      const exportFileDefaultName = `config-${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      showSnackbar('Configuration exported successfully!', 'success');
    } catch (error) {
      showSnackbar('Failed to export configuration', 'error');
    }
  }, [config, showSnackbar]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          updateConfig(imported);
          showSnackbar('Configuration imported successfully!', 'success');
        } catch (error) {
          showSnackbar('Failed to import configuration. Please check the file format.', 'error');
        }
      };

      reader.onerror = () => {
        showSnackbar('Failed to read file', 'error');
      };

      reader.readAsText(file);
    };

    input.click();
  }, [updateConfig, showSnackbar]);

  const handleCopy = useCallback(() => {
    try {
      const dataStr = JSON.stringify(config, null, 2);
      navigator.clipboard.writeText(dataStr);
      showSnackbar('Configuration copied to clipboard!', 'success');
    } catch (error) {
      showSnackbar('Failed to copy to clipboard', 'error');
    }
  }, [config, showSnackbar]);

  const renderTab = () => {
    switch (currentTab) {
      case 'general':
        return <GeneralSettingsTab />;
      case 'features':
        return <FeatureFlagsTab />;
      case 'modules':
        return <ModuleManagementTab />;
      case 'ui':
        return <UIThemeTab />;
      case 'themes':
        return <ThemePresetsCrudTab />;
      case 'navigation':
        return <NavigationTab />;
      case 'roles':
        return <RolesPermissionsCrudTab />;
      case 'auth':
        return <AuthenticationTab />;
      case 'branding':
        return <BrandingTab />;
      case 'api':
        return <APISettingsTab />;
      case 'endpoints':
        return <APIEndpointsCrudTab />;
      case 'plugins':
        return <PluginsCrudTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'localization':
        return <LocalizationTab />;
      case 'performance':
        return <PerformanceTab />;
      case 'security':
        return <SecurityTab />;
      case 'advanced':
        return <AdvancedTab />;
      default:
        return null;
    }
  };

  const currentTabInfo = TABS.find((tab) => tab.value === currentTab);

  return (
    <Container maxWidth="xl">
      <Stack spacing={4} sx={{ py: 4 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                }}
              >
                <Iconify icon="solar:settings-bold-duotone" width={32} />
              </Box>
              <div>
                <Typography variant="h4">System Configuration</Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage all application settings and preferences
                </Typography>
              </div>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Copy configuration to clipboard">
              <IconButton onClick={handleCopy} color="default">
                <Iconify icon="solar:copy-bold-duotone" />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:import-bold-duotone" />}
              onClick={handleImport}
            >
              Import
            </Button>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:export-bold-duotone" />}
              onClick={handleExport}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Iconify icon="solar:restart-bold-duotone" />}
              onClick={handleReset}
            >
              Reset All
            </Button>
          </Stack>
        </Stack>

        {/* Info Alert */}
        <Alert severity="info" sx={{ alignItems: 'center' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="solar:info-circle-bold-duotone" width={24} />
            <Typography variant="body2">
              Changes are saved automatically and persist across sessions. You can export your
              configuration as a backup or import settings from a file.
            </Typography>
          </Stack>
        </Alert>

        {/* Main Configuration Card */}
        <Card>
          <Tabs
            value={currentTab}
            onChange={handleChangeTab}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 3,
              boxShadow: (theme) => `inset 0 -2px 0 0 ${theme.palette.divider}`,
            }}
          >
            {TABS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                icon={<Iconify icon={tab.icon} width={20} />}
                iconPosition="start"
                sx={{ minHeight: 72 }}
              />
            ))}
          </Tabs>

          {/* Tab Description */}
          {currentTabInfo && (
            <Box sx={{ px: 3, py: 2, bgcolor: 'background.neutral' }}>
              <Typography variant="body2" color="text.secondary">
                {currentTabInfo.description}
              </Typography>
            </Box>
          )}

          {/* Tab Content */}
          <Box sx={{ p: 3 }}>{renderTab()}</Box>
        </Card>

        {/* Footer Info */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            Configuration Version: {config.version} | Environment: {config.environment}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Tooltip title="View documentation">
              <IconButton size="small" color="default">
                <Iconify icon="solar:document-text-bold-duotone" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Get help">
              <IconButton size="small" color="default">
                <Iconify icon="solar:question-circle-bold-duotone" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Stack>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
