import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { normalizePhone, normalizeEmail, parseSpreadsheet } from '../spreadsheetParser.js';

describe('normalizePhone', () => {
  it('strips formatting characters', () => {
    expect(normalizePhone('(11) 98888-7777')).toBe('11988887777');
  });

  it('keeps a leading plus sign', () => {
    expect(normalizePhone('+55 11 98888-7777')).toBe('+5511988887777');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });

  it('returns empty string when there are no digits', () => {
    expect(normalizePhone('abc')).toBe('');
  });

  it('coerces numbers to strings', () => {
    expect(normalizePhone(11988887777)).toBe('11988887777');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims a valid email', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
  });

  it('rejects strings without an @', () => {
    expect(normalizeEmail('not-an-email')).toBe('');
  });

  it('rejects strings without a domain dot', () => {
    expect(normalizeEmail('ana@example')).toBe('');
  });

  it('rejects empty/null/undefined', () => {
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('parseSpreadsheet - CSV', () => {
  it('parses columns and rows from a CSV buffer', async () => {
    const csv = 'Nome,Telefone,Email\nJoao,11988887777,joao@example.com\nMaria,21977776666,maria@example.com\n';
    const result = await parseSpreadsheet(Buffer.from(csv, 'utf8'), 'contatos.csv');

    expect(result.columns).toEqual(['Nome', 'Telefone', 'Email']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ Nome: 'Joao', Telefone: '11988887777', Email: 'joao@example.com' });
    expect(result.suggestedNameColumn).toBe('Nome');
    expect(result.suggestedPhoneColumn).toBe('Telefone');
    expect(result.suggestedEmailColumn).toBe('Email');
  });

  it('strips a UTF-8 BOM if present', async () => {
    const csv = '﻿Nome,Telefone\nJoao,11988887777\n';
    const result = await parseSpreadsheet(Buffer.from(csv, 'utf8'), 'contatos.csv');
    expect(result.columns).toEqual(['Nome', 'Telefone']);
  });

  it('suggests columns case-insensitively and by partial match', async () => {
    const csv = 'NOME COMPLETO,CELULAR\nJoao,11988887777\n';
    const result = await parseSpreadsheet(Buffer.from(csv, 'utf8'), 'c.csv');
    expect(result.suggestedNameColumn).toBe('NOME COMPLETO');
    expect(result.suggestedPhoneColumn).toBe('CELULAR');
  });

  it('returns nulls for suggested columns when nothing matches', async () => {
    const csv = 'A,B\n1,2\n';
    const result = await parseSpreadsheet(Buffer.from(csv, 'utf8'), 'c.csv');
    expect(result.suggestedNameColumn).toBeNull();
    expect(result.suggestedPhoneColumn).toBeNull();
    expect(result.suggestedEmailColumn).toBeNull();
  });

  it('returns an empty result for a header-only CSV', async () => {
    const csv = 'Nome,Telefone\n';
    const result = await parseSpreadsheet(Buffer.from(csv, 'utf8'), 'c.csv');
    expect(result.rows).toEqual([]);
    expect(result.columns).toEqual([]);
    expect(result.suggestedNameColumn).toBeNull();
  });

  it('treats a buffer without a filename as CSV when it is not a zip', async () => {
    const csv = 'Nome,Telefone\nJoao,11988887777\n';
    const result = await parseSpreadsheet(Buffer.from(csv, 'utf8'), undefined);
    expect(result.rows).toHaveLength(1);
  });

  it('rejects a legacy binary .xls file with a clear error instead of parsing it as garbled CSV', async () => {
    const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    await expect(parseSpreadsheet(buffer, 'planilha.xls')).rejects.toThrow(/\.xls antigo não suportado/i);
  });

  it('rejects a spreadsheet with more rows than the configured limit', async () => {
    const rows = Array.from({ length: 50001 }, (_, i) => `Joao ${i},1198888${String(i).padStart(4, '0')}`);
    const csv = `Nome,Telefone\n${rows.join('\n')}\n`;
    await expect(parseSpreadsheet(Buffer.from(csv, 'utf8'), 'c.csv')).rejects.toThrow(/excede o limite/i);
  });
});

describe('parseSpreadsheet - XLSX', () => {
  async function buildXlsxBuffer(rows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Contatos');
    sheet.addRows(rows);
    return workbook.xlsx.writeBuffer();
  }

  it('parses columns and rows from an XLSX buffer', async () => {
    const buffer = await buildXlsxBuffer([
      ['Nome', 'Telefone'],
      ['Joao', '11988887777'],
      ['Maria', '21977776666']
    ]);

    const result = await parseSpreadsheet(buffer, 'contatos.xlsx');
    expect(result.columns).toEqual(['Nome', 'Telefone']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ Nome: 'Joao', Telefone: '11988887777' });
    expect(result.suggestedNameColumn).toBe('Nome');
    expect(result.suggestedPhoneColumn).toBe('Telefone');
  });

  it('is detected by content (zip signature) even without a .xlsx extension', async () => {
    const buffer = await buildXlsxBuffer([['Nome'], ['Joao']]);
    const result = await parseSpreadsheet(buffer, 'upload');
    expect(result.columns).toEqual(['Nome']);
  });
});
