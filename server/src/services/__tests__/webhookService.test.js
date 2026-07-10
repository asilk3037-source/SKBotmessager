import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const db = (await import('../../db/index.js')).default;
const { sendWebhookEvent, sendTestWebhook } = await import('../webhookService.js');

beforeEach(() => {
  db.data.settings.webhookUrl = '';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendWebhookEvent', () => {
  it('does nothing when no webhookUrl is configured', async () => {
    const result = await sendWebhookEvent('campaign.completed', { id: 'c1' });
    expect(result).toEqual({ sent: false, reason: 'not_configured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('POSTs a JSON payload with the event name, timestamp and data to the configured URL', async () => {
    db.data.settings.webhookUrl = 'https://example.com/hook';
    fetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await sendWebhookEvent('campaign.completed', { id: 'c1', sentCount: 5 });

    expect(result).toEqual({ sent: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.event).toBe('campaign.completed');
    expect(body.data).toEqual({ id: 'c1', sentCount: 5 });
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('reports a failed delivery without throwing when the endpoint returns a non-2xx status', async () => {
    db.data.settings.webhookUrl = 'https://example.com/hook';
    fetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await sendWebhookEvent('campaign.failed', {});
    expect(result).toEqual({ sent: false, reason: 'http_error', status: 500 });
  });

  it('reports a network error without throwing when fetch rejects', async () => {
    db.data.settings.webhookUrl = 'https://example.com/hook';
    fetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await sendWebhookEvent('campaign.completed', {});
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('network_error');
    expect(result.error).toMatch(/ECONNREFUSED/);
  });
});

describe('sendTestWebhook', () => {
  it('POSTs a "test" event to the given URL regardless of stored settings', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await sendTestWebhook('https://example.com/other-hook');

    expect(result).toEqual({ sent: true });
    expect(fetch).toHaveBeenCalledWith('https://example.com/other-hook', expect.anything());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.event).toBe('test');
  });
});
