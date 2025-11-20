import { NextRequest, NextResponse } from 'next/server';

import { authMiddleware } from 'src/app/api/lib/middleware/auth';

import { recordMetric } from '../../../lib/services/metrics-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';
import {
  getUserSettings,
  UserSettingsData,
  resetUserSettings,
  updateUserSettings,
} from '../../../lib/services/user-settings-service';

/**
 * GET /api/v1/users/settings
 * Get current user's settings
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const authContext = await authMiddleware(request);

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const userId = authContext.user.id;
    const settings = await getUserSettings(userId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/users/settings',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(createSuccessEnvelope({ settings }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching user settings:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/users/settings',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch user settings', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/users/settings
 * Update current user's settings
 */
export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const authContext = await authMiddleware(request);

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const userId = authContext.user.id;
    const body = await request.json();

    // Validate settings data
    if (!body || typeof body !== 'object') {
      recordMetric({
        endpoint: '/api/v1/users/settings',
        method: 'PUT',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid settings data', requestId),
        { status: 400 }
      );
    }

    const updates: Partial<UserSettingsData> = {};

    // General Settings
    if (body.general) {
      if (body.general.autoSave !== undefined) updates.autoSave = body.general.autoSave;
      if (body.general.autoSaveInterval !== undefined)
        updates.autoSaveInterval = body.general.autoSaveInterval;
      if (body.general.defaultView !== undefined) updates.defaultView = body.general.defaultView;
      if (body.general.itemsPerPage !== undefined) updates.itemsPerPage = body.general.itemsPerPage;
    }

    // Theme Settings
    if (body.theme) {
      if (body.theme.themeMode !== undefined) updates.themeMode = body.theme.themeMode;
      if (body.theme.primaryColor !== undefined) updates.primaryColor = body.theme.primaryColor;
      if (body.theme.compactMode !== undefined) updates.compactMode = body.theme.compactMode;
      if (body.theme.animations !== undefined) updates.animations = body.theme.animations;
    }

    // Notifications
    if (body.notifications) {
      if (body.notifications.emailNotifications !== undefined)
        updates.emailNotifications = body.notifications.emailNotifications;
      if (body.notifications.pushNotifications !== undefined)
        updates.pushNotifications = body.notifications.pushNotifications;
      if (body.notifications.notifySchemaCreated !== undefined)
        updates.notifySchemaCreated = body.notifications.notifySchemaCreated;
      if (body.notifications.notifyAssignment !== undefined)
        updates.notifyAssignment = body.notifications.notifyAssignment;
      if (body.notifications.notifySubmission !== undefined)
        updates.notifySubmission = body.notifications.notifySubmission;
    }

    // Security
    if (body.security) {
      if (body.security.sessionTimeout !== undefined)
        updates.sessionTimeout = body.security.sessionTimeout;
      if (body.security.requirePasswordChange !== undefined)
        updates.requirePasswordChange = body.security.requirePasswordChange;
    }

    // Editor Preferences
    if (body.editor) {
      if (body.editor.editorTheme !== undefined) updates.editorTheme = body.editor.editorTheme;
      if (body.editor.fontSize !== undefined) updates.fontSize = body.editor.fontSize;
      if (body.editor.tabSize !== undefined) updates.tabSize = body.editor.tabSize;
      if (body.editor.autoComplete !== undefined) updates.autoComplete = body.editor.autoComplete;
      if (body.editor.formatOnSave !== undefined) updates.formatOnSave = body.editor.formatOnSave;
    }

    // Advanced Options
    if (body.advanced) {
      if (body.advanced.debugMode !== undefined) updates.debugMode = body.advanced.debugMode;
      if (body.advanced.cacheEnabled !== undefined)
        updates.cacheEnabled = body.advanced.cacheEnabled;
      if (body.advanced.experimentalFeatures !== undefined)
        updates.experimentalFeatures = body.advanced.experimentalFeatures;
    }

    const updatedSettings = await updateUserSettings(userId, updates);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/users/settings',
      method: 'PUT',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          settings: updatedSettings,
          message: 'Settings updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating user settings:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/users/settings',
      method: 'PUT',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('UPDATE_ERROR', 'Failed to update user settings', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/users/settings/reset
 * Reset current user's settings to defaults
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const authContext = await authMiddleware(request);

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const userId = authContext.user.id;

    // Only handle reset action
    const body = await request.json();
    if (body.action !== 'reset') {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid action', requestId),
        { status: 400 }
      );
    }

    const resetSettings = await resetUserSettings(userId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/users/settings',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          settings: resetSettings,
          message: 'Settings reset to defaults successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error resetting user settings:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/users/settings',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('RESET_ERROR', 'Failed to reset user settings', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
