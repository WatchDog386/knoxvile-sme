import type { DeviceCredential } from '@/api/types';

/**
 * What this phone or browser remembers to offer PIN sign-in: the device
 * secret, plus who it belongs to so the PIN screen can greet them. It stays
 * after signing out (that is the point) and goes with "Not you?".
 */
export interface PinDevice extends DeviceCredential {
  userId: string;
  fullName: string;
  /** What they signed in with: email or username. */
  login: string;
}

const KEY = 'ksa_pin_device';
const SKIP_KEY = 'ksa_pin_device_skip';

export function readPinDevice(): PinDevice | null {
  try {
    const raw = localStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as PinDevice) : null;
    return value?.deviceId && value.deviceToken ? value : null;
  } catch {
    return null;
  }
}

export function savePinDevice(device: PinDevice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(device));
  } catch {
    // Private mode: PIN sign-in just isn't offered next time
  }
}

export function clearPinDevice() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored
  }
}

/** "Not now" on the turn-on-PIN prompt lasts for this browser session. */
export function skipPinDeviceForNow() {
  try {
    sessionStorage.setItem(SKIP_KEY, '1');
  } catch {
    // Ignore
  }
}

export function pinDeviceSkipped(): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/** A readable label for the device list, e.g. "Android phone" or "Chrome on Windows". */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android phone';
  if (/iPhone|iPad/i.test(ua)) return 'iPhone';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

const LAST_LOGIN_KEY = 'ksa_last_login';

/** What the person typed to sign in (username or email), to show and prefill later. */
export function rememberLastLogin(identifier: string) {
  try {
    localStorage.setItem(LAST_LOGIN_KEY, identifier.trim());
  } catch {
    // Ignore
  }
}

export function lastLogin(): string | null {
  try {
    return localStorage.getItem(LAST_LOGIN_KEY);
  } catch {
    return null;
  }
}

const LAST_NAME_KEY = 'ksa_last_name';

/** Full name of whoever last signed in on this device, for "Welcome back Felix". */
export function rememberLastName(fullName: string) {
  try {
    localStorage.setItem(LAST_NAME_KEY, fullName.trim());
  } catch {
    // Ignore
  }
}

export function lastName(): string | null {
  try {
    return localStorage.getItem(LAST_NAME_KEY);
  } catch {
    return null;
  }
}
