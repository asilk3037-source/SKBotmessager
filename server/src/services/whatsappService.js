import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

const { Client, LocalAuth } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', '..', 'data', 'wwebjs-auth');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.status = 'disconnected'; // disconnected | qr | connecting | connected
    this.qrDataUrl = null;
    this.connectedNumber = null;
    this.error = null;
  }

  init() {
    if (this.client) return;

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.client.on('qr', async (qr) => {
      this.status = 'qr';
      this.error = null;
      this.qrDataUrl = await qrcode.toDataURL(qr);
      this.emit('status', this.getState());
    });

    this.client.on('ready', () => {
      this.status = 'connected';
      this.error = null;
      this.qrDataUrl = null;
      this.connectedNumber = this.client.info?.wid?.user ?? null;
      this.emit('status', this.getState());
    });

    this.client.on('authenticated', () => {
      this.status = 'connecting';
      this.emit('status', this.getState());
    });

    this.client.on('disconnected', () => {
      this.status = 'disconnected';
      this.qrDataUrl = null;
      this.connectedNumber = null;
      this.emit('status', this.getState());
      this.client = null;
    });

    this.status = 'connecting';
    this.error = null;

    // client.initialize() rejects instead of emitting an event when the browser fails to
    // launch/navigate (bad network, missing Chromium, etc.) - left uncaught, that crashes
    // the whole Node process, taking down every other feature with it.
    this.client.initialize().catch((err) => {
      this.status = 'disconnected';
      this.error = err.message || String(err);
      this.qrDataUrl = null;
      this.client = null;
      this.emit('status', this.getState());
    });
  }

  async logout() {
    if (this.client) {
      await this.client.logout().catch(() => {});
      this.client = null;
    }
    this.status = 'disconnected';
    this.qrDataUrl = null;
    this.connectedNumber = null;
    this.error = null;
    this.emit('status', this.getState());
  }

  getState() {
    return {
      status: this.status,
      qrDataUrl: this.qrDataUrl,
      connectedNumber: this.connectedNumber,
      error: this.error
    };
  }

  toWhatsAppId(phone) {
    const digits = phone.replace(/\D/g, '');
    return `${digits}@c.us`;
  }

  async sendMessage(phone, text) {
    if (this.status !== 'connected' || !this.client) {
      throw new Error('WhatsApp não está conectado.');
    }
    const chatId = this.toWhatsAppId(phone);
    const numberId = await this.client.getNumberId(chatId);
    if (!numberId) {
      throw new Error('Número não possui WhatsApp ativo.');
    }
    await this.client.sendMessage(numberId._serialized, text);
  }
}

export default new WhatsAppService();
