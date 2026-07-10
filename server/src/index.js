import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3001;
// Loopback-only by default: this app has no authentication on any /api
// route, by design, for a single local user. Binding to all interfaces
// would let anyone on the same network read contacts/history and trigger
// campaigns with no credential at all. Only override HOST if you've added
// real auth in front of the API.
const HOST = process.env.HOST || '127.0.0.1';
const app = createApp();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

app.listen(PORT, HOST, () => {
  console.log(`SKBotmessager backend rodando em http://${HOST}:${PORT}`);
}).on('error', (err) => {
  console.error('Falha ao iniciar o servidor:', err.message);
  process.exit(1);
});
