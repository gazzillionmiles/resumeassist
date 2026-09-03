'use client';
import { create } from 'zustand';

const TOKEN_KEY = 'jd_outreach_token';
const USER_KEY = 'jd_outreach_user';

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate: () => {
    set({
      token: getToken(),
      user: getUser(),
      hydrated: true,
    });
  },
  setToken: (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    set({ token });
  },
  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    set({ user });
  },
  setAuth: (token, user) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);

    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);

    set({ token, user });
  },
  updateUser: (fields) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...fields };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return { user: updated };
    });
  },
  updateCredits: ({ free, purchased, total }) => {
    set((state) => {
      if (!state.user) return state;
      const currentCredits = state.user.credits || {};
      const newCredits = {
        free: typeof free === 'number' ? free : currentCredits.free ?? 0,
        purchased: typeof purchased === 'number' ? purchased : currentCredits.purchased ?? 0,
        total: typeof total === 'number' ? total : (free ?? currentCredits.free ?? 0) + (purchased ?? currentCredits.purchased ?? 0),
      };
      const updated = { ...state.user, credits: newCredits };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return { user: updated };
    });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
}));
