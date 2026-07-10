import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDb } from './testUtils.js';
import db from '../../db/index.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

describe('POST /api/contacts/preview', () => {
  it('returns 400 when no file is sent', async () => {
    const res = await request(app).post('/api/contacts/preview');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nenhum arquivo/i);
  });

  it('parses an uploaded CSV and returns columns/rows/suggestions', async () => {
    const csv = 'Nome,Telefone,Email\nJoao,11988887777,joao@example.com\n';
    const res = await request(app)
      .post('/api/contacts/preview')
      .attach('file', Buffer.from(csv, 'utf8'), 'contatos.csv');

    expect(res.status).toBe(200);
    expect(res.body.columns).toEqual(['Nome', 'Telefone', 'Email']);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.suggestedNameColumn).toBe('Nome');
    expect(res.body.suggestedPhoneColumn).toBe('Telefone');
    expect(res.body.suggestedEmailColumn).toBe('Email');
  });

  it('rejects a file whose extension is not .xlsx or .csv', async () => {
    const res = await request(app)
      .post('/api/contacts/preview')
      .attach('file', Buffer.from('not a spreadsheet'), 'contatos.pdf');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/apenas arquivos \.xlsx ou \.csv/i);
  });

  it('returns 400 with a clear message when the file cannot be parsed as XLSX', async () => {
    // Starts with the zip signature ("PK") so it's routed to the XLSX parser, but isn't a real
    // XLSX archive, so ExcelJS should throw while loading it.
    const corrupt = Buffer.from([0x50, 0x4b, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff]);
    const res = await request(app)
      .post('/api/contacts/preview')
      .attach('file', corrupt, 'contatos.xlsx');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/não foi possível ler a planilha/i);
  });
});

