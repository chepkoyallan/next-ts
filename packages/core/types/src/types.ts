// Configuration Types
// ----------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark';
export type ThemeLayout = 'vertical' | 'horizontal' | 'mini';
export type ThemeContrast = 'default' | 'bold';
export type ThemeColorPreset = 'default' | 'cyan' | 'purple' | 'blue' | 'orange' | 'red';

// Custom Theme Preset
export interface CustomThemePreset {
  id: string;
  name: string;
  description?: string;
  primaryColor: string;
  secondaryColor: string;
  errorColor?: string;
  warningColor?: string;
  infoColor?: string;
  successColor?: string;
  isSystem?: boolean; // Flag to prevent deletion of built-in presets
  createdAt?: string;
}

// Custom Role
export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  inheritsFrom?: string[]; // Other role IDs to inherit permissions from
  color?: string; // Display color for badges
  isSystem?: boolean; // Flag to prevent deletion of built-in roles
  priority?: number; // Higher priority roles override lower ones
  createdAt?: string;
}

// API Endpoint Configuration
export interface APIEndpointConfig {
  id: string;
  name: string;
  description?: string;
  path: string; // e.g., '/custom/data' (will be prefixed with /api/dynamic)
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  enabled: boolean;

  // Proxy settings - route to external API
  proxy?: {
    enabled: boolean;
    targetUrl: string; // Full URL or base URL
    headers?: Record<string, string>; // Additional headers
    timeout?: number; // Request timeout in ms
    followRedirects?: boolean;
    transformResponse?: boolean; // Apply response transformation
  };

  // Authentication
  auth?: {
    required: boolean;
    roles?: string[]; // Required roles
    permissions?: string[]; // Required permissions
    apiKeyAllowed?: boolean; // Allow API key auth
  };

  // Rate limiting
  rateLimit?: {
    enabled: boolean;
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
  };

  // Request/Response
  requestHeaders?: Record<string, string>; // Default headers to add
  responseHeaders?: Record<string, string>; // Headers to add to response

  // Metadata
  tags?: string[];
  version?: string;
  deprecated?: boolean;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Feature Flags
export interface FeatureFlags {
  enableChat: boolean;
  enableMail: boolean;
  enableKanban: boolean;
  enableCalendar: boolean;
  enableFileManager: boolean;
  enableAnalytics: boolean;
  enableEcommerce: boolean;
  enableBanking: boolean;
  enableBooking: boolean;
  enableInvoice: boolean;
  enableBlog: boolean;
  enableJob: boolean;
  enableTour: boolean;
  enableUser: boolean;
  enableProduct: boolean;
  enableOrder: boolean;
  enablePermissions: boolean;
}

// Module Configuration
export interface ModuleConfig {
  enabled: boolean;
  permissions: string[];
  hidden?: boolean;
  badge?: string | number;
  beta?: boolean;
}

export interface ModulesConfig {
  user: ModuleConfig;
  product: ModuleConfig;
  invoice: ModuleConfig;
  blog: ModuleConfig;
  job: ModuleConfig;
  tour: ModuleConfig;
  order: ModuleConfig;
  mail: ModuleConfig;
  chat: ModuleConfig;
  calendar: ModuleConfig;
  kanban: ModuleConfig;
  fileManager: ModuleConfig;
  analytics: ModuleConfig;
  ecommerce: ModuleConfig;
  banking: ModuleConfig;
  booking: ModuleConfig;
}

// UI Configuration
export interface UIConfig {
  defaultLayout: ThemeLayout;
  allowLayoutChange: boolean;
  defaultTheme: ThemeMode;
  availableThemes: ThemeMode[];
  defaultColorPreset: ThemeColorPreset;
  availableColorPresets: ThemeColorPreset[];
  allowThemeChange: boolean;
  defaultContrast: ThemeContrast;
  allowStretch: boolean;
  defaultStretch: boolean;
  compactMode: boolean;
  customThemePresets: CustomThemePreset[];
}

// Custom Navigation Item
export interface CustomNavItem {
  id: string;
  title: string;
  path: string;
  icon?: string;
  section: string; // Changed to string to support any section ID
  order?: number;
  enabled: boolean;
  hidden?: boolean;
  roles?: string[];
  badge?: string;
  external?: boolean;
  children?: CustomNavItem[];
  parentId?: string | null;
}

// Navigation Section Configuration
export interface NavigationSectionConfig {
  id: string;
  enabled: boolean;
  label: string;
  order: number;
  hidden?: boolean;
  isSystem?: boolean; // Flag to prevent deletion of built-in sections
}

export interface NavigationSectionsConfig {
  overview: NavigationSectionConfig;
  management: NavigationSectionConfig;
  otherCases: NavigationSectionConfig;
}

// Navigation Configuration
export interface NavigationConfig {
  showBreadcrumbs: boolean;
  showSearchBar: boolean;
  maxNavDepth: number;
  collapsible: boolean;
  defaultCollapsed: boolean;
  showIcons: boolean;
  showBadges: boolean;
  sections: NavigationSectionsConfig;
  customSections: NavigationSectionConfig[]; // Dynamic sections
  customItems: CustomNavItem[];
}

// Authentication Configuration
export interface AuthConfig {
  provider: 'jwt' | 'auth0' | 'firebase' | 'amplify' | 'supabase';
  allowRegistration: boolean;
  allowSocialLogin: boolean;
  requireEmailVerification: boolean;
  sessionTimeout: number; // in minutes
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  mfa: {
    enabled: boolean;
    required: boolean;
  };
}

// Branding Configuration
export interface BrandingConfig {
  appName: string;
  companyName: string;
  logo: string;
  logoDark?: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
}

// Notification Configuration
export interface NotificationConfig {
  email: boolean;
  push: boolean;
  inApp: boolean;
  sound: boolean;
  desktop: boolean;
  position:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center';
  autoHideDuration: number;
}

// Table Configuration
export interface TableConfig {
  defaultPageSize: number;
  pageSizeOptions: number[];
  enableExport: boolean;
  exportFormats: ('csv' | 'excel' | 'pdf')[];
  enableFilters: boolean;
  stickyHeader: boolean;
  dense: boolean;
  showRowNumbers: boolean;
  highlightOnHover: boolean;
  striped: boolean;
}

// Form Configuration
export interface FormConfig {
  validateOnBlur: boolean;
  validateOnChange: boolean;
  showErrorsInline: boolean;
  autoSave: boolean;
  autoSaveInterval: number; // in milliseconds
  showRequiredAsterisk: boolean;
  confirmOnLeave: boolean;
}

// API Configuration
export interface APIConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  enableCache: boolean;
  cacheDuration: number; // in minutes
  headers: Record<string, string>;
}

