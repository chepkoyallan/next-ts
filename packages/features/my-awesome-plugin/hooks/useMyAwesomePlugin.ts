'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook for my-awesome-plugin
 */
export function useMyAwesomePlugin() {
  const [data, setData] = useState<string>('');

  useEffect(() => {
    // Fetch or compute data
    setData('Hello from my-awesome-plugin!');
  }, []);

  return data;
}

export default useMyAwesomePlugin;
