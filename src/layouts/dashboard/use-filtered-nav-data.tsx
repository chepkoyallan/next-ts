import { useMemo } from 'react';

import { useConfig } from '@app/config';
import type { NavigationSectionsConfig, CustomNavItem } from '@app/types';

import Iconify from '@app/components/iconify';

import { useNavData } from './config-navigation';

// Hook to filter navigation based on configuration
// ----------------------------------------------------------------------

// Map section subheader text to config keys
const getSectionKey = (subheader: string, config: any): string | null => {
  const normalized = subheader.toLowerCase().trim();

  // Check system sections
  if (normalized === 'overview') return 'overview';
  if (normalized === 'management') return 'management';
  if (normalized.includes('other') || normalized.includes('case')) return 'otherCases';

  // Check custom sections
  const customSections = config.navigation?.customSections || [];
  const matchedCustom = customSections.find(
    (s: any) => s.label.toLowerCase() === normalized || s.id === subheader
  );

  return matchedCustom?.id || null;
};

export function useFilteredNavData() {
  const navData = useNavData();
  const { config } = useConfig();

  const filteredData = useMemo(() => {
    if (!config.features || !config.modules || !config.navigation?.sections) return navData;

    // Get all sections (system + custom)
    const allSections = [
      ...Object.values(config.navigation.sections),
      ...(config.navigation?.customSections || []),
    ];

    // Filter sections and items
    const filtered = navData
      .map((section, index) => {
        // Get section config
        const sectionKey = getSectionKey(section.subheader, config);
        const sectionConfig = sectionKey ? allSections.find((s) => s.id === sectionKey) : null;

        // Skip disabled or hidden sections
        if (sectionConfig && (!sectionConfig.enabled || sectionConfig.hidden)) {
          return null;
        }

        // Filter items within the section
        const filteredItems = section.items.filter((item) => {
          // Map navigation items to feature flags and modules
          const itemMap: Record<
            string,
            { feature?: keyof typeof config.features; module?: keyof typeof config.modules }
          > = {
            ecommerce: { feature: 'enableEcommerce', module: 'ecommerce' },
            analytics: { feature: 'enableAnalytics', module: 'analytics' },
            banking: { feature: 'enableBanking', module: 'banking' },
            booking: { feature: 'enableBooking', module: 'booking' },
            user: { feature: 'enableUser', module: 'user' },
            product: { feature: 'enableProduct', module: 'product' },
            order: { feature: 'enableOrder', module: 'order' },
            invoice: { feature: 'enableInvoice', module: 'invoice' },
            blog: { feature: 'enableBlog', module: 'blog' },
            job: { feature: 'enableJob', module: 'job' },
            tour: { feature: 'enableTour', module: 'tour' },
            mail: { feature: 'enableMail', module: 'mail' },
            chat: { feature: 'enableChat', module: 'chat' },
            calendar: { feature: 'enableCalendar', module: 'calendar' },
            kanban: { feature: 'enableKanban', module: 'kanban' },
            file_manager: { feature: 'enableFileManager', module: 'fileManager' },
          };

          // Find matching config for this nav item
          const itemKey = item.title.toLowerCase().replace(/\s+/g, '_');
          const configKeys = itemMap[itemKey];

          if (!configKeys) {
            // If no mapping, show item by default
            return true;
          }

          // Check feature flag
          if (configKeys.feature && !config.features[configKeys.feature]) {
            return false;
          }

          // Check module enabled
          if (configKeys.module) {
            const moduleConfig = config.modules[configKeys.module];
            if (!moduleConfig || !moduleConfig.enabled || moduleConfig.hidden) {
              return false;
            }
          }

          return true;
        });

        // Skip sections with no items
        if (filteredItems.length === 0) {
          return null;
        }

        // Use custom label if provided
        const subheader = sectionConfig?.label || section.subheader;

        return {
          ...section,
          subheader,
          items: filteredItems,
          _order: sectionConfig?.order ?? index,
        };
      })
      .filter((section): section is NonNullable<typeof section> => section !== null);

    // Sort by order
    filtered.sort((a, b) => (a._order ?? 0) - (b._order ?? 0));

    // Remove temporary _order property
    const sectionsWithoutOrder = filtered.map(({ _order, ...section }) => section);

    // Add custom navigation items
    const customItems = config.navigation?.customItems || [];
    if (customItems.length > 0) {
      // Convert custom items to nav item format
      const convertCustomItem = (item: CustomNavItem): any => ({
        title: item.title,
        path: item.path,
        icon: item.icon ? <Iconify icon={item.icon} /> : undefined,
        roles: item.roles,
        disabled: !item.enabled,
        info: item.badge ? item.badge : undefined,
        children: item.children?.map(convertCustomItem),
      });

      // Group custom items by section
      const customBySections = customItems.reduce(
        (acc, item) => {
          if (!item.enabled || item.hidden) return acc;

          const sectionKey = item.section;
          if (!acc[sectionKey]) {
            acc[sectionKey] = [];
          }
          acc[sectionKey].push(convertCustomItem(item));
          return acc;
        },
        {} as Record<string, any[]>
      );

      // Add custom items to their respective sections
      const result = sectionsWithoutOrder.map((section) => {
        const sectionKey = getSectionKey(section.subheader, config);
        if (sectionKey && customBySections[sectionKey]) {
          return {
            ...section,
            items: [...section.items, ...customBySections[sectionKey]],
          };
        }
        return section;
      });

      // Add custom sections with their items
      const customSections = config.navigation?.customSections || [];
      customSections.forEach((customSection) => {
        if (!customSection.enabled || customSection.hidden) return;

        const sectionItems = customBySections[customSection.id] || [];
        if (sectionItems.length > 0) {
          result.push({
            subheader: customSection.label,
            items: sectionItems,
            _order: customSection.order,
          });
        }
      });

      // Sort result by order if sections were added
      if (customSections.length > 0) {
        result.sort((a: any, b: any) => (a._order ?? 0) - (b._order ?? 0));
        return result.map(({ _order, ...section }: any) => section);
      }

      return result;
    }

    return sectionsWithoutOrder;
  }, [navData, config]);

  return filteredData;
}
