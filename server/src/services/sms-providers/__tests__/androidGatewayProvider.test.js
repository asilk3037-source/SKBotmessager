import { describe, it, expect, vi, afterEach } from 'vitest';
import androidGatewayProvider from '../androidGatewayProvider.js';

const CONFIG = { baseUrl: 'http://192.168.0.10:8080', login: 'sms', password: 'secret' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('androidGatewayProvider', () => {
  it('throws when required config is incomplete', async () => {
    await expect(androidGatewayProvider.send('11988887777', 'oi', {})).rejects.toThrow(
      /configuração do android gateway incompleta/i
    );
  });

  it('posts to {baseUrl}/message with Basic Auth and the expected body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-123' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await androidGatewayProvider.send('11988887777', 'oi', CONFIG);

    expect(result).toEqual({ providerMessageId: 'msg-123' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://192.168.0.10:8080/message');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('sms:secret').toString('base64')}`);
    expect(JSON.parse(options.body)).toEqual({
      phoneNumbers: ['11988887777'],
      textMessage: { text: 'oi' }
    });
  });

  it('strips trailing slashes from baseUrl before building the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: '1' }) });
    vi.stubGlobal('fetch', fetchMock);

    await androidGatewayProvider.send('123', 'oi', { ...CONFIG, baseUrl: 'http://phone:8080///' });

    expect(fetchMock.mock.calls[0][0]).toBe('http://phone:8080/message');
  });

  it('raises a clear error when the phone is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

    await expect(androidGatewayProvider.send('123', 'oi', CONFIG)).rejects.toThrow(
      /não foi possível conectar ao celular/i
    );
  });

  it('raises a clear error on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'bad creds' })
    );

    await expect(androidGatewayProvider.send('123', 'oi', CONFIG)).rejects.toThrow(/401/);
  });
});
