import request from 'supertest';
import app from '../index.js';
import { closeDb, getDb } from '../db/connection.js';
import { calculateTransactionHash } from '../utils/hash.js';

describe('GET /api/preview/:id', () => {
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
          id: expect.any(Number),
          date: '2023-01-01',
          description: 'Test Tx 1',
          amount: 10.5,
          rawCategory: 'Food',
        },
      ],
      categories: expect.any(Array),
      persons: expect.any(Array),
    });
    expect(response.body.categories.length).toBeGreaterThan(0);
    expect(response.body.persons).toHaveLength(1); // 'Family' is seeded by default
    expect(response.body.persons[0].name).toBe('Family');
    expect(response.body.transactions[0]).not.toHaveProperty('Hash');
    expect(response.body.transactions[0]).not.toHaveProperty('FileStageId');
    expect(response.body.transactions[0]).not.toHaveProperty('isDuplicate');
  });

  it('should correctly identify and filter duplicates', async () => {
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
    expect(response.body.transactions).toHaveLength(1);
    expect(response.body.transactions[0].description).toBe('Unique Tx');
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
    expect(response.body.transactions[0].amount).toBe(-100.0);
  });

  it('should return 404 for non-existent staged file', async () => {
    const response = await request(app).get('/api/preview/9999');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Staged file not found');
  });
});

describe('PUT /api/preview/:id/sign', () => {
  afterAll(() => {
    closeDb();
  });

  it('should toggle sign and keep hashes the same', async () => {
    const db = getDb();
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, Sign) VALUES (?, ?)')
      .run('test.csv', 0);

    const initialHash = calculateTransactionHash('2023-01-01', 'Test', 10.0, null);

    db.prepare(
      `
      INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(initialHash, '2023-01-01', 'Test', 10.0, fileStageId);

    const response = await request(app).put(`/api/preview/${fileStageId}/sign`);
    expect(response.status).toBe(200);

    const fileStage = db
      .prepare('SELECT Sign FROM FileStage WHERE FileStageId = ?')
      .get(fileStageId) as { Sign: number };
    expect(fileStage.Sign).toBe(1);

    const tx = db
      .prepare('SELECT Hash FROM TransactionStage WHERE FileStageId = ?')
      .get(fileStageId) as { Hash: string };
    // Hash should be the same because amount used in hash is absolute
    expect(tx.Hash).toBe(initialHash);
  });
});

describe('PUT /api/preview/:id/account', () => {
  afterAll(() => {
    closeDb();
  });

  it('should update accountId and update hashes', async () => {
    const db = getDb();
    const { lastInsertRowid: accountId } = db
      .prepare('INSERT INTO Account (Name) VALUES (?)')
      .run('New Account');

    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, Sign) VALUES (?, ?)')
      .run('test.csv', 0);

    db.prepare(
      `
      INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run('hash_no_account', '2023-01-01', 'Test', 10.0, fileStageId);

    const response = await request(app)
      .put(`/api/preview/${fileStageId}/account`)
      .send({ accountId });

    expect(response.status).toBe(200);

    const fileStage = db
      .prepare('SELECT AccountId FROM FileStage WHERE FileStageId = ?')
      .get(fileStageId) as { AccountId: number };
    expect(fileStage.AccountId).toBe(Number(accountId));

    const tx = db
      .prepare('SELECT Hash FROM TransactionStage WHERE FileStageId = ?')
      .get(fileStageId) as { Hash: string };
    // Hash should have changed because AccountId is now included
    expect(tx.Hash).not.toBe('hash_no_account');
  });
});

