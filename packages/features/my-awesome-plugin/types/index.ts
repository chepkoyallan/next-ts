/**
 * Type definitions for my-awesome-plugin
 */

export interface MyAwesomePluginConfig {
  enabled: boolean;
  debug?: boolean;
}

export interface MyAwesomePluginData {
  id: string;
  name: string;
  createdAt: Date;
}

// Add more types as needed