// Localization Configuration
export interface LocalizationConfig {
  defaultLanguage: string;
  availableLanguages: string[];
  allowLanguageChange: boolean;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  numberFormat: string;
  timezone: string;
}

// Performance Configuration
export interface PerformanceConfig {
  enableLazyLoading: boolean;
  enableVirtualization: boolean;
  debounceDelay: number;
  throttleDelay: number;
  maxFileUploadSize: number; // in bytes
  enableServiceWorker: boolean;
  enablePrefetch: boolean;
}

// Security Configuration
export interface SecurityConfig {
  enableCSRF: boolean;
  enableXSS: boolean;
  enableCORS: boolean;
  allowedOrigins: string[];
  enableRateLimit: boolean;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

// Analytics Configuration
export interface AnalyticsConfig {
  enabled: boolean;
  provider: 'google' | 'mixpanel' | 'segment' | 'custom' | null;
  trackingId?: string;
  anonymizeIP: boolean;
  trackPageViews: boolean;
  trackEvents: boolean;
  trackErrors: boolean;
}

// Main App Configuration
export interface AppConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: FeatureFlags;
  modules: ModulesConfig;
  ui: UIConfig;
  navigation: NavigationConfig;
  auth: AuthConfig;
  branding: BrandingConfig;
  notifications: NotificationConfig;
  table: TableConfig;
  form: FormConfig;
  api: APIConfig;
  localization: LocalizationConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
  analytics: AnalyticsConfig;
  customRoles: CustomRole[];
  customEndpoints: APIEndpointConfig[];
  plugins: Plugin[];
}

// Tenant Configuration
export interface TenantConfig extends Partial<AppConfig> {
  tenantId: string;
  tenantName: string;
  subdomain?: string;
  customDomain?: string;
  active: boolean;
}

// Plugin Types
export interface PluginRoute {
  path: string;
  component: React.ComponentType<any>;
  exact?: boolean;
  protected?: boolean;
  layout?: 'dashboard' | 'auth' | 'minimal' | 'custom';
  meta?: {
    title?: string;
    description?: string;
    keywords?: string;
  };
}

export interface PluginNavItem {
  id: string;
  title: string;
  path: string;
  icon?: string;
  section?: string; // Which nav section to add to
  order?: number;
  children?: PluginNavItem[];
  roles?: string[]; // Required roles
  badge?: string;
}

export interface PluginHooks {
  onInit?: () => void | Promise<void>;
  onAuth?: (user: any) => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
  beforeRouteChange?: (to: string, from: string) => boolean | Promise<boolean>;
  onError?: (error: Error) => void;
  onConfigChange?: (config: Partial<AppConfig>) => void;
  onThemeChange?: (theme: ThemeMode) => void;
}

export interface PluginLayout {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  isDefault?: boolean;
}

export interface PluginSection {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  route?: string; // Optional route to register
  configTab?: boolean; // Show in configuration dashboard
  order?: number;
}

export interface PluginAPI {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  handler: (req: any, res: any) => Promise<any>;
  auth?: boolean;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

export type PluginType = 'ui' | 'api' | 'integration' | 'theme' | 'utility' | 'full';

export type PluginStatus = 'active' | 'inactive' | 'error' | 'loading';

export interface PluginMetadata {
  repository?: string;
  homepage?: string;
  license?: string;
  tags?: string[];
  screenshots?: string[];
  changelog?: string;
  readme?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  status?: PluginStatus;
  type: PluginType;

  // UI Components
  routes?: PluginRoute[];
  navigation?: PluginNavItem[];
  components?: Record<string, React.ComponentType<any>>;
  layouts?: PluginLayout[];
  sections?: PluginSection[];

  // Functionality
  hooks?: PluginHooks;
  apis?: PluginAPI[];

  // Configuration
  settings?: Record<string, any>;
  dependencies?: string[];
  configSchema?: Record<string, any>; // JSON Schema for settings

  // Metadata
  metadata?: PluginMetadata;
  installDate?: string;
  updateDate?: string;
  isSystem?: boolean; // System plugins can't be deleted

  // Source
  source?: 'local' | 'npm' | 'url' | 'inline';
  sourceUrl?: string; // For remote plugins
  entryPoint?: string; // Main file path or module name
}

// Configuration Override
export interface ConfigOverride extends Partial<AppConfig> {
  priority?: number;
}
