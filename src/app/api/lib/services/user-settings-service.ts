/**
 * User Settings Service
 * Handles all user settings CRUD operations
 */

import { prisma } from '@app/database';

export interface UserSettingsData {
  // General Settings
  autoSave: boolean;
  autoSaveInterval: number;
  defaultView: 'grid' | 'list' | 'kanban';
  itemsPerPage: number;

  // Theme & Appearance
  themeMode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  compactMode: boolean;
  animations: boolean;

  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
  notifySchemaCreated: boolean;
  notifyAssignment: boolean;
  notifySubmission: boolean;

  // Security
  sessionTimeout: number;
  requirePasswordChange: boolean;

  // Editor Preferences
  editorTheme: string;
  fontSize: number;
  tabSize: number;
  autoComplete: boolean;
  formatOnSave: boolean;

  // Advanced Options
  debugMode: boolean;
  cacheEnabled: boolean;
  experimentalFeatures: boolean;
}

export interface UserSettingsResponse extends UserSettingsData {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get user settings by user ID
 * Creates default settings if none exist
 */
export async function getUserSettings(userId: string): Promise<UserSettingsResponse> {
  let settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  // Create default settings if none exist
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: {
        userId,
        // All defaults are defined in Prisma schema
      },
    });
  }

  return settings as UserSettingsResponse;
}

/**
 * Update user settings
 * Creates settings if they don't exist
 */
export async function updateUserSettings(
  userId: string,
  updates: Partial<UserSettingsData>
): Promise<UserSettingsResponse> {
  // Use upsert to handle both create and update
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: updates,
    create: {
      userId,
      ...updates,
    },
  });

  return settings as UserSettingsResponse;
}

/**
 * Reset user settings to defaults
 */
export async function resetUserSettings(userId: string): Promise<UserSettingsResponse> {
  const defaultSettings: Partial<UserSettingsData> = {
    autoSave: true,
    autoSaveInterval: 30,
    defaultView: 'grid',
    itemsPerPage: 20,
    themeMode: 'auto',
    primaryColor: '#1976d2',
    compactMode: false,
    animations: true,
    emailNotifications: true,
    pushNotifications: false,
    notifySchemaCreated: true,
    notifyAssignment: true,
    notifySubmission: false,
    sessionTimeout: 30,
    requirePasswordChange: false,
    editorTheme: 'vs-dark',
    fontSize: 14,
    tabSize: 2,
    autoComplete: true,
    formatOnSave: true,
    debugMode: false,
    cacheEnabled: true,
    experimentalFeatures: false,
  };

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: defaultSettings,
    create: {
      userId,
      ...defaultSettings,
    },
  });

  return settings as UserSettingsResponse;
}

/**
 * Delete user settings
 */
export async function deleteUserSettings(userId: string): Promise<boolean> {
  try {
    await prisma.userSettings.delete({
      where: { userId },
    });
    return true;
  } catch {
    // Settings don't exist, that's fine
    return false;
  }
}
