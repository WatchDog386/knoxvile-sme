/** Set once the phone has seen the welcome page. */
export const ONBOARDED_KEY = 'knoxville_onboarded';

/** Set to false to show the welcome page only on the first launch. */
export const ALWAYS_SHOW_WELCOME = false;

export function hasOnboarded(): boolean {
  if (ALWAYS_SHOW_WELCOME) return false;
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'true';
  } catch {
    return true;
  }
}
