import { AppConfig } from './types';
// Auto-discovery: Plugins are now loaded automatically from packages/features/
// Run 'pnpm discover-plugins' to regenerate the plugin list

// Default Application Configuration
// This serves as the base configuration that can be overridden
// ----------------------------------------------------------------------

export const defaultConfig: AppConfig = {
  version: '5.7.0',
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',

  // Feature Flags
  features: {
    enableChat: process.env.NEXT_PUBLIC_FEATURE_CHAT !== 'false',
    enableMail: process.env.NEXT_PUBLIC_FEATURE_MAIL !== 'false',
    enableKanban: process.env.NEXT_PUBLIC_FEATURE_KANBAN !== 'false',
    enableCalendar: process.env.NEXT_PUBLIC_FEATURE_CALENDAR !== 'false',
    enableFileManager: process.env.NEXT_PUBLIC_FEATURE_FILE_MANAGER !== 'false',
    enableAnalytics: process.env.NEXT_PUBLIC_FEATURE_ANALYTICS !== 'false',
    enableEcommerce: process.env.NEXT_PUBLIC_FEATURE_ECOMMERCE !== 'false',
    enableBanking: process.env.NEXT_PUBLIC_FEATURE_BANKING !== 'false',
    enableBooking: process.env.NEXT_PUBLIC_FEATURE_BOOKING !== 'false',
    enableInvoice: process.env.NEXT_PUBLIC_FEATURE_INVOICE !== 'false',
    enableBlog: process.env.NEXT_PUBLIC_FEATURE_BLOG !== 'false',
    enableJob: process.env.NEXT_PUBLIC_FEATURE_JOB !== 'false',
    enableTour: process.env.NEXT_PUBLIC_FEATURE_TOUR !== 'false',
    enableUser: process.env.NEXT_PUBLIC_FEATURE_USER !== 'false',
    enableProduct: process.env.NEXT_PUBLIC_FEATURE_PRODUCT !== 'false',
    enableOrder: process.env.NEXT_PUBLIC_FEATURE_ORDER !== 'false',
    enablePermissions: process.env.NEXT_PUBLIC_FEATURE_PERMISSIONS !== 'false',
  },

  // Module Configuration
  modules: {
    user: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    product: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    invoice: {
      enabled: true,
      permissions: ['admin', 'manager'],
      hidden: false,
    },
    blog: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    job: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    tour: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    order: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    mail: {
      enabled: true,
      permissions: [],
      hidden: false,
      badge: '+32',
    },
    chat: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    calendar: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    kanban: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    fileManager: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    analytics: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    ecommerce: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    banking: {
      enabled: true,
      permissions: [],
      hidden: false,
    },
    booking: {
      enabled: true,
      permissions: [],
      hidden: false,
      beta: true,
    },
  },

  // UI Configuration
  ui: {
    defaultLayout: 'vertical',
    allowLayoutChange: true,
    defaultTheme: 'light',
    availableThemes: ['light', 'dark'],
    defaultColorPreset: 'default',
    availableColorPresets: ['default', 'cyan', 'purple', 'blue', 'orange', 'red'],
    allowThemeChange: true,
    defaultContrast: 'default',
    allowStretch: true,
    defaultStretch: false,
    compactMode: false,
    customThemePresets: [],
  },

  // Navigation Configuration
  navigation: {
    showBreadcrumbs: true,
    showSearchBar: true,
    maxNavDepth: 3,
    collapsible: true,
    defaultCollapsed: false,
    showIcons: true,
    showBadges: true,
    sections: {
      overview: {
        id: 'overview',
        enabled: true,
        label: 'overview',
        order: 1,
        hidden: false,
        isSystem: true,
      },
      management: {
        id: 'management',
        enabled: true,
        label: 'management',
        order: 2,
        hidden: false,
        isSystem: true,
      },
      otherCases: {
        id: 'otherCases',
        enabled: true,
        label: 'other_cases',
        order: 3,
        hidden: false,
        isSystem: true,
      },
    },
    customSections: [],
    customItems: [],
  },

  // Authentication Configuration
  auth: {
    provider: 'jwt',
    allowRegistration: true,
    allowSocialLogin: true,
    requireEmailVerification: false,
    sessionTimeout: 480, // 8 hours
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
    },
    mfa: {
      enabled: false,
      required: false,
    },
  },

  // Branding Configuration
  branding: {
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'Minimal UI Kit',
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Minimals',
    logo: '/logo/logo_single.svg',
    logoDark: '/logo/logo_single.svg',
    favicon: '/favicon/favicon.ico',
    primaryColor: '#00AB55',
    secondaryColor: '#FF5630',
    metaTitle: 'Minimal UI Kit',
    metaDescription:
      'The starting point for your next project with Minimal UI Kit, built on the newest version of Material-UI ©, ready to be customized to your style',
    metaKeywords: 'react,material,kit,application,dashboard,admin,template',
  },

  // Notification Configuration
  notifications: {
    email: true,
    push: false,
    inApp: true,
    sound: true,
    desktop: false,
    position: 'top-right',
    autoHideDuration: 5000,
  },

  // Table Configuration
  table: {
    defaultPageSize: 10,
    pageSizeOptions: [5, 10, 25, 50, 100],
    enableExport: true,
    exportFormats: ['csv', 'excel', 'pdf'],
    enableFilters: true,
    stickyHeader: true,
    dense: false,
    showRowNumbers: false,
    highlightOnHover: true,
    striped: false,
  },

  // Form Configuration
  form: {
    validateOnBlur: true,
    validateOnChange: false,
    showErrorsInline: true,
    autoSave: false,
    autoSaveInterval: 30000,
    showRequiredAsterisk: true,
    confirmOnLeave: true,
  },

  // API Configuration
  api: {
    baseURL: process.env.NEXT_PUBLIC_HOST_API || 'https://api-dev-minimal-v510.vercel.app',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    enableCache: true,
    cacheDuration: 5,
    headers: {
      'Content-Type': 'application/json',
    },
  },

  // Localization Configuration
  localization: {
    defaultLanguage: process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'en',
    availableLanguages: ['en', 'fr', 'vi', 'cn', 'ar'],
    allowLanguageChange: true,
    dateFormat: 'MMM dd, yyyy',
    timeFormat: 'HH:mm:ss',
    currency: 'USD',
    numberFormat: 'en-US',
    timezone: 'UTC',
  },

  // Performance Configuration
  performance: {
    enableLazyLoading: true,
    enableVirtualization: true,
    debounceDelay: 300,
    throttleDelay: 200,
    maxFileUploadSize: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_UPLOAD_SIZE || '10485760', 10), // 10MB
    enableServiceWorker: false,
    enablePrefetch: true,
  },

  // Security Configuration
  security: {
    enableCSRF: true,
    enableXSS: true,
    enableCORS: true,
    allowedOrigins: ['http://localhost:8082', 'http://localhost:3000'],
    enableRateLimit: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
  },

  // Analytics Configuration
  analytics: {
    enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' ?? false,
    provider: null,
    trackingId: process.env.NEXT_PUBLIC_ANALYTICS_TRACKING_ID,
    anonymizeIP: true,
    trackPageViews: true,
    trackEvents: true,
    trackErrors: true,
  },

  // Custom Roles
  customRoles: [
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      permissions: ['*'],
      isSystem: true,
      color: '#FF5630',
      priority: 100,
    },
    {
      id: 'manager',
      name: 'Manager',
      description: 'Management level access',
      permissions: ['read', 'write', 'manage_team'],
      isSystem: true,
      color: '#00AB55',
      priority: 50,
    },
    {
      id: 'user',
      name: 'User',
      description: 'Standard user access',
      permissions: ['read', 'write_own'],
      isSystem: true,
      color: '#2196F3',
      priority: 10,
    },
  ],

  // Custom API Endpoints
  customEndpoints: [],

  // Plugins (will be populated by auto-discovery at runtime)
  plugins: [],
};
