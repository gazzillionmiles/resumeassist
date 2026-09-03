'use client';

import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedFingerprintPromise = null;
let cachedFingerprintValue = null;

const APP_PREFIX = process.env.NEXT_PUBLIC_APP_COOKIE_PREFIX || 'outreach';
const CLIENT_ID_COOKIE = `${APP_PREFIX}_client_id`;
const FP_SESSION_KEY = `${APP_PREFIX}_device_fingerprint`;

/**
 * Gets or creates the persistent client ID cookie.
 *
 * @returns {string}
 */
export function getAppClientId() {
  if (typeof document === 'undefined') return '';

  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === CLIENT_ID_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }

  // Create new client_id if missing
  const newClientId = `${APP_PREFIX}_cid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${CLIENT_ID_COOKIE}=${encodeURIComponent(newClientId)}; expires=${expires}; path=/; SameSite=Lax`;
  return newClientId;
}

/**
 * Computes visitor fingerprint client-side using FingerprintJS free tier.
 * Caches in memory and sessionStorage for the duration of the session.
 *
 * @returns {Promise<string|null>}
 */
export async function getVisitorFingerprint() {
  if (typeof window === 'undefined') return null;

  // 1. Check memory cache
  if (cachedFingerprintValue) {
    return cachedFingerprintValue;
  }

  // 2. Check sessionStorage cache
  try {
    const stored = window.sessionStorage.getItem(FP_SESSION_KEY);
    if (stored) {
      cachedFingerprintValue = stored;
      return stored;
    }
  } catch {
    // sessionStorage not available
  }

  // 3. De-duplicate concurrent load calls
  if (cachedFingerprintPromise) {
    return cachedFingerprintPromise;
  }

  cachedFingerprintPromise = (async () => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const visitorId = result.visitorId;

      cachedFingerprintValue = visitorId;
      try {
        window.sessionStorage.setItem(FP_SESSION_KEY, visitorId);
      } catch {
        // sessionStorage write failed
      }
      return visitorId;
    } catch (err) {
      console.warn('[FingerprintJS] Failed to compute visitor fingerprint:', err);
      return null;
    } finally {
      cachedFingerprintPromise = null;
    }
  })();

  return cachedFingerprintPromise;
}
