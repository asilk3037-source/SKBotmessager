import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';

const PHONE_HEADER_HINTS = ['telefone', 'celular', 'phone', 'whatsapp', 'numero', 'número', 'fone', 'contato'];
const NAME_HEADER_HINTS = ['nome', 'name', 'cliente'];

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

function isCsv(originalName, buffer) {
  if (originalName?.toLowerCase().endsWith('.csv')) return true;
  // xlsx files are zip archives and start with "PK"; treat anything else as text/csv
  return !(buffer[0] === 0x50 && buffer[1] === 0x4b);
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { columns: [], rows: [] };

  const rows = [];
  let columns = [];

  worksheet.eachRow((row, rowNumber) => {
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

  if (rows.length === 0) {
    return { fileName: originalName, columns: [], rows: [], suggestedNameColumn: null, suggestedPhoneColumn: null };
  }

  const suggestedPhoneColumn = columns.find((col) =>
    PHONE_HEADER_HINTS.some((hint) => normalizeHeader(col).includes(hint))
  ) ?? null;

  const suggestedNameColumn = columns.find((col) =>
    NAME_HEADER_HINTS.some((hint) => normalizeHeader(col).includes(hint))
  ) ?? null;

  return {
    fileName: originalName,
    columns,
    rows,
    suggestedNameColumn,
    suggestedPhoneColumn
  };
}
