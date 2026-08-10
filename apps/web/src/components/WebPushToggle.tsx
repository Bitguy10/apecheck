'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// OneSignal is optional. When NEXT_PUBLIC_ONESIGNAL_APP_ID is unset, web push is
// simply not configured on this deployment — alerts still appear in-app and on mobile.
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: any) => void | Promise<void>>;
  }
}

type State = 'idle' | 'unsupported' | 'unconfigured' | 'ready' | 'subscribing' | 'subscribed' | 'denied' | 'error';

let sdkInjected = false;

function loadOneSignal(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sdkInjected) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    s.defer = true;
    s.onload = () => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          await OneSignal.init({ appId, allowLocalhostAsSecureOrigin: true });
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      sdkInjected = true;
    };
    s.onerror = () => reject(new Error('Failed to load OneSignal SDK'));
    document.head.appendChild(s);
  });
}

function withOneSignal<T>(fn: (os: any) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        resolve(await fn(OneSignal));
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** Opt-in control for browser push notifications (via OneSignal, when configured). */
export function WebPushToggle() {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (!ONESIGNAL_APP_ID) {
      setState('unconfigured');
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported');
      return;
    }
    loadOneSignal(ONESIGNAL_APP_ID)
      .then(() =>
        withOneSignal(async (OneSignal) => {
          const optedIn = OneSignal.User?.PushSubscription?.optedIn;
          const id = OneSignal.User?.PushSubscription?.id;
          if (optedIn && id) {
            await api.registerPushToken(id, 'web').catch(() => {});
            setState('subscribed');
          } else if (Notification.permission === 'denied') {
            setState('denied');
          } else {
            setState('ready');
          }
        }),
      )
      .catch(() => setState('error'));
  }, []);

  async function subscribe() {
    setState('subscribing');
    try {
      await withOneSignal(async (OneSignal) => {
        await OneSignal.Notifications.requestPermission();
        if (Notification.permission === 'denied') {
          setState('denied');
          return;
        }
        await OneSignal.User.PushSubscription.optIn();
        // The subscription id may take a tick to populate.
        const id: string | undefined =
          OneSignal.User?.PushSubscription?.id ?? (await waitForId(OneSignal));
        if (id) {
          await api.registerPushToken(id, 'web');
          setState('subscribed');
        } else {
          setState('error');
        }
      });
    } catch {
      setState('error');
    }
  }

  if (state === 'idle' || state === 'unsupported') return null;

  if (state === 'unconfigured') {
    return (
      <div className="mb-3 rounded-lg border border-border bg-panel/40 px-4 py-2.5 font-mono text-[11px] text-text-muted">
        {'>'} browser push not configured here — alerts still show on this page + push to the mobile app.
      </div>
    );
  }

  if (state === 'subscribed') {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-signal-green/40 bg-signal-green/5 px-4 py-2.5 font-mono text-[11px] text-signal-green">
        <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-signal-green" />
        browser alerts enabled — you’ll get pinged on dev dumps.
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="mb-3 rounded-lg border border-warning-amber/40 bg-warning-amber/5 px-4 py-2.5 font-mono text-[11px] text-warning-amber">
        {'>'} notifications blocked in your browser. Re-enable them in site settings to get push alerts.
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-panel/60 px-4 py-3">
      <div className="font-mono text-[11px] text-text-secondary">
        {'>'} get browser push when a watched dev wallet dumps
      </div>
      <button
        onClick={subscribe}
        disabled={state === 'subscribing' || state === 'error'}
        className="rounded-md border border-signal-green/50 bg-signal-green/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-signal-green transition-colors hover:bg-signal-green/20 disabled:opacity-50"
      >
        {state === 'subscribing' ? 'enabling…' : state === 'error' ? 'try again' : '🔔 enable alerts'}
      </button>
    </div>
  );
}

/** Poll briefly for the subscription id after opt-in. */
async function waitForId(OneSignal: any): Promise<string | undefined> {
  for (let i = 0; i < 10; i++) {
    const id = OneSignal.User?.PushSubscription?.id;
    if (id) return id;
    await new Promise((r) => setTimeout(r, 300));
  }
  return undefined;
}
