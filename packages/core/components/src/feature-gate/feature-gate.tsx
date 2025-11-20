'use client';

import { ReactNode } from 'react';

import { useFeature, useModulePermission } from '@app/config';
import type { FeatureFlags, ModulesConfig } from '@app/config/types';

// Feature Gate Component
// Conditionally render children based on feature flags and module configuration
// ----------------------------------------------------------------------

interface FeatureGateProps {
  children: ReactNode;
  feature?: keyof FeatureFlags;
  module?: keyof ModulesConfig;
  userRoles?: string[];
  fallback?: ReactNode;
}

export function FeatureGate({
  children,
  feature,
  module,
  userRoles = [],
  fallback = null,
}: FeatureGateProps) {
  // Check feature flag
  const featureEnabled = useFeature(feature!);

  // Check module permission
  const hasModuleAccess = useModulePermission(module!, userRoles);

  // If feature specified and disabled, don't render
  if (feature && !featureEnabled) {
    return <>{fallback}</>;
  }

  // If module specified and no access, don't render
  if (module && !hasModuleAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Convenience components for specific features
export function ChatGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <FeatureGate feature="enableChat">{children}</FeatureGate>;
}

export function MailGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <FeatureGate feature="enableMail">{children}</FeatureGate>;
}

export function KanbanGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <FeatureGate feature="enableKanban">{children}</FeatureGate>;
}

export function CalendarGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <FeatureGate feature="enableCalendar">{children}</FeatureGate>;
}

export function EcommerceGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <FeatureGate feature="enableEcommerce">{children}</FeatureGate>;
}

export function AnalyticsGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <FeatureGate feature="enableAnalytics">{children}</FeatureGate>;
}

export function InvoiceGate({
  children,
  userRoles,
  fallback,
}: {
  children: ReactNode;
  userRoles?: string[];
  fallback?: ReactNode;
}) {
  return (
    <FeatureGate feature="enableInvoice" module="invoice" userRoles={userRoles}>
      {children}
    </FeatureGate>
  );
}
