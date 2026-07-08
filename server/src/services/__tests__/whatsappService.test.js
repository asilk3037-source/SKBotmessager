import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ instances: [], nextInitialize: null }));

vi.mock('whatsapp-web.js', () => {
  // Minimal inline event emitter so this factory has no dependency on top-level imports,
  // which vitest hoists mock factories above (node:events works fine at runtime here too,
  // but this keeps the mock fully self-contained).
  class MockClient {
    constructor(opts) {
      this.opts = opts;
      this.info = { wid: { user: '5511999999999' } };
      this.logout = vi.fn().mockResolvedValue(undefined);
      this.getNumberId = vi.fn();
      this.sendMessage = vi.fn().mockResolvedValue(undefined);
      this._listeners = {};
      state.instances.push(this);
    }

    on(event, handler) {
      this._listeners[event] = handler;
      return this;
    }

    emit(event, ...args) {
      this._listeners[event]?.(...args);
    }

    initialize() {
      return state.nextInitialize ? state.nextInitialize() : Promise.resolve();
    }
  }

  class MockLocalAuth {
    constructor(opts) {
      this.opts = opts;
    }
  }

  return { default: { Client: MockClient, LocalAuth: MockLocalAuth } };
});

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async (qr) => `data:image/png;base64,${qr}`) }
}));

const whatsappService = (await import('../whatsappService.js')).default;

function lastClient() {
  return state.instances[state.instances.length - 1];
}

beforeEach(() => {
  state.instances = [];
  state.nextInitialize = null;
  whatsappService.client = null;
  whatsappService.status = 'disconnected';
  whatsappService.qrDataUrl = null;
  whatsappService.connectedNumber = null;
  whatsappService.error = null;
});

describe('whatsappService.getState', () => {
  it('reflects the current fields', () => {
    expect(whatsappService.getState()).toEqual({
      status: 'disconnected',
      qrDataUrl: null,
      connectedNumber: null,
      error: null
    });
  });
});

describe('whatsappService.init', () => {
  it('moves to "connecting" immediately and is a no-op if already initializing', () => {
    state.nextInitialize = () => new Promise(() => {}); // never resolves
    whatsappService.init();
    expect(whatsappService.status).toBe('connecting');
    expect(state.instances).toHaveLength(1);

    whatsappService.init();
    expect(state.instances).toHaveLength(1); // did not create a second client
  });

  it('turns a "qr" event into a data URL and status "qr"', async () => {
    state.nextInitialize = () => new Promise(() => {});
    whatsappService.init();
    lastClient().emit('qr', 'raw-qr-payload');
    await new Promise((resolve) => setImmediate(resolve));

    expect(whatsappService.status).toBe('qr');
    expect(whatsappService.qrDataUrl).toBe('data:image/png;base64,raw-qr-payload');
  });

  it('turns a "ready" event into status "connected" with the phone number', () => {
    state.nextInitialize = () => new Promise(() => {});
    whatsappService.init();
    lastClient().emit('ready');

    expect(whatsappService.status).toBe('connected');
    expect(whatsappService.connectedNumber).toBe('5511999999999');
    expect(whatsappService.qrDataUrl).toBeNull();
  });

  it('resets to disconnected on a "disconnected" event', () => {
    state.nextInitialize = () => new Promise(() => {});
    whatsappService.init();
    lastClient().emit('ready');
    lastClient().emit('disconnected');

    expect(whatsappService.status).toBe('disconnected');
    expect(whatsappService.connectedNumber).toBeNull();
    expect(whatsappService.client).toBeNull();
  });

  it('catches a rejected initialize() instead of letting it crash the process', async () => {
    state.nextInitialize = () => Promise.reject(new Error('net::ERR_TUNNEL_CONNECTION_FAILED'));
    whatsappService.init();

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(whatsappService.status).toBe('disconnected');
    expect(whatsappService.error).toBe('net::ERR_TUNNEL_CONNECTION_FAILED');
    expect(whatsappService.client).toBeNull();
  });
});

describe('whatsappService.logout', () => {
  it('calls client.logout() and resets state', async () => {
    state.nextInitialize = () => new Promise(() => {});
    whatsappService.init();
    const client = lastClient();

    await whatsappService.logout();

    expect(client.logout).toHaveBeenCalled();
    expect(whatsappService.status).toBe('disconnected');
    expect(whatsappService.client).toBeNull();
  });

  it('is safe to call when there is no active client', async () => {
    await expect(whatsappService.logout()).resolves.toBeUndefined();
    expect(whatsappService.status).toBe('disconnected');
  });
});

describe('whatsappService.sendMessage', () => {
  it('throws when not connected', async () => {
    await expect(whatsappService.sendMessage('11988887777', 'oi')).rejects.toThrow(
      /whatsapp não está conectado/i
    );
  });

  it('throws when the number has no WhatsApp account', async () => {
    state.nextInitialize = () => new Promise(() => {});
    whatsappService.init();
    lastClient().emit('ready');
    lastClient().getNumberId.mockResolvedValue(null);

    await expect(whatsappService.sendMessage('11988887777', 'oi')).rejects.toThrow(
      /não possui whatsapp ativo/i
    );
  });

  it('sends through the underlying client when connected', async () => {
    state.nextInitialize = () => new Promise(() => {});
    whatsappService.init();
    const client = lastClient();
    client.emit('ready');
    client.getNumberId.mockResolvedValue({ _serialized: '5511988887777@c.us' });

    await whatsappService.sendMessage('(11) 98888-7777', 'Ola!');

    expect(client.getNumberId).toHaveBeenCalledWith('11988887777@c.us');
    expect(client.sendMessage).toHaveBeenCalledWith('5511988887777@c.us', 'Ola!');
  });
});