describe('POST /api/preview/:id/bulk-update', () => {
  afterAll(() => {
    closeDb();
  });

  it('should update category and person for selected transactions', async () => {
    const db = getDb();
    const { lastInsertRowid: personId } = db
      .prepare('INSERT INTO Person (Name) VALUES (?)')
      .run('Target Person');

    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename) VALUES (?)')
      .run('test.csv');

    const { lastInsertRowid: tx1Id } = db
      .prepare(
        'INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId) VALUES (?, ?, ?, ?, ?)',
      )
      .run('h1', '2023-01-01', 'T1', 10, fileStageId);

    const { lastInsertRowid: tx2Id } = db
      .prepare(
        'INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId) VALUES (?, ?, ?, ?, ?)',
      )
      .run('h2', '2023-01-02', 'T2', 20, fileStageId);

    const response = await request(app)
      .post(`/api/preview/${fileStageId}/bulk-update`)
      .send({
        ids: [tx1Id, tx2Id],
        categoryId: 'food',
        personId: Number(personId),
      });

    expect(response.status).toBe(200);

    const txs = db
      .prepare('SELECT CategoryId, PersonId FROM TransactionStage WHERE FileStageId = ?')
      .all(fileStageId) as { CategoryId: string; PersonId: number }[];

    expect(txs[0].CategoryId).toBe('food');
    expect(txs[0].PersonId).toBe(Number(personId));
    expect(txs[1].CategoryId).toBe('food');
    expect(txs[1].PersonId).toBe(Number(personId));
  });

  it('should update all transactions in file if ids is missing', async () => {
    const db = getDb();
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename) VALUES (?)')
      .run('test.csv');

    db.prepare(
      'INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId) VALUES (?, ?, ?, ?, ?)',
    ).run('h1', '2023-01-01', 'T1', 10, fileStageId);
    db.prepare(
      'INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId) VALUES (?, ?, ?, ?, ?)',
    ).run('h2', '2023-01-02', 'T2', 20, fileStageId);

    const response = await request(app).post(`/api/preview/${fileStageId}/bulk-update`).send({
      categoryId: 'shopping',
    });

    expect(response.status).toBe(200);

    const txs = db
      .prepare('SELECT CategoryId FROM TransactionStage WHERE FileStageId = ?')
      .all(fileStageId) as { CategoryId: string }[];

    expect(txs).toHaveLength(2);
    expect(txs[0].CategoryId).toBe('shopping');
    expect(txs[1].CategoryId).toBe('shopping');
  });

  it('should return 400 if transaction does not belong to file', async () => {
    const db = getDb();
    const { lastInsertRowid: f1 } = db
      .prepare('INSERT INTO FileStage (Filename) VALUES (?)')
      .run('f1');
    const { lastInsertRowid: f2 } = db
      .prepare('INSERT INTO FileStage (Filename) VALUES (?)')
      .run('f2');

    const { lastInsertRowid: tx1 } = db
      .prepare(
        'INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId) VALUES (?, ?, ?, ?, ?)',
      )
      .run('h1', '2023-01-01', 'T1', 10, f1);

    const response = await request(app)
      .post(`/api/preview/${f2}/bulk-update`)
      .send({
        ids: [tx1],
        categoryId: 'food',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('do not belong to this file');
  });
});

