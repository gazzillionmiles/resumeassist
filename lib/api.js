import { useAuthStore } from '@/state/authStore';

async function request(path, options = {}) {
  const token = useAuthStore.getState().token;
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  getProfile: () => request('/profile'),
  saveProfile: (fields) => request('/profile', { method: 'POST', body: JSON.stringify(fields) }),
  uploadResume: (file) => { const form = new FormData(); form.append('resume', file); return request('/profile/resume', { method: 'POST', body: form }); },
  listPlaybook: () => request('/playbook'),
  addPlaybookExample: (exampleText, sourceNote) => request('/playbook', { method: 'POST', body: JSON.stringify({ exampleText, sourceNote }) }),
  deletePlaybookExample: (id) => request(`/playbook/${id}`, { method: 'DELETE' }),
  fetchJD: (payload) => request('/generate/jd', { method: 'POST', body: JSON.stringify(payload) }),
  searchCompanyResearch: (payload) => request('/research/search', { method: 'POST', body: JSON.stringify(payload) }),
  analyzeCompanyResearch: (payload) => request('/research/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  generate: (payload) => request('/generate', { method: 'POST', body: JSON.stringify(payload) }),
  listGenerations: () => request('/generations'),
  getGeneration: (id) => request(`/generations/${id}`),
  patchGeneration: (id, fields) => request(`/generations/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
};
