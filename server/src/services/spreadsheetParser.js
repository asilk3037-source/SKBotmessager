import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const WORKER_PATH = fileURLToPath(new URL('./spreadsheetParser.worker.js', import.meta.url));

// Parsing runs synchronously on the event loop; an unbounded row count would
// block every other request (including the WhatsApp client) for as long as
// the parse takes.
const MAX_ROWS = 50000;

const PHONE_HEADER_HINTS = ['telefone', 'celular', 'phone', 'whatsapp', 'numero', 'número', 'fone', 'contato'];
const NAME_HEADER_HINTS = ['nome', 'name', 'cliente'];
const EMAIL_HEADER_HINTS = ['email', 'e-mail'];

function normalizeHeader(header) {
  return String(header ?? '').trim().toLowerCase();
}

// Keeps only digits and a leading + sign, so "(11) 98888-7777" becomes "11988887777"
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw) {
  const str = String(raw ?? '').trim().toLowerCase();
  return EMAIL_RE.test(str) ? str : '';
}

const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function isCsv(originalName, buffer) {
  if (originalName?.toLowerCase().endsWith('.csv')) return true;
  if (OLE2_MAGIC.every((b, i) => buffer[i] === b)) {
    throw new Error('Formato .xls antigo não suportado. Converta para .xlsx ou .csv.');
  }
  // xlsx files are zip archives and start with "PK"; treat anything else as text/csv
  return !(buffer[0] === 0x50 && buffer[1] === 0x4b);
}

// Note: workbook.xlsx.load() decompresses and fully parses the whole
// archive into memory before this function ever sees a single row, so
// bailing out of eachRow() below only bounds the cost of *our own*
// row-mapping, not ExcelJS's internal parse - a highly compressible
// "zip bomb" .xlsx would already have paid that cost by the time we get
// here. Closing that gap fully would mean switching to ExcelJS's streaming
// reader (ExcelJS.stream.xlsx.WorkbookReader), which is a larger rewrite
// of this function; out of scope for this pass. The multer fileFilter in
// contacts.js at least rejects non-.xlsx/.csv uploads before any of this
// runs.
async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { columns: [], rows: [] };

  const rows = [];
  let columns = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rows.length > MAX_ROWS) return;

    const values = row.values.slice(1).map((v) => {
      if (v && typeof v === 'object' && 'text' in v) return v.text;
      if (v && typeof v === 'object' && v.result !== undefined) return v.result;
      return v ?? '';
    });

    if (rowNumber === 1) {
      columns = values.map((v) => String(v).trim());
      return;
    }

    const rowObj = {};
    columns.forEach((col, idx) => {
      rowObj[col] = values[idx] ?? '';
    });
    rows.push(rowObj);
  });

  return { columns, rows };
}

function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8');
  const records = parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });
  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  return { columns, rows: records };
}

export async function parseSpreadsheet(buffer, originalName) {
  const { columns, rows } = isCsv(originalName, buffer)
    ? parseCsvBuffer(buffer)
    : await parseXlsx(buffer);

  if (rows.length > MAX_ROWS) {
    throw new Error(`Planilha excede o limite de ${MAX_ROWS.toLocaleString('pt-BR')} linhas.`);
  }

  if (rows.length === 0) {
    return {
      fileName: originalName,
      columns: [],
      rows: [],
      suggestedNameColumn: null,
      suggestedPhoneColumn: null,
      suggestedEmailColumn: null
    };
  }

  const suggestedPhoneColumn = columns.find((col) =>
    PHONE_HEADER_HINTS.some((hint) => normalizeHeader(col).includes(hint))
  ) ?? null;

  const suggestedNameColumn = columns.find((col) =>
    NAME_HEADER_HINTS.some((hint) => normalizeHeader(col).includes(hint))
  ) ?? null;

  const suggestedEmailColumn = columns.find((col) =>
    EMAIL_HEADER_HINTS.some((hint) => normalizeHeader(col).includes(hint))
  ) ?? null;

  return {
    fileName: originalName,
    columns,
    rows,
    suggestedNameColumn,
    suggestedPhoneColumn,
    suggestedEmailColumn
  };
}

// Runs parseSpreadsheet() on a worker thread instead of the main event loop.
// A large/highly-compressible upload can spend hundreds of milliseconds to
// seconds inside ExcelJS's synchronous decompress+parse; running it here
// keeps that off the thread serving every other request (including the
// WhatsApp client's own event loop use).
export function parseSpreadsheetInWorker(buffer, originalName) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: { buffer, originalName }
    });
    worker.once('message', (msg) => {
      worker.terminate();
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error));
    });
    worker.once('error', (err) => {
      worker.terminate();
      reject(err);
    });
  });
}
