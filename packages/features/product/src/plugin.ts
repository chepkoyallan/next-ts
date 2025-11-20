import type { Plugin } from '@app/types';

export const productPlugin: Plugin = {
  id: 'product',
  name: 'Product Management',
  version: '1.0.0',
  description: 'E-commerce product catalog and management',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [
    { path: '/product/list', component: 'ProductListView', layout: 'dashboard' },
    { path: '/product/shop', component: 'ProductShopView', layout: 'dashboard' },
    { path: '/product/details/:id', component: 'ProductDetailsView', layout: 'dashboard' },
    { path: '/product/shop/:id', component: 'ProductShopDetailsView', layout: 'dashboard' },
    { path: '/product/create', component: 'ProductCreateView', layout: 'dashboard' },
    { path: '/product/edit/:id', component: 'ProductEditView', layout: 'dashboard' },
  ],

  navigation: [
    {
      title: 'Product',
      path: '/product',
      icon: 'solar:box-bold-duotone',
      children: [
        { title: 'List', path: '/product/list' },
        { title: 'Shop', path: '/product/shop' },
        { title: 'Create', path: '/product/create' },
      ],
    },
  ],

  components: {
    ProductListView: () => import('./view/product-list-view'),
    ProductShopView: () => import('./view/product-shop-view'),
    ProductDetailsView: () => import('./view/product-details-view'),
    ProductShopDetailsView: () => import('./view/product-shop-details-view'),
    ProductCreateView: () => import('./view/product-create-view'),
    ProductEditView: () => import('./view/product-edit-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Product Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['product', 'e-commerce', 'catalog'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: false,
};

export default productPlugin;
