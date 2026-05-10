import request from 'supertest';
import app from '../index.js';
import { closeDb, getDb } from '../db/connection.js';

describe('Files API', () => {
  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM TransactionStage').run();
    db.prepare('DELETE FROM FileStage').run();
    db.prepare('DELETE FROM "Transaction"').run();
    db.prepare('DELETE FROM "File"').run();
    db.prepare('DELETE FROM Account').run();
  });

  it('GET /api/files should return committed files with account names and ranges', async () => {
    const db = getDb();
    const { lastInsertRowid: accountId } = db
      .prepare('INSERT INTO Account (Name) VALUES (?)')
      .run('Test Account');
    const { PersonId: personId } = db
      .prepare("SELECT PersonId FROM Person WHERE Name = 'Family'")
      .get() as { PersonId: number };

    const { lastInsertRowid: fileId } = db
      .prepare('INSERT INTO "File" (Filename, AccountId) VALUES (?, ?)')
      .run('committed.csv', accountId);

    db.prepare(
      `
      INSERT INTO "Transaction" (Hash, Month, DayOfMonth, Description, CategoryId, Amount, AccountId, FileId, PersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('h1', '2023-01', 1, 'T1', 'food', 10, accountId, fileId, personId);

    db.prepare(
      `
      INSERT INTO "Transaction" (Hash, Month, DayOfMonth, Description, CategoryId, Amount, AccountId, FileId, PersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('h2', '2023-02', 1, 'T2', 'food', 20, accountId, fileId, personId);

    const response = await request(app).get('/api/files');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      filename: 'committed.csv',
      accountName: 'Test Account',
      range: '2023-01 : 2023-02',
    });
  });

  it('GET /api/preview-files should return staged files', async () => {
    const db = getDb();
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, AccountId) VALUES (?, ?)')
      .run('staged.csv', null);

    db.prepare(
      `
      INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run('h1', '2023-03-01', 'T1', 10, fileStageId);

    const response = await request(app).get('/api/preview-files');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      filename: 'staged.csv',
      accountName: null,
      range: '2023-03 : 2023-03',
    });
  });

  it('POST /api/files/:id/delete should delete file and its transactions', async () => {
    const db = getDb();
    const { lastInsertRowid: accountId } = db
      .prepare('INSERT INTO Account (Name) VALUES (?)')
      .run('Test Account');
    const { PersonId: personId } = db
      .prepare("SELECT PersonId FROM Person WHERE Name = 'Family'")
      .get() as { PersonId: number };

    const { lastInsertRowid: fileId } = db
      .prepare('INSERT INTO "File" (Filename, AccountId) VALUES (?, ?)')
      .run('to_delete.csv', accountId);

    db.prepare(
      `
      INSERT INTO "Transaction" (Hash, Month, DayOfMonth, Description, CategoryId, Amount, AccountId, FileId, PersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('h1', '2023-01', 1, 'T1', 'food', 10, accountId, fileId, personId);

    const response = await request(app).post(`/api/files/${fileId}/delete`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const fileCount = db.prepare('SELECT COUNT(*) as count FROM "File"').get() as { count: number };
    expect(fileCount.count).toBe(0);

    const txCount = db.prepare('SELECT COUNT(*) as count FROM "Transaction"').get() as {
      count: number;
    };
    expect(txCount.count).toBe(0);
  });

  it('POST /api/files/:id/delete should return 404 if file not found', async () => {
    const response = await request(app).post('/api/files/9999/delete');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('File not found');
  });
});
