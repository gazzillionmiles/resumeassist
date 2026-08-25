'use client';
import { create } from 'zustand';

const TOKEN_KEY = 'jd_outreach_token';
function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }

export const useAuthStore = create((set) => ({
  token: null,
  hydrated: false,
  hydrate: () => set({ token: getToken(), hydrated: true }),
  setToken: (token) => { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); set({ token }); },
  logout: () => { localStorage.removeItem(TOKEN_KEY); set({ token: null }); },
}));
