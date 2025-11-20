import axios, { AxiosRequestConfig } from 'axios';

import { HOST_API } from 'src/config-global';
import { getConfigManager } from '@app/config';

// ----------------------------------------------------------------------

// Get API configuration from config system
const getBaseURL = () => {
  try {
    const configManager = getConfigManager();
    const apiConfig = configManager.get('api');
    return apiConfig?.baseURL || HOST_API;
  } catch {
    return HOST_API; // Fallback to env variable if config not available
  }
};

const axiosInstance = axios.create({ baseURL: getBaseURL() });

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => Promise.reject((error.response && error.response.data) || 'Something went wrong')
);

// Update baseURL when config changes
if (typeof window !== 'undefined') {
  try {
    const configManager = getConfigManager();
    configManager.subscribe((newConfig) => {
      if (newConfig.api?.baseURL) {
        axiosInstance.defaults.baseURL = newConfig.api.baseURL;
      }
    });
  } catch {
    // Config manager not available yet
  }
}

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args: string | [string, AxiosRequestConfig]) => {
  const [url, config] = Array.isArray(args) ? args : [args];

  const res = await axiosInstance.get(url, { ...config });

  return res.data;
};

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat',
  kanban: '/api/kanban',
  calendar: '/api/calendar',
  auth: {
    me: '/api/auth/me',
    login: '/api/auth/login',
    register: '/api/auth/register',
  },
  mail: {
    list: '/api/mail/list',
    details: '/api/mail/details',
    labels: '/api/mail/labels',
  },
  post: {
    list: '/api/post/list',
    details: '/api/post/details',
    latest: '/api/post/latest',
    search: '/api/post/search',
  },
  product: {
    list: '/api/product/list',
    details: '/api/product/details',
    search: '/api/product/search',
  },
};
