import { parentPort, workerData } from 'node:worker_threads';
import { parseSpreadsheet } from './spreadsheetParser.js';

const { buffer, originalName } = workerData;

parseSpreadsheet(Buffer.from(buffer), originalName)
  .then((result) => parentPort.postMessage({ ok: true, result }))
  .catch((err) => parentPort.postMessage({ ok: false, error: err.message }));
