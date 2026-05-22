import request from 'supertest';
import app from '../index.js';
import { getDb, closeDb } from '../db/connection.js';

describe('GET /api/transactions', () => {
  beforeAll(() => {
    process.env.DB_PATH = ':memory:';
    const db = getDb();

    // Setup test data
    db.prepare("INSERT INTO Account (AccountId, Name) VALUES (1, 'Test Bank')").run();
    db.prepare("INSERT INTO Person (PersonId, Name) VALUES (2, 'John Doe')").run();

    db.prepare(
      'INSERT INTO "File" (FileId, Filename, AccountId) VALUES (1, \'test.csv\', 1)',
    ).run();

    const insertTx = db.prepare(`
      INSERT INTO "Transaction" (Hash, Month, DayOfMonth, Description, CategoryId, Amount, AccountId, FileId, PersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTx.run('hash1', '2024-05', 1, 'Groceries', 'food', 50, 1, 1, 2);
    insertTx.run('hash2', '2024-05', 2, 'Salary', 'salary', -1000, 1, 1, 1); // PersonId 1 is Family (seeded)
    insertTx.run('hash3', '2024-06', 15, 'Gas', 'transport', 30, 1, 1, 2);
    insertTx.run('hash4', '2024-06', 16, 'CC Payment', 'payments', 200, 1, 1, 1);
  });

  afterAll(() => {
    closeDb();
  });

  it('should return 400 if count is missing', async () => {
    const response = await request(app).get('/api/transactions');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Count parameter is mandatory' });
  });

  it('should return available months', async () => {
    const response = await request(app).get('/api/transactions/months');
    expect(response.status).toBe(200);
    expect(response.body.months).toEqual(['2024-06', '2024-05']);
  });

  it('should return transactions with pagination and exclude payments from totals', async () => {
    const response = await request(app).get('/api/transactions?count=10&offset=0');
    expect(response.status).toBe(200);

    expect(response.body.totalCount).toBe(4);
    expect(response.body.totalSpent).toBe(80); // 50 + 30, excluding 200
    expect(response.body.totalEarned).toBe(1000);
    expect(response.body.netPayments).toBe(200);
    expect(response.body.data.length).toBe(4);

    // Ordered by month desc, day desc
    expect(response.body.data[0].id).toBe('hash4');
    expect(response.body.data[1].id).toBe('hash3');
    expect(response.body.data[2].id).toBe('hash2');
    expect(response.body.data[3].id).toBe('hash1');

    expect(Object.keys(response.body.persons).length).toBeGreaterThan(0);
    expect(Object.keys(response.body.accounts).length).toBe(1);
    expect(response.body.accounts[1]).toBe('Test Bank');
  });

  it('should filter by month', async () => {
    const response = await request(app).get('/api/transactions?count=10&month=2024-05');
    expect(response.status).toBe(200);

    expect(response.body.totalCount).toBe(2);
    expect(response.body.data.length).toBe(2);
    expect(response.body.data.every((tx: { date: string }) => tx.date.startsWith('2024-05'))).toBe(
      true,
    );
  });

  it('should filter by personId', async () => {
    const response = await request(app).get('/api/transactions?count=10&personId=2');
    expect(response.status).toBe(200);

    expect(response.body.totalCount).toBe(2); // hash1, hash3
    expect(response.body.data.length).toBe(2);
    expect(response.body.data.every((tx: { personId: number }) => tx.personId === 2)).toBe(true);
  });

  it('should sort by amount asc', async () => {
    const response = await request(app).get('/api/transactions?count=10&sort=amount:asc');
    expect(response.status).toBe(200);
    expect(response.body.data[0].amount).toBe(-1000);
    expect(response.body.data[1].amount).toBe(30);
    expect(response.body.data[2].amount).toBe(50);
  });

  it('should sort by person name asc', async () => {
    // Family (1) and John Doe (2). Family should come first
    const response = await request(app).get('/api/transactions?count=10&sort=personId:asc');
    expect(response.status).toBe(200);
    expect(response.body.persons[response.body.data[0].personId]).toBe('Family');
    expect(response.body.persons[response.body.data[1].personId]).toBe('Family');
    expect(response.body.persons[response.body.data[2].personId]).toBe('John Doe');
  });
});
