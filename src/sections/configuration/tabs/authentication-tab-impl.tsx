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
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useConfig } from '@app/config/hooks/use-config';

// ----------------------------------------------------------------------

export function AuthenticationTab() {
  const { config, setValue } = useConfig();

  return (
    <Stack spacing={3}>
      <Grid container spacing={3}>
        {/* Provider Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Provider Settings</Typography>

                <FormControl fullWidth>
                  <InputLabel>Auth Provider</InputLabel>
                  <Select
                    value={config.auth.provider}
                    label="Auth Provider"
                    onChange={(e) => setValue('auth.provider', e.target.value)}
                  >
                    <MenuItem value="jwt">JWT</MenuItem>
                    <MenuItem value="auth0">Auth0</MenuItem>
                    <MenuItem value="firebase">Firebase</MenuItem>
                    <MenuItem value="amplify">AWS Amplify</MenuItem>
                    <MenuItem value="supabase">Supabase</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.auth.allowRegistration}
                      onChange={(e) => setValue('auth.allowRegistration', e.target.checked)}
                    />
                  }
                  label="Allow User Registration"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.auth.allowSocialLogin}
                      onChange={(e) => setValue('auth.allowSocialLogin', e.target.checked)}
                    />
                  }
                  label="Allow Social Login"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.auth.requireEmailVerification}
                      onChange={(e) => setValue('auth.requireEmailVerification', e.target.checked)}
                    />
                  }
                  label="Require Email Verification"
                />

                <TextField
                  label="Session Timeout (minutes)"
                  type="number"
                  value={config.auth.sessionTimeout}
                  onChange={(e) => setValue('auth.sessionTimeout', parseInt(e.target.value, 10))}
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">min</InputAdornment>,
                  }}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Password Policy */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Password Policy</Typography>

                <TextField
                  label="Minimum Length"
                  type="number"
                  value={config.auth.passwordPolicy.minLength}
                  onChange={(e) =>
                    setValue('auth.passwordPolicy.minLength', parseInt(e.target.value, 10))
                  }
                  fullWidth
                  inputProps={{ min: 6, max: 128 }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.auth.passwordPolicy.requireUppercase}
                      onChange={(e) =>
                        setValue('auth.passwordPolicy.requireUppercase', e.target.checked)
                      }
                    />
                  }
                  label="Require Uppercase Letters"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.auth.passwordPolicy.requireLowercase}
                      onChange={(e) =>
                        setValue('auth.passwordPolicy.requireLowercase', e.target.checked)
                      }
                    />
                  }
                  label="Require Lowercase Letters"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.auth.passwordPolicy.requireNumbers}
                      onChange={(e) =>
                        setValue('auth.passwordPolicy.requireNumbers', e.target.checked)
                      }
                    />
                  }
                  label="Require Numbers"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.auth.passwordPolicy.requireSpecialChars}
                      onChange={(e) =>
                        setValue('auth.passwordPolicy.requireSpecialChars', e.target.checked)
                      }
                    />
                  }
                  label="Require Special Characters"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* MFA Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6">Multi-Factor Authentication</Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.auth.mfa.enabled}
                      onChange={(e) => setValue('auth.mfa.enabled', e.target.checked)}
                    />
                  }
                  label="Enable MFA"
                />

                {config.auth.mfa.enabled && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.auth.mfa.required}
                        onChange={(e) => setValue('auth.mfa.required', e.target.checked)}
                      />
                    }
                    label="Require MFA for All Users"
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
