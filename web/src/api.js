const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: options.body instanceof FormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  // Contacts
  previewSpreadsheet: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/contacts/preview', { method: 'POST', body: form });
  },
  importContacts: (payload) => request('/contacts/import', { method: 'POST', body: JSON.stringify(payload) }),
  listBatches: () => request('/contacts/batches'),
  deleteBatch: (batchId) => request(`/contacts/batches/${batchId}`, { method: 'DELETE' }),
  listContacts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/contacts${qs ? `?${qs}` : ''}`);
  },
  deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),

  // Templates
  listTemplates: () => request('/templates'),
  createTemplate: (payload) => request('/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateTemplate: (id, payload) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),

  // Campaigns
  listCampaigns: () => request('/campaigns'),
  getCampaign: (id) => request(`/campaigns/${id}`),
  createCampaign: (payload) => request('/campaigns', { method: 'POST', body: JSON.stringify(payload) }),

  // Reports
  listMessages: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/messages${qs ? `?${qs}` : ''}`);
  },
  reportSummary: () => request('/reports/summary'),
  exportCsvUrl: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `${BASE}/reports/export.csv${qs ? `?${qs}` : ''}`;
  },

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  // WhatsApp
  getWhatsappStatus: () => request('/whatsapp/status'),
  connectWhatsapp: () => request('/whatsapp/connect', { method: 'POST' }),
  logoutWhatsapp: () => request('/whatsapp/logout', { method: 'POST' }),
};
