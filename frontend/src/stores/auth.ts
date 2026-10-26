import { create } from 'zustand';
import type { User } from '@/api/types';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

function readToken(): string | null {
  return localStorage.getItem('ksa_token');
}

const AVATAR_KEY = 'ksa_last_avatar';

/**
 * Remembers the last signed-in user's photo on this device so the login
 * screen can greet them with it. Cleared when they remove their photo.
 */
function rememberAvatar(user: User | null) {
  if (!user) return;
  try {
    if (user.avatarUrl) localStorage.setItem(AVATAR_KEY, user.avatarUrl);
    else localStorage.removeItem(AVATAR_KEY);
  } catch {
    // Storage full or unavailable: the login screen falls back to the icon.
  }
}

/** Photo of the last user who signed in on this device, if they set one. */
export function readRememberedAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: readToken(),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('ksa_token', token);
    rememberAvatar(user);
    set({ token, user });
  },
  setUser: (user) => {
    rememberAvatar(user);
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('ksa_token');
    localStorage.removeItem('ksa_business_id');
    set({ token: null, user: null });
  },
}));