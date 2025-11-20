'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useConfig } from '@app/config/hooks/use-config';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

const FEATURES = [
  {
    key: 'enableChat',
    label: 'Chat',
    description: 'Enable real-time chat and messaging functionality',
    icon: 'solar:chat-round-dots-bold-duotone',
    category: 'Communication',
    impact: 'medium',
  },
  {
    key: 'enableMail',
    label: 'Mail',
    description: 'Enable email management and inbox features',
    icon: 'solar:letter-bold-duotone',
    category: 'Communication',
    impact: 'medium',
  },
  {
    key: 'enableKanban',
    label: 'Kanban Board',
    description: 'Enable Kanban board for task and project management',
    icon: 'solar:clipboard-list-bold-duotone',
    category: 'Productivity',
    impact: 'low',
  },
  {
    key: 'enableCalendar',
    label: 'Calendar',
    description: 'Enable calendar and event management features',
    icon: 'solar:calendar-bold-duotone',
    category: 'Productivity',
    impact: 'medium',
  },
  {
    key: 'enableFileManager',
    label: 'File Manager',
    description: 'Enable file upload, management, and storage',
    icon: 'solar:folder-bold-duotone',
    category: 'Storage',
    impact: 'high',
  },
  {
    key: 'enableAnalytics',
    label: 'Analytics Dashboard',
    description: 'Enable analytics, reports, and data visualization',
    icon: 'solar:chart-2-bold-duotone',
    category: 'Analytics',
    impact: 'low',
  },
  {
    key: 'enableEcommerce',
    label: 'E-commerce',
    description: 'Enable e-commerce features and shopping cart',
    icon: 'solar:cart-large-4-bold-duotone',
    category: 'Commerce',
    impact: 'high',
  },
  {
    key: 'enableBanking',
    label: 'Banking Dashboard',
    description: 'Enable banking features and financial overview',
    icon: 'solar:dollar-bold-duotone',
    category: 'Finance',
    impact: 'medium',
  },
  {
    key: 'enableBooking',
    label: 'Booking System',
    description: 'Enable booking, reservations, and scheduling',
    icon: 'solar:calendar-mark-bold-duotone',
    category: 'Booking',
    impact: 'medium',
  },
  {
    key: 'enableInvoice',
    label: 'Invoice Management',
    description: 'Enable invoice creation, management, and tracking',
    icon: 'solar:bill-list-bold-duotone',
    category: 'Finance',
    impact: 'low',
  },
  {
    key: 'enableBlog',
    label: 'Blog & Posts',
    description: 'Enable blog, articles, and content management',
    icon: 'solar:document-text-bold-duotone',
    category: 'Content',
    impact: 'low',
  },
  {
    key: 'enableJob',
    label: 'Job Listings',
    description: 'Enable job postings and career management',
    icon: 'solar:case-minimalistic-bold-duotone',
    category: 'HR',
    impact: 'low',
  },
  {
    key: 'enableTour',
    label: 'Tour Management',
    description: 'Enable tour packages and travel management',
    icon: 'solar:map-point-wave-bold-duotone',
    category: 'Travel',
    impact: 'low',
  },
  {
    key: 'enableUser',
    label: 'User Management',
    description: 'Enable user CRUD operations and management',
    icon: 'solar:users-group-rounded-bold-duotone',
    category: 'System',
    impact: 'critical',
  },
  {
    key: 'enableProduct',
    label: 'Product Management',
    description: 'Enable product catalog and inventory management',
    icon: 'solar:bag-4-bold-duotone',
    category: 'Commerce',
    impact: 'high',
  },
  {
    key: 'enableOrder',
    label: 'Order Management',
    description: 'Enable order processing and tracking',
    icon: 'solar:box-bold-duotone',
    category: 'Commerce',
    impact: 'high',
  },
  {
    key: 'enablePermissions',
    label: 'Permissions System',
    description: 'Enable role-based access control and permissions',
    icon: 'solar:shield-keyhole-bold-duotone',
    category: 'Security',
    impact: 'critical',
  },
];

export function FeatureFlagsTab() {
  const { config, setValue } = useConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const handleToggle = (feature: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(`features.${feature}`, event.target.checked);
  };

  const categories = ['all', ...Array.from(new Set(FEATURES.map((f) => f.category)))];

  const filteredFeatures = FEATURES.filter((feature) => {
    const matchesSearch =
      feature.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || feature.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const enabledCount = FEATURES.filter(
    (f) => config.features[f.key as keyof typeof config.features]
  ).length;

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'success';
    }
  };

  return (
    <Stack spacing={3}>
      {/* Header Stats */}
      <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold-duotone" />}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2">
            {enabledCount} of {FEATURES.length} features are currently enabled
          </Typography>
          <Chip
            label={`${Math.round((enabledCount / FEATURES.length) * 100)}% Active`}
            size="small"
            color="primary"
          />
        </Stack>
      </Alert>

      {/* Search and Filter */}
      <Stack direction="row" spacing={2}>
        <TextField
          fullWidth
          placeholder="Search features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="solar:magnifer-bold-duotone" />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ minWidth: 200 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {categories.map((category) => (
              <Chip
                key={category}
                label={category}
                onClick={() => setFilterCategory(category)}
                color={filterCategory === category ? 'primary' : 'default'}
                variant={filterCategory === category ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Stack>
        </Box>
      </Stack>

      {/* Features Grid */}
      <Grid container spacing={2}>
        {filteredFeatures.map((feature) => {
          const isEnabled = config.features[feature.key as keyof typeof config.features];

          return (
            <Grid item xs={12} md={6} key={feature.key}>
              <Card
                sx={{
                  height: '100%',
                  border: (theme) =>
                    `2px solid ${isEnabled ? theme.palette.primary.main : theme.palette.divider}`,
                  transition: 'all 0.3s',
                  '&:hover': {
                    boxShadow: (theme) => theme.customShadows.z8,
                  },
                }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: isEnabled ? 'primary.lighter' : 'action.hover',
                            color: isEnabled ? 'primary.main' : 'text.secondary',
                          }}
                        >
                          <Iconify icon={feature.icon} width={24} />
                        </Box>
                        <div>
                          <Typography variant="subtitle1" fontWeight="semibold">
                            {feature.label}
                          </Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip
                              label={feature.category}
                              size="small"
                              sx={{ height: 20, fontSize: 10 }}
                            />
                            <Chip
                              label={feature.impact.toUpperCase()}
                              size="small"
                              color={getImpactColor(feature.impact) as any}
                              sx={{ height: 20, fontSize: 10 }}
                            />
                          </Stack>
                        </div>
                      </Stack>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isEnabled}
                            onChange={handleToggle(feature.key)}
                            color="primary"
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                    </Stack>

                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>

                    {isEnabled && (
                      <Chip
                        icon={<Iconify icon="solar:check-circle-bold" width={16} />}
                        label="Active"
                        size="small"
                        color="success"
                        sx={{ alignSelf: 'flex-start' }}
                      />
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {filteredFeatures.length === 0 && (
        <Card>
          <CardContent>
            <Stack alignItems="center" spacing={2} py={4}>
              <Iconify icon="solar:ghost-bold-duotone" width={64} color="text.disabled" />
              <Typography variant="h6" color="text.secondary">
                No features found
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Try adjusting your search or filter
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
