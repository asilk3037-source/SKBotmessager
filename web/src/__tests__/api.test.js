import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api.js';

function jsonResponse(body, { status = 200, ok = status < 400, headers = { 'content-type': 'application/json' } } = {}) {
  return {
    ok,
    status,
    headers: { get: (key) => headers[key.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request() error handling (via any api.* call)', () => {
  it('throws the server-provided error message on a non-ok response', async () => {
    fetch.mockResolvedValue(jsonResponse({ error: 'Nome e conteúdo são obrigatórios.' }, { status: 400 }));
    await expect(api.listTemplates()).rejects.toThrow('Nome e conteúdo são obrigatórios.');
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => {
        throw new Error('not json');
      }
    });
    await expect(api.listTemplates()).rejects.toThrow('Erro 500');
  });

  it('returns null for a 204 No Content response', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204, headers: { get: () => null } });
    await expect(api.deleteContact('c1')).resolves.toBeNull();
  });

  it('returns text for a non-JSON successful response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (key) => (key === 'content-type' ? 'text/csv' : null) },
      text: async () => 'a,b,c'
    });
    const result = await api.listTemplates();
    expect(result).toBe('a,b,c');
  });

  it('returns parsed JSON for a successful JSON response', async () => {
    fetch.mockResolvedValue(jsonResponse([{ id: 't1' }]));
    await expect(api.listTemplates()).resolves.toEqual([{ id: 't1' }]);
  });
});

describe('request() headers', () => {
  it('sends application/json content-type for plain object/JSON bodies', async () => {
    fetch.mockResolvedValue(jsonResponse({ id: 't1' }, { status: 201 }));
    await api.createTemplate({ name: 'T', content: 'C' });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe(JSON.stringify({ name: 'T', content: 'C' }));
    expect(options.method).toBe('POST');
  });

  it('does not force a Content-Type header for FormData bodies (lets the browser set the boundary)', async () => {
    fetch.mockResolvedValue(jsonResponse({ columns: [] }));
    const file = new File(['a,b'], 'c.csv');
    await api.previewSpreadsheet(file);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/contacts/preview');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
  });
});

describe('api.* URL/method construction', () => {
  beforeEach(() => {
    fetch.mockResolvedValue(jsonResponse({}));
  });

  it('listContacts builds a query string only when params are given', async () => {
    await api.listContacts();
    expect(fetch.mock.calls[0][0]).toBe('/api/contacts');

    await api.listContacts({ batchId: 'b1', search: 'joao' });
    expect(fetch.mock.calls[1][0]).toBe('/api/contacts?batchId=b1&search=joao');
  });

  it('deleteBatch issues a DELETE to the right batch URL', async () => {
    await api.deleteBatch('b1');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/contacts/batches/b1');
    expect(options.method).toBe('DELETE');
  });

  it('updateTemplate issues a PUT with the payload', async () => {
    await api.updateTemplate('t1', { name: 'New' });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/templates/t1');
    expect(options.method).toBe('PUT');
    expect(options.body).toBe(JSON.stringify({ name: 'New' }));
  });

  it('getCampaign fetches a single campaign by id', async () => {
    await api.getCampaign('c1');
    expect(fetch.mock.calls[0][0]).toBe('/api/campaigns/c1');
  });

  it('reportDashboard fetches the dashboard aggregation endpoint', async () => {
    await api.reportDashboard();
    expect(fetch.mock.calls[0][0]).toBe('/api/reports/dashboard');
  });

  it('createCampaign posts to /campaigns', async () => {
    await api.createCampaign({ name: 'X' });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/campaigns');
    expect(options.method).toBe('POST');
  });

  it('connectWhatsapp and logoutWhatsapp POST to the right endpoints', async () => {
    await api.connectWhatsapp();
    expect(fetch.mock.calls[0]).toEqual(['/api/whatsapp/connect', expect.objectContaining({ method: 'POST' })]);

    await api.logoutWhatsapp();
    expect(fetch.mock.calls[1]).toEqual(['/api/whatsapp/logout', expect.objectContaining({ method: 'POST' })]);
  });

  it('updateSettings PUTs the payload', async () => {
    await api.updateSettings({ delayBetweenMessagesMs: 1000 });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/settings');
    expect(options.method).toBe('PUT');
  });
});

describe('exportCsvUrl (no network call)', () => {
  it('builds the CSV export URL without filters', () => {
    expect(api.exportCsvUrl()).toBe('/api/reports/export.csv');
  });

  it('builds the CSV export URL with filters as query params', () => {
    expect(api.exportCsvUrl({ channel: 'sms', status: 'sent' })).toBe(
      '/api/reports/export.csv?channel=sms&status=sent'
    );
  });
});
