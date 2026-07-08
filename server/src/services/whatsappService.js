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
      this.qrDataUrl = await qrcode.toDataURL(qr);
      this.emit('status', this.getState());
    });

    this.client.on('ready', () => {
      this.status = 'connected';
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

    this.client.initialize();
    this.status = 'connecting';
  }

  async logout() {
    if (this.client) {
      await this.client.logout().catch(() => {});
      this.client = null;
    }
    this.status = 'disconnected';
    this.qrDataUrl = null;
    this.connectedNumber = null;
    this.emit('status', this.getState());
  }

  getState() {
    return { status: this.status, qrDataUrl: this.qrDataUrl, connectedNumber: this.connectedNumber };
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
