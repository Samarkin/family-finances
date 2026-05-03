import request from 'supertest';
import app from '../index.js';
import { closeDb, getDb } from '../db/connection.js';

describe('GET /api/preview/:id', () => {
  beforeAll(() => {
    process.env.DB_PATH = ':memory:';
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    const db = getDb();
    // Clean up tables to ensure a fresh state for each test
    // Order matters because of foreign key constraints
    db.prepare('DELETE FROM TransactionStage').run();
    db.prepare('DELETE FROM FileStage').run();
    db.prepare('DELETE FROM "Transaction"').run();
    db.prepare('DELETE FROM "File"').run();
    db.prepare('DELETE FROM Account').run();
    db.prepare("DELETE FROM Person WHERE Name != 'Family'").run();
  });

  it('should return preview data for a valid staged file', async () => {
    const db = getDb();

    // Seed FileStage
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, Sign) VALUES (?, ?)')
      .run('test.csv', 0);

    // Seed TransactionStage
    db.prepare(
      `
      INSERT INTO TransactionStage (Hash, Date, Description, Amount, RawCategory, FileStageId)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run('hash1', '2023-01-01', 'Test Tx 1', 10.5, 'Food', fileStageId);

    const response = await request(app).get(`/api/preview/${fileStageId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      filename: 'test.csv',
      duplicateCount: 0,
      transactions: [
        {
          Hash: 'hash1',
          Date: '2023-01-01',
          Description: 'Test Tx 1',
          Amount: 10.5,
          RawCategory: 'Food',
          isDuplicate: false,
        },
      ],
    });
  });

  it('should correctly identify duplicates', async () => {
    const db = getDb();

    // Seed Person
    const { lastInsertRowid: personId } = db
      .prepare('INSERT INTO Person (Name) VALUES (?)')
      .run('Test Person');

    // Seed Account
    const { lastInsertRowid: accountId } = db
      .prepare('INSERT INTO Account (Name) VALUES (?)')
      .run('Test Account');

    // Seed File
    const { lastInsertRowid: fileId } = db
      .prepare('INSERT INTO "File" (Filename, AccountId) VALUES (?, ?)')
      .run('original.csv', accountId);

    // Seed FileStage
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, Sign) VALUES (?, ?)')
      .run('test_dupes.csv', 0);

    // Seed a transaction in the main table
    db.prepare(
      `
      INSERT INTO "Transaction" (Hash, Month, DayOfMonth, Description, Amount, CategoryId, AccountId, FileId, PersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('duplicate_hash', '2023-01', 1, 'Existing Tx', 50.0, 'misc', accountId, fileId, personId);

    // Seed TransactionStage with one unique and one duplicate
    db.prepare(
      `
      INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run('unique_hash', '2023-01-02', 'Unique Tx', 20.0, fileStageId);

    db.prepare(
      `
      INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run('duplicate_hash', '2023-01-01', 'Existing Tx', 50.0, fileStageId);

    const response = await request(app).get(`/api/preview/${fileStageId}`);

    expect(response.status).toBe(200);
    expect(response.body.duplicateCount).toBe(1);
    expect(response.body.transactions).toHaveLength(2);

    interface TransactionResult {
      Hash: string;
      isDuplicate: boolean;
    }

    const duplicateTx = response.body.transactions.find(
      (tx: TransactionResult) => tx.Hash === 'duplicate_hash',
    );
    const uniqueTx = response.body.transactions.find(
      (tx: TransactionResult) => tx.Hash === 'unique_hash',
    );

    expect(duplicateTx.isDuplicate).toBe(true);
    expect(uniqueTx.isDuplicate).toBe(false);
  });

  it('should invert amount signs if Sign is TRUE in FileStage', async () => {
    const db = getDb();

    // Seed FileStage with Sign = 1 (True)
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, Sign) VALUES (?, ?)')
      .run('inverted.csv', 1);

    // Seed TransactionStage
    db.prepare(
      `
      INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run('hash_inv', '2023-01-01', 'Inverted Tx', 100.0, fileStageId);

    const response = await request(app).get(`/api/preview/${fileStageId}`);

    expect(response.status).toBe(200);
    expect(response.body.transactions[0].Amount).toBe(-100.0);
  });

  it('should return 404 for non-existent staged file', async () => {
    const response = await request(app).get('/api/preview/9999');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Staged file not found');
  });
});
