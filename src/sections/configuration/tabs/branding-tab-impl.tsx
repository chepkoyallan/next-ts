'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { useConfig } from '@app/config/hooks/use-config';

import Iconify from '@app/components/iconify';

// ----------------------------------------------------------------------

export function BrandingTab() {
  const { config, setValue } = useConfig();

  return (
    <Stack spacing={3}>
      <Alert severity="info" icon={<Iconify icon="solar:pallete-2-bold-duotone" />}>
        Branding changes apply immediately to the entire application
      </Alert>

      <Grid container spacing={3}>
        {/* Company Info */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Company Information</Typography>

                <TextField
                  label="App Name"
                  value={config.branding.appName}
                  onChange={(e) => setValue('branding.appName', e.target.value)}
                  fullWidth
                />

                <TextField
                  label="Company Name"
                  value={config.branding.companyName}
                  onChange={(e) => setValue('branding.companyName', e.target.value)}
                  fullWidth
                />

                <TextField
                  label="Logo URL"
                  value={config.branding.logo}
                  onChange={(e) => setValue('branding.logo', e.target.value)}
                  placeholder="/logo/logo.svg"
                  fullWidth
                />

                <TextField
                  label="Dark Logo URL"
                  value={config.branding.logoDark || ''}
                  onChange={(e) => setValue('branding.logoDark', e.target.value)}
                  placeholder="/logo/logo-dark.svg"
                  fullWidth
                />

                <TextField
                  label="Favicon URL"
                  value={config.branding.favicon}
                  onChange={(e) => setValue('branding.favicon', e.target.value)}
                  placeholder="/favicon.ico"
                  fullWidth
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Colors */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Brand Colors</Typography>

                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Primary Color
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      type="color"
                      value={config.branding.primaryColor}
                      onChange={(e) => setValue('branding.primaryColor', e.target.value)}
                      sx={{ width: 80 }}
                    />
                    <TextField
                      value={config.branding.primaryColor}
                      onChange={(e) => setValue('branding.primaryColor', e.target.value)}
                      placeholder="#00AB55"
                      fullWidth
                    />
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Secondary Color
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      type="color"
                      value={config.branding.secondaryColor}
                      onChange={(e) => setValue('branding.secondaryColor', e.target.value)}
                      sx={{ width: 80 }}
                    />
                    <TextField
                      value={config.branding.secondaryColor}
                      onChange={(e) => setValue('branding.secondaryColor', e.target.value)}
                      placeholder="#FF5630"
                      fullWidth
                    />
                  </Stack>
                </Box>

                {/* Color Preview */}
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Color Preview
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Box
                      sx={{
                        width: 100,
                        height: 60,
                        borderRadius: 1,
                        bgcolor: config.branding.primaryColor,
                        border: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                      }}
                    >
                      <Typography variant="caption">Primary</Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 100,
                        height: 60,
                        borderRadius: 1,
                        bgcolor: config.branding.secondaryColor,
                        border: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                      }}
                    >
                      <Typography variant="caption">Secondary</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* SEO */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">SEO & Meta Tags</Typography>

                <TextField
                  label="Meta Title"
                  value={config.branding.metaTitle}
                  onChange={(e) => setValue('branding.metaTitle', e.target.value)}
                  fullWidth
                  helperText="Title shown in browser tab and search results"
                />

                <TextField
                  label="Meta Description"
                  value={config.branding.metaDescription}
                  onChange={(e) => setValue('branding.metaDescription', e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  helperText="Description shown in search results"
                />

                <TextField
                  label="Meta Keywords"
                  value={config.branding.metaKeywords}
                  onChange={(e) => setValue('branding.metaKeywords', e.target.value)}
                  fullWidth
                  helperText="Comma-separated keywords for SEO"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
