import { useAuthStore } from '@/state/authStore';
import { getVisitorFingerprint, getAppClientId } from '@/lib/client/fingerprint';

async function request(path, options = {}) {
  const token = useAuthStore.getState().token;
  const fp = typeof window !== 'undefined' ? await getVisitorFingerprint().catch(() => null) : null;
  const clientId = typeof document !== 'undefined' ? getAppClientId() : null;

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fp ? { 'x-device-fingerprint': fp } : {}),
      ...(clientId ? { 'x-client-id': clientId } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch {}
    const err = new Error(body?.message || body?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  signup: (email, password) => request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),
  verifyEmail: (token) => request(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: JSON.stringify(email ? { email } : {}) }),
  syncFingerprint: (fingerprint, clientId) => request('/auth/fingerprint', { method: 'POST', body: JSON.stringify({ fingerprint, clientId }) }),
  getProfile: () => request('/profile'),
  saveProfile: (fields) => request('/profile', { method: 'POST', body: JSON.stringify(fields) }),
  uploadResume: (file) => { const form = new FormData(); form.append('resume', file); return request('/profile/resume', { method: 'POST', body: form }); },
  listPlaybook: () => request('/playbook'),
  addPlaybookExample: (exampleText, sourceNote) => request('/playbook', { method: 'POST', body: JSON.stringify({ exampleText, sourceNote }) }),
  deletePlaybookExample: (id) => request(`/playbook/${id}`, { method: 'DELETE' }),
  fetchJD: (payload) => request('/generate/jd', { method: 'POST', body: JSON.stringify(payload) }),
  searchCompanyResearch: (payload) => request('/research/search', { method: 'POST', body: JSON.stringify(payload) }),
  analyzeCompanyResearch: (payload) => request('/research/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  researchCompanyPeople: (payload) => request('/company-outreach/research', { method: 'POST', body: JSON.stringify(payload) }),
  generateCompanyOutreach: (payload) => request('/company-outreach/generate', { method: 'POST', body: JSON.stringify(payload) }),
  generate: (payload) => request('/generate', { method: 'POST', body: JSON.stringify(payload) }),
  listGenerations: () => request('/generations'),
  createGeneration: (payload) => request('/generations', { method: 'POST', body: JSON.stringify(payload) }),
  getGeneration: (id) => request(`/generations/${id}`),
  patchGeneration: (id, fields) => request(`/generations/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
  deleteGeneration: (id) => request(`/generations/${id}`, { method: 'DELETE' }),
  getConsentStatus: () => request('/consent/status'),
  acceptConsent: (provider = 'email') => request('/consent/accept', { method: 'POST', body: JSON.stringify({ provider }) }),
  getCredits: () => request('/credits'),
  deleteAccount: (confirmation_text, reason) => request('/account/delete', { method: 'POST', body: JSON.stringify({ confirmation_text, reason }) }),
  restoreAccount: () => request('/account/restore', { method: 'POST' }),
  getLLMUsage: () => request('/user/llm-usage'),
  getGenerationCosts: (limit = 30) => request(`/admin/generation-costs?limit=${limit}`),
  // Admin APIs
  getAdminOverview: () => request('/admin/overview'),
  getAdminUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/users${qs ? `?${qs}` : ''}`);
  },
  getAdminActivity: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/activity${qs ? `?${qs}` : ''}`);
  },
  getAdminGenerations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/generations${qs ? `?${qs}` : ''}`);
  },
  getAdminCosts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/costs${qs ? `?${qs}` : ''}`);
  },
  getAdminPaymentWall: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/payment-wall${qs ? `?${qs}` : ''}`);
  },
  getAdminLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/logs${qs ? `?${qs}` : ''}`);
  },
};
