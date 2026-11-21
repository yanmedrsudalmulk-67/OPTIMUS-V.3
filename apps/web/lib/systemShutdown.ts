import { exec } from 'child_process';
import path from 'path';

declare global {
  // eslint-disable-next-line no-var
  var __lastHeartbeatTime: number | undefined;
  // eslint-disable-next-line no-var
  var __pendingShutdownTime: number | undefined;
  // eslint-disable-next-line no-var
  var __systemWatchdogActive: boolean | undefined;
  // eslint-disable-next-line no-var
  var __serverStartTime: number | undefined;
}

if (!global.__serverStartTime) {
  global.__serverStartTime = Date.now();
}

export function recordHeartbeat() {
  global.__lastHeartbeatTime = Date.now();
  // Cancel any pending shutdown (e.g. from beforeunload during page reload/navigation)
  if (global.__pendingShutdownTime) {
    global.__pendingShutdownTime = undefined;
  }
  ensureWatchdog();
}

export function requestShutdown(immediate = false) {
  if (immediate) {
    terminateSystem();
    return;
  }
  // Grace period of 5 seconds to distinguish tab close from page refresh (F5) or internal navigation
  global.__pendingShutdownTime = Date.now();
  ensureWatchdog();
}

export function terminateSystem() {
  console.log('[System] Executing application shutdown...');
  try {
    const projectDir = path.resolve(process.cwd());
    const stopBat = path.join(projectDir, 'HENTIKAN-WINDOWS.bat');
    exec(`cmd.exe /c "${stopBat}"`, { cwd: projectDir });
  } catch (err) {
    console.error('[System] Error triggering HENTIKAN-WINDOWS.bat:', err);
  }

  // Final process termination after brief delay to let response complete
  setTimeout(() => {
    try {
      process.exit(0);
    } catch {
      /* ignore */
    }
  }, 400);
}

function ensureWatchdog() {
  if (global.__systemWatchdogActive) return;
  global.__systemWatchdogActive = true;

  setInterval(() => {
    const now = Date.now();
    const serverStart = global.__serverStartTime || now;
    const pending = global.__pendingShutdownTime;
    const last = global.__lastHeartbeatTime || 0;

    // Grace period during server boot: at least 45 seconds before any auto-watchdog kicks in
    if (now - serverStart < 45000 && !pending) {
      return;
    }

    // 1. If shutdown was initiated via unload beacon and no new heartbeat arrived within 5s
    if (pending && now - pending > 5000) {
      console.log('[System] Shutdown confirmed: no reconnect after window close.');
      terminateSystem();
      return;
    }

    // 2. Watchdog: if client was active before, but no heartbeats for > 30 seconds
    // (covers cases where browser was closed without beforeunload firing, or taskkill)
    if (last > 0 && now - last > 30000) {
      console.log('[System] Inactivity detected: all game windows closed (>30s without heartbeat).');
      terminateSystem();
    }
  }, 1000);
}
