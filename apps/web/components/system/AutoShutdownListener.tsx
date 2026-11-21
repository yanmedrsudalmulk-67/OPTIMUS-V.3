'use client';

import { useEffect } from 'react';

export default function AutoShutdownListener() {
  useEffect(() => {
    // 1. Send periodic heartbeat so server knows game window is alive
    const ping = () => {
      try {
        fetch('/system-api/heartbeat', {
          method: 'POST',
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };

    // Ping immediately on mount
    ping();
    // Heartbeat every 2.5 seconds
    const timer = setInterval(ping, 2500);

    // Send immediate ping when window regains focus or visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        ping();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', ping);

    // 2. Beacon on window close / application exit
    const handleUnload = () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon('/system-api/shutdown');
        } else {
          fetch('/system-api/shutdown', { method: 'POST', keepalive: true }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', ping);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  return null;
}
