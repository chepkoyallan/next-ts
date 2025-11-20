'use client';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useConfig } from '@app/config/hooks/use-config';

// ----------------------------------------------------------------------

export function UIThemeTab() {
  const { config, setValue } = useConfig();

  return (
    <Stack spacing={3}>
      <Grid container spacing={3}>
        {/* Layout Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Layout Settings</Typography>

                <FormControl fullWidth>
                  <InputLabel>Default Layout</InputLabel>
                  <Select
                    value={config.ui.defaultLayout}
                    label="Default Layout"
                    onChange={(e) => setValue('ui.defaultLayout', e.target.value)}
                  >
                    <MenuItem value="vertical">Vertical</MenuItem>
                    <MenuItem value="horizontal">Horizontal</MenuItem>
                    <MenuItem value="mini">Mini</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.ui.allowLayoutChange}
                      onChange={(e) => setValue('ui.allowLayoutChange', e.target.checked)}
                    />
                  }
                  label="Allow users to change layout"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.ui.compactMode}
                      onChange={(e) => setValue('ui.compactMode', e.target.checked)}
                    />
                  }
                  label="Compact mode"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.ui.defaultStretch}
                      onChange={(e) => setValue('ui.defaultStretch', e.target.checked)}
                    />
                  }
                  label="Stretch layout by default"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.ui.allowStretch}
                      onChange={(e) => setValue('ui.allowStretch', e.target.checked)}
                    />
                  }
                  label="Allow stretch toggle"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Theme Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Theme Settings</Typography>

                <FormControl fullWidth>
                  <InputLabel>Default Theme</InputLabel>
                  <Select
                    value={config.ui.defaultTheme}
                    label="Default Theme"
                    onChange={(e) => setValue('ui.defaultTheme', e.target.value)}
                  >
                    {config.ui.availableThemes.map((theme) => (
                      <MenuItem key={theme} value={theme}>
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.ui.allowThemeChange}
                      onChange={(e) => setValue('ui.allowThemeChange', e.target.checked)}
                    />
                  }
                  label="Allow users to change theme"
                />

                <FormControl fullWidth>
                  <InputLabel>Color Preset</InputLabel>
                  <Select
                    value={config.ui.defaultColorPreset}
                    label="Color Preset"
                    onChange={(e) => setValue('ui.defaultColorPreset', e.target.value)}
                  >
                    {config.ui.availableColorPresets.map((preset) => (
                      <MenuItem key={preset} value={preset}>
                        {preset.charAt(0).toUpperCase() + preset.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Contrast</InputLabel>
                  <Select
                    value={config.ui.defaultContrast}
                    label="Contrast"
                    onChange={(e) => setValue('ui.defaultContrast', e.target.value)}
                  >
                    <MenuItem value="default">Default</MenuItem>
                    <MenuItem value="bold">Bold</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Navigation Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Navigation Settings</Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.navigation.showBreadcrumbs}
                          onChange={(e) => setValue('navigation.showBreadcrumbs', e.target.checked)}
                        />
                      }
                      label="Show breadcrumbs"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.navigation.showSearchBar}
                          onChange={(e) => setValue('navigation.showSearchBar', e.target.checked)}
                        />
                      }
                      label="Show search bar"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.navigation.showIcons}
                          onChange={(e) => setValue('navigation.showIcons', e.target.checked)}
                        />
                      }
                      label="Show navigation icons"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.navigation.showBadges}
                          onChange={(e) => setValue('navigation.showBadges', e.target.checked)}
                        />
                      }
                      label="Show navigation badges"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.navigation.collapsible}
                          onChange={(e) => setValue('navigation.collapsible', e.target.checked)}
                        />
                      }
                      label="Allow collapsible navigation"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.navigation.defaultCollapsed}
                          onChange={(e) =>
                            setValue('navigation.defaultCollapsed', e.target.checked)
                          }
                        />
                      }
                      label="Collapsed by default"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Max Navigation Depth"
                      type="number"
                      value={config.navigation.maxNavDepth}
                      onChange={(e) =>
                        setValue('navigation.maxNavDepth', parseInt(e.target.value, 10))
                      }
                      inputProps={{ min: 1, max: 5 }}
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
