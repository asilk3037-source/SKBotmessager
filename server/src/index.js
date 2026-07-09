import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3001;
const app = createApp();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

app.listen(PORT, () => {
  console.log(`SKBotmessager backend rodando em http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Falha ao iniciar o servidor:', err.message);
  process.exit(1);
});
