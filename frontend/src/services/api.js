const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export const authApi = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),
};

export const claimsApi = {
  getAll: (token) => request('/claims', { token }),
  getById: (id, token) => request(`/claims/${id}`, { token }),
  create: (payload, token) => request('/claims', { method: 'POST', body: payload, token }),
  updateStatus: (id, status, token) =>
    request(`/claims/${id}/status`, { method: 'PUT', body: { status }, token }),
  remove: (id, token) => request(`/claims/${id}`, { method: 'DELETE', token }),
};
