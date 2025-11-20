import type { Plugin } from '@app/types';

export const invoicePlugin: Plugin = {
  id: 'invoice',
  name: 'Invoice',
  version: '1.0.0',
  description: 'Invoice generation and management',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [
    { path: '/invoice/list', component: 'InvoiceListView', layout: 'dashboard' },
    { path: '/invoice/:id', component: 'InvoiceDetailsView', layout: 'dashboard' },
    { path: '/invoice/create', component: 'InvoiceCreateView', layout: 'dashboard' },
    { path: '/invoice/edit/:id', component: 'InvoiceEditView', layout: 'dashboard' },
  ],

  navigation: [
    {
      title: 'Invoice',
      path: '/invoice',
      icon: 'solar:bill-list-bold-duotone',
      children: [
        { title: 'List', path: '/invoice/list' },
        { title: 'Create', path: '/invoice/create' },
      ],
    },
  ],

  components: {
    InvoiceListView: () => import('./view/invoice-list-view'),
    InvoiceDetailsView: () => import('./view/invoice-details-view'),
    InvoiceCreateView: () => import('./view/invoice-create-view'),
    InvoiceEditView: () => import('./view/invoice-edit-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Invoice Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['invoice', 'billing', 'finance'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: false,
};

export default invoicePlugin;
