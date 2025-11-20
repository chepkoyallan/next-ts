import type { Plugin } from '@app/types';

export const authPlugin: Plugin = {
  id: 'auth',
  name: 'Authentication',
  version: '1.0.0',
  description: 'User authentication and session management',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [
    { path: '/auth/jwt/login', component: 'JwtLoginView', layout: 'auth' },
    { path: '/auth/jwt/register', component: 'JwtRegisterView', layout: 'auth' },
    { path: '/auth/firebase/login', component: 'FirebaseLoginView', layout: 'auth' },
    { path: '/auth/firebase/register', component: 'FirebaseRegisterView', layout: 'auth' },
    {
      path: '/auth/firebase/forgot-password',
      component: 'FirebaseForgotPasswordView',
      layout: 'auth',
    },
    { path: '/auth/amplify/login', component: 'AmplifyLoginView', layout: 'auth' },
    { path: '/auth/amplify/register', component: 'AmplifyRegisterView', layout: 'auth' },
    {
      path: '/auth/amplify/forgot-password',
      component: 'AmplifyForgotPasswordView',
      layout: 'auth',
    },
    { path: '/auth/amplify/new-password', component: 'AmplifyNewPasswordView', layout: 'auth' },
    { path: '/auth/amplify/verify', component: 'AmplifyVerifyView', layout: 'auth' },
    { path: '/auth/auth0/login', component: 'Auth0LoginView', layout: 'auth' },
    { path: '/auth/supabase/login', component: 'SupabaseLoginView', layout: 'auth' },
    { path: '/auth/supabase/register', component: 'SupabaseRegisterView', layout: 'auth' },
    {
      path: '/auth/supabase/forgot-password',
      component: 'SupabaseForgotPasswordView',
      layout: 'auth',
    },
    { path: '/auth/supabase/new-password', component: 'SupabaseNewPasswordView', layout: 'auth' },
    { path: '/auth/supabase/verify', component: 'SupabaseVerifyView', layout: 'auth' },
  ],

  navigation: [
    {
      title: 'Authentication',
      path: '/auth/jwt/login',
      icon: 'solar:shield-user-bold-duotone',
    },
  ],

  components: {
    JwtLoginView: () => import('./jwt/jwt-login-view'),
    JwtRegisterView: () => import('./jwt/jwt-register-view'),
    FirebaseLoginView: () => import('./firebase/firebase-login-view'),
    FirebaseRegisterView: () => import('./firebase/firebase-register-view'),
    FirebaseForgotPasswordView: () => import('./firebase/firebase-forgot-password-view'),
    AmplifyLoginView: () => import('./amplify/amplify-login-view'),
    AmplifyRegisterView: () => import('./amplify/amplify-register-view'),
    AmplifyForgotPasswordView: () => import('./amplify/amplify-forgot-password-view'),
    AmplifyNewPasswordView: () => import('./amplify/amplify-new-password-view'),
    AmplifyVerifyView: () => import('./amplify/amplify-verify-view'),
    Auth0LoginView: () => import('./auth0/auth0-login-view'),
    SupabaseLoginView: () => import('./supabase/supabase-login-view'),
    SupabaseRegisterView: () => import('./supabase/supabase-register-view'),
    SupabaseForgotPasswordView: () => import('./supabase/supabase-forgot-password-view'),
    SupabaseNewPasswordView: () => import('./supabase/supabase-new-password-view'),
    SupabaseVerifyView: () => import('./supabase/supabase-verify-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Auth Plugin] Initialized');
    },
    onAuth: async (user) => {
      console.log('[Auth Plugin] User authenticated:', user);
    },
    onLogout: async () => {
      console.log('[Auth Plugin] User logged out');
    },
  },

  settings: {
    providers: ['jwt', 'firebase', 'amplify', 'auth0', 'supabase'],
    defaultProvider: 'jwt',
  },
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['auth', 'security', 'login'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: true,
};

export default authPlugin;