describe('POST /api/preview/:id/submit', () => {
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
    db.prepare("DELETE FROM Person WHERE Name != 'Family'").run();
  });

  it('should successfully submit valid data', async () => {
    const db = getDb();
    const { lastInsertRowid: accountId } = db
      .prepare('INSERT INTO Account (Name) VALUES (?)')
      .run('Test Account');
    const { lastInsertRowid: personId } = db
      .prepare('INSERT INTO Person (Name) VALUES (?)')
      .run('Test Person');

    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, AccountId, Sign) VALUES (?, ?, ?)')
      .run('test.csv', accountId, 0);

    db.prepare(
      `
      INSERT INTO TransactionStage (Hash, Date, Description, Amount, CategoryId, PersonId, FileStageId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('h1', '2023-01-15', 'Test Tx', 100.0, 'food', personId, fileStageId);

    const response = await request(app).post(`/api/preview/${fileStageId}/submit`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify File was created
    const file = db.prepare('SELECT * FROM "File"').get() as {
      Filename: string;
      AccountId: number;
    };
    expect(file.Filename).toBe('test.csv');
    expect(file.AccountId).toBe(Number(accountId));

    // Verify Transaction was created
    const tx = db.prepare('SELECT * FROM "Transaction"').get() as {
      Hash: string;
      Month: string;
      DayOfMonth: number;
      Amount: number;
      CategoryId: string;
      PersonId: number;
    };
    expect(tx.Hash).toBe('h1');
    expect(tx.Month).toBe('2023-01');
    expect(tx.DayOfMonth).toBe(15);
    expect(tx.Amount).toBe(100.0);
    expect(tx.CategoryId).toBe('food');
    expect(tx.PersonId).toBe(Number(personId));

    // Verify FileStage was deleted
    const count = db.prepare('SELECT COUNT(*) as count FROM FileStage').get() as { count: number };
    expect(count.count).toBe(0);
  });

  it('should return 400 if AccountId is missing', async () => {
    const db = getDb();
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename) VALUES (?)')
      .run('test.csv');

    const response = await request(app).post(`/api/preview/${fileStageId}/submit`);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Account must be assigned');
  });

  it('should return 400 if any transaction is missing category or person', async () => {
    const db = getDb();
    const { lastInsertRowid: accountId } = db
      .prepare('INSERT INTO Account (Name) VALUES (?)')
      .run('A');
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, AccountId) VALUES (?, ?)')
      .run('test.csv', accountId);

    db.prepare(
      'INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId) VALUES (?, ?, ?, ?, ?)',
    ).run('h1', '2023-01-01', 'T', 10, fileStageId);

    const response = await request(app).post(`/api/preview/${fileStageId}/submit`);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('category and person assigned');
  });

  it('should skip duplicate transactions and apply sign inversion', async () => {
    const db = getDb();
    const { lastInsertRowid: accountId } = db
      .prepare('INSERT INTO Account (Name) VALUES (?)')
      .run('A');
    const { lastInsertRowid: personId } = db
      .prepare('INSERT INTO Person (Name) VALUES (?)')
      .run('P');

    // Existing transaction
    const { lastInsertRowid: fileId } = db
      .prepare('INSERT INTO "File" (Filename, AccountId) VALUES (?, ?)')
      .run('old.csv', accountId);
    db.prepare(
      `
      INSERT INTO "Transaction" (Hash, Month, DayOfMonth, Description, CategoryId, Amount, AccountId, FileId, PersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run('dupe', '2023-01', 1, 'D', 'food', 10, accountId, fileId, personId);

    // Staged file with one dupe and one new, and Sign=1
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, AccountId, Sign) VALUES (?, ?, ?)')
      .run('test.csv', accountId, 1);

    db.prepare(
      'INSERT INTO TransactionStage (Hash, Date, Description, Amount, CategoryId, PersonId, FileStageId) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('dupe', '2023-01-01', 'D', 10, 'food', personId, fileStageId);
    db.prepare(
      'INSERT INTO TransactionStage (Hash, Date, Description, Amount, CategoryId, PersonId, FileStageId) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('new', '2023-01-02', 'N', 20, 'food', personId, fileStageId);

    const response = await request(app).post(`/api/preview/${fileStageId}/submit`);
    expect(response.status).toBe(200);

    const txs = db.prepare('SELECT Hash, Amount FROM "Transaction" ORDER BY Hash').all() as {
      Hash: string;
      Amount: number;
    }[];
    expect(txs).toHaveLength(2);
    expect(txs[0].Hash).toBe('dupe');
    expect(txs[0].Amount).toBe(10); // Original amount kept
    expect(txs[1].Hash).toBe('new');
    expect(txs[1].Amount).toBe(-20); // Sign inverted
  });
});

describe('POST /api/preview/:id/discard', () => {
  afterAll(() => {
    closeDb();
  });

  it('should successfully discard data', async () => {
    const db = getDb();
    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename) VALUES (?)')
      .run('test.csv');

    db.prepare(
      'INSERT INTO TransactionStage (Hash, Date, Description, Amount, FileStageId) VALUES (?, ?, ?, ?, ?)',
    ).run('h1', '2023-01-01', 'T', 10, fileStageId);

    const response = await request(app).post(`/api/preview/${fileStageId}/discard`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const count = db.prepare('SELECT COUNT(*) as count FROM FileStage').get() as { count: number };
    expect(count.count).toBe(0);

    const txCount = db.prepare('SELECT COUNT(*) as count FROM TransactionStage').get() as {
      count: number;
    };
    expect(txCount.count).toBe(0);
  });

  it('should roll back the transaction if validation fails (e.g., missing person)', async () => {
    const db = getDb();
    const { lastInsertRowid: accountId } = db
      .prepare('INSERT INTO Account (Name) VALUES (?)')
      .run('A');

    const { lastInsertRowid: fileStageId } = db
      .prepare('INSERT INTO FileStage (Filename, AccountId) VALUES (?, ?)')
      .run('test.csv', accountId);

    // This transaction is missing a person, which should trigger an error and rollback
    db.prepare(
      'INSERT INTO TransactionStage (Hash, Date, Description, Amount, CategoryId, FileStageId) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('h1', '2023-01-01', 'T', 10, 'food', fileStageId);

    const response = await request(app).post(`/api/preview/${fileStageId}/submit`);
    expect(response.status).toBe(400);

    // Verify that the File record was NOT created due to rollback
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM "File"').get() as { count: number };
    expect(fileCount.count).toBe(0);

    // Verify that FileStage still exists
    const stageCount = db.prepare('SELECT COUNT(*) as count FROM FileStage').get() as {
      count: number;
    };
    expect(stageCount.count).toBe(1);
  });

  it('should return 404 if file not found', async () => {
    const response = await request(app).post('/api/preview/9999/discard');
    expect(response.status).toBe(404);
  });
});