describe('POST /api/contacts/import', () => {
  const baseRows = [
    { Nome: 'Joao Silva', Telefone: '(11) 98888-7777', Email: 'joao@example.com' },
    { Nome: 'Maria Souza', Telefone: 'abc', Email: 'not-an-email' }
  ];

  it('rejects when there are no rows', async () => {
    const res = await request(app).post('/api/contacts/import').send({
      nameColumn: 'Nome',
      phoneColumn: 'Telefone',
      rows: []
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nenhuma linha/i);
  });

  it('rejects when neither phone nor email column is provided', async () => {
    const res = await request(app).post('/api/contacts/import').send({
      nameColumn: 'Nome',
      rows: baseRows
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/telefone ou email/i);
  });

  it('imports valid rows, normalizes phone/email, and skips invalid ones', async () => {
    const res = await request(app).post('/api/contacts/import').send({
      fileName: 'contatos.csv',
      nameColumn: 'Nome',
      phoneColumn: 'Telefone',
      emailColumn: 'Email',
      extraColumns: ['Nome', 'Telefone', 'Email'],
      rows: baseRows
    });

    expect(res.status).toBe(201);
    expect(res.body.importedCount).toBe(1);
    expect(res.body.skippedCount).toBe(1);
    expect(res.body.skipped[0].reason).toMatch(/inválidos ou vazios/i);

    expect(db.data.contacts).toHaveLength(1);
    expect(db.data.contacts[0]).toMatchObject({
      name: 'Joao Silva',
      phone: '11988887777',
      email: 'joao@example.com'
    });
    expect(db.data.batches).toHaveLength(1);
    expect(db.data.batches[0].importedCount).toBe(1);
    expect(db.data.auditLog).toContainEqual(
      expect.objectContaining({ action: 'contacts.import', entity: 'batch', entityId: db.data.batches[0].id })
    );
  });

  it('imports a contact identified only by email when there is no phone column', async () => {
    const res = await request(app).post('/api/contacts/import').send({
      nameColumn: 'Nome',
      emailColumn: 'Email',
      rows: [{ Nome: 'Ana', Email: 'ana@example.com' }]
    });

    expect(res.status).toBe(201);
    expect(db.data.contacts[0]).toMatchObject({ name: 'Ana', phone: '', email: 'ana@example.com' });
  });

  it('falls back to "(sem nome)" when the name cell is empty', async () => {
    await request(app).post('/api/contacts/import').send({
      nameColumn: 'Nome',
      phoneColumn: 'Telefone',
      rows: [{ Nome: '', Telefone: '11988887777' }]
    });

    expect(db.data.contacts[0].name).toBe('(sem nome)');
  });

  it('keeps extra columns (besides name/phone/email) as contact.extras', async () => {
    await request(app).post('/api/contacts/import').send({
      nameColumn: 'Nome',
      phoneColumn: 'Telefone',
      extraColumns: ['Nome', 'Telefone', 'Cidade'],
      rows: [{ Nome: 'Joao', Telefone: '11988887777', Cidade: 'SP' }]
    });

    expect(db.data.contacts[0].extras).toEqual({ Cidade: 'SP' });
  });
});

describe('GET /api/contacts/batches and DELETE /api/contacts/batches/:id', () => {
  it('lists batches sorted by most recent first', async () => {
    db.data.batches.push(
      { id: 'b1', label: 'Antigo', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'b2', label: 'Recente', createdAt: '2025-01-01T00:00:00.000Z' }
    );

    const res = await request(app).get('/api/contacts/batches');
    expect(res.status).toBe(200);
    expect(res.body.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('deletes a batch and its contacts', async () => {
    db.data.batches.push({ id: 'b1', label: 'Lote', createdAt: new Date().toISOString() });
    db.data.contacts.push(
      { id: 'c1', batchId: 'b1', name: 'A', phone: '111', email: '', extras: {} },
      { id: 'c2', batchId: 'other', name: 'B', phone: '222', email: '', extras: {} }
    );

    const res = await request(app).delete('/api/contacts/batches/b1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ removedContacts: 1 });
    expect(db.data.contacts).toHaveLength(1);
    expect(db.data.contacts[0].id).toBe('c2');
    expect(db.data.batches).toHaveLength(0);
  });
});

describe('GET /api/contacts', () => {
  beforeEach(() => {
    db.data.contacts.push(
      { id: 'c1', batchId: 'b1', name: 'Joao Silva', phone: '11988887777', email: 'joao@example.com', extras: {} },
      { id: 'c2', batchId: 'b2', name: 'Maria Souza', phone: '21977776666', email: 'maria@example.com', extras: {} }
    );
  });

  it('returns all contacts by default', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('filters by batchId', async () => {
    const res = await request(app).get('/api/contacts').query({ batchId: 'b1' });
    expect(res.body.total).toBe(1);
    expect(res.body.contacts[0].id).toBe('c1');
  });

  it('filters by search across name, phone and email', async () => {
    const byName = await request(app).get('/api/contacts').query({ search: 'joao' });
    expect(byName.body.total).toBe(1);

    const byPhone = await request(app).get('/api/contacts').query({ search: '219777' });
    expect(byPhone.body.total).toBe(1);
    expect(byPhone.body.contacts[0].id).toBe('c2');

    const byEmail = await request(app).get('/api/contacts').query({ search: 'maria@example' });
    expect(byEmail.body.total).toBe(1);
    expect(byEmail.body.contacts[0].id).toBe('c2');
  });

  it('paginates results, keeping "total" as the full filtered count', async () => {
    const res = await request(app).get('/api/contacts').query({ pageSize: 1, page: 2 });
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.contacts).toHaveLength(1);
    expect(res.body.contacts[0].id).toBe('c2');
  });

  it('defaults to page 1 with a reasonable page size', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBeGreaterThanOrEqual(2);
    expect(res.body.contacts).toHaveLength(2);
  });
});

describe('DELETE /api/contacts/:id', () => {
  it('deletes an existing contact', async () => {
    db.data.contacts.push({ id: 'c1', batchId: 'b1', name: 'Joao', phone: '111', email: '', extras: {} });
    const res = await request(app).delete('/api/contacts/c1');
    expect(res.status).toBe(204);
    expect(db.data.contacts).toHaveLength(0);
    expect(db.data.auditLog).toContainEqual(
      expect.objectContaining({ action: 'contacts.delete', entity: 'contact', entityId: 'c1' })
    );
  });

  it('returns 404 for a contact that does not exist', async () => {
    const res = await request(app).delete('/api/contacts/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrado/i);
  });
});
