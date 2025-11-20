'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useConfig } from '@app/config/hooks/use-config';
import type { NavigationSectionsConfig } from '@app/types';

import { NavigationCrudTab } from './navigation-crud-tab';
import { NavigationSectionCrudTab } from './navigation-section-crud-tab';

// ----------------------------------------------------------------------

export function NavigationTab() {
  const [currentTab, setCurrentTab] = useState('settings');
  const { config, setValue } = useConfig();

  const renderSettings = () => (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        Configure general navigation behavior and appearance
      </Typography>

      <Grid container spacing={3}>
        {/* General Navigation Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">General Settings</Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.navigation.showBreadcrumbs}
                      onChange={(e) => setValue('navigation.showBreadcrumbs', e.target.checked)}
                    />
                  }
                  label="Show Breadcrumbs"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.navigation.showSearchBar}
                      onChange={(e) => setValue('navigation.showSearchBar', e.target.checked)}
                    />
                  }
                  label="Show Search Bar"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.navigation.showIcons}
                      onChange={(e) => setValue('navigation.showIcons', e.target.checked)}
                    />
                  }
                  label="Show Navigation Icons"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.navigation.showBadges}
                      onChange={(e) => setValue('navigation.showBadges', e.target.checked)}
                    />
                  }
                  label="Show Badges"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.navigation.collapsible}
                      onChange={(e) => setValue('navigation.collapsible', e.target.checked)}
                    />
                  }
                  label="Collapsible Navigation"
                />

                {config.navigation.collapsible && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.navigation.defaultCollapsed}
                        onChange={(e) => setValue('navigation.defaultCollapsed', e.target.checked)}
                      />
                    }
                    label="Default Collapsed State"
                    sx={{ ml: 3 }}
                  />
                )}

                <TextField
                  label="Max Navigation Depth"
                  type="number"
                  value={config.navigation.maxNavDepth}
                  onChange={(e) => setValue('navigation.maxNavDepth', parseInt(e.target.value, 10))}
                  fullWidth
                  inputProps={{ min: 1, max: 5 }}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );

  return (
    <Stack spacing={3}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
          <Tab label="General Settings" value="settings" />
          <Tab label="Manage Sections" value="sections" />
          <Tab label="Custom Items" value="crud" />
        </Tabs>
      </Box>

      <Box sx={{ pt: 2 }}>
        {currentTab === 'settings' && renderSettings()}
        {currentTab === 'sections' && <NavigationSectionCrudTab />}
        {currentTab === 'crud' && <NavigationCrudTab />}
      </Box>
    </Stack>
  );
}
