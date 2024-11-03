'use client';

import { useEffect } from 'react';

export function useTokenInitializer() {
  useEffect(() => {
    const initToken = async () => {
      try {
        const response = await fetch('/api/token');
        const data = await response.json();
        if (!data.success) {
          console.error('Token initialization failed:', data.error);
        }
      } catch (error) {
        console.error('Token initialization error:', error);
      }
    };

    initToken();
  }, []);
} 