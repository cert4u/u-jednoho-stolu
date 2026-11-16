'use client';

import { useEffect, useState } from 'react';

export function usePublicPj() {
  const [mode, setMode] = useState<'loading' | 'enabled' | 'local'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/pj/api/mode', { signal: controller.signal, cache: 'no-store' })
      .then((response) => setMode(response.ok ? 'enabled' : 'local'))
      .catch(() => {
        if (!controller.signal.aborted) setMode('local');
      });
    return () => controller.abort();
  }, []);
  return mode;
}
