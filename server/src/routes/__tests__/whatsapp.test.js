import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const state = vi.hoisted(() => ({ instances: [], nextInitialize: null }));

vi.mock('whatsapp-web.js', () => {
  class MockClient {
    constructor(opts) {
      this.opts = opts;
      this.info = { wid: { user: '5511999999999' } };
      this.logout = vi.fn().mockResolvedValue(undefined);
      this.destroy = vi.fn().mockResolvedValue(undefined);
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

  class MockLocalAuth {}

  return { default: { Client: MockClient, LocalAuth: MockLocalAuth } };
});

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async (qr) => `data:image/png;base64,${qr}`) }
}));

const { createApp } = await import('../../app.js');
const whatsappService = (await import('../../services/whatsappService.js')).default;

const app = createApp();

beforeEach(() => {
  state.instances = [];
  state.nextInitialize = null;
  whatsappService.client = null;
  whatsappService.status = 'disconnected';
  whatsappService.qrDataUrl = null;
  whatsappService.connectedNumber = null;
  whatsappService.error = null;
});

describe('GET /api/whatsapp/status', () => {
  it('returns the current disconnected state', async () => {
    const res = await request(app).get('/api/whatsapp/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'disconnected', qrDataUrl: null, connectedNumber: null, error: null });
  });
});

describe('POST /api/whatsapp/connect', () => {
  it('starts initialization and reports status "connecting"', async () => {
    state.nextInitialize = () => new Promise(() => {});
    const res = await request(app).post('/api/whatsapp/connect');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('connecting');
    expect(state.instances).toHaveLength(1);
  });

  it('does not create a second client on a repeated connect call', async () => {
    state.nextInitialize = () => new Promise(() => {});
    await request(app).post('/api/whatsapp/connect');
    await request(app).post('/api/whatsapp/connect');
    expect(state.instances).toHaveLength(1);
  });
});

describe('POST /api/whatsapp/logout', () => {
  it('resets state to disconnected', async () => {
    state.nextInitialize = () => new Promise(() => {});
    await request(app).post('/api/whatsapp/connect');

    const res = await request(app).post('/api/whatsapp/logout');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('disconnected');
    expect(state.instances[0].logout).toHaveBeenCalled();
  });

  it('is safe to call when nothing is connected', async () => {
    const res = await request(app).post('/api/whatsapp/logout');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('disconnected');
  });
});
