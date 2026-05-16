import request from 'supertest';
import app from '../index.js';
import { closeDb, getDb } from '../db/connection.js';
import { CATEGORIES } from '../constants/categories.js';

describe('GET /api/summary', () => {
  beforeAll(() => {
    const db = getDb();

    // Setup test data
    db.prepare('DELETE FROM "Transaction"').run();
    db.prepare('DELETE FROM "File"').run();
    db.prepare('DELETE FROM Account').run();
    db.prepare('DELETE FROM Person').run();

    db.prepare("INSERT INTO Person (PersonId, Name) VALUES (1, 'Family')").run();
    db.prepare("INSERT INTO Account (AccountId, Name) VALUES (1, 'Test Account')").run();
    db.prepare("INSERT INTO 'File' (FileId, Filename, AccountId) VALUES (1, 'test.csv', 1)").run();

    const insertTx = db.prepare(`
      INSERT INTO "Transaction" (Hash, Month, DayOfMonth, Description, CategoryId, Amount, AccountId, FileId, PersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Month 1: 2024-01 - Total Spent: 100 (food: 60, gas: 40), Total Earned: 50 (salary)
    insertTx.run('h1', '2024-01', 1, 'Salary', 'salary', -50, 1, 1, 1);
    insertTx.run('h2', '2024-01', 2, 'Lunch', 'food', 60, 1, 1, 1);
    insertTx.run('h3', '2024-01', 3, 'Gas', 'gas', 40, 1, 1, 1);

    // Month 2: 2024-02 - Total Spent: 200 (food: 200), Total Earned: 0
    insertTx.run('h4', '2024-02', 1, 'Dinner', 'food', 200, 1, 1, 1);

    // Month 3: 2024-03 - Total Spent: 0, Total Earned: 1000 (salary)
    insertTx.run('h5', '2024-03', 1, 'Big Salary', 'salary', -1000, 1, 1, 1);
  });

  afterAll(() => {
    closeDb();
  });

  it('should return aggregated summary data', async () => {
    const response = await request(app).get('/api/summary');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('categories');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('allTimeSpendings');
    expect(response.body).toHaveProperty('totalSpent');
    expect(response.body).toHaveProperty('totalEarned');
    expect(response.body).toHaveProperty('transactionCount');

    // Verify allTimeSpendings
    const foodIdx = response.body.categories.findIndex((c: { id: string }) => c.id === 'food');
    const gasIdx = response.body.categories.findIndex((c: { id: string }) => c.id === 'gas');
    const salaryIdx = response.body.categories.findIndex((c: { id: string }) => c.id === 'salary');
    expect(response.body.allTimeSpendings[foodIdx]).toBe(260);
    expect(response.body.allTimeSpendings[gasIdx]).toBe(40);
    expect(response.body.allTimeSpendings[salaryIdx]).toBe(-1050);

    // Verify categories
    const categoryIds = Object.keys(CATEGORIES);
    expect(response.body.categories.length).toBe(categoryIds.length);
    expect(response.body.categories[0]).toHaveProperty('id');
    expect(response.body.categories[0]).toHaveProperty('name');
    expect(response.body.categories[0]).toHaveProperty('color');

    // Verify data
    expect(response.body.data.length).toBe(3);

    // Check 2024-01
    const jan = response.body.data.find((d: { month: string }) => d.month === '2024-01');
    expect(jan).toBeDefined();
    expect(jan.totalSpent).toBe(100);
    expect(jan.totalEarned).toBe(50);
    expect(jan.transactionCount).toBe(3);

    // Verify spendings array order matches categories
    expect(jan.spendings[foodIdx]).toBe(60);
    expect(jan.spendings[gasIdx]).toBe(40);
    expect(jan.spendings[salaryIdx]).toBe(-50);

    // Check 2024-02
    const feb = response.body.data.find((d: { month: string }) => d.month === '2024-02');
    expect(feb.totalSpent).toBe(200);
    expect(feb.totalEarned).toBe(0);
    expect(feb.transactionCount).toBe(1);
    expect(feb.spendings[foodIdx]).toBe(200);

    // Global totals
    expect(response.body.totalSpent).toBe(300);
    expect(response.body.totalEarned).toBe(1050);
    expect(response.body.transactionCount).toBe(5);
  });

  it('should handle no data gracefully', async () => {
    const db = getDb();
    db.prepare('DELETE FROM "Transaction"').run();

    const response = await request(app).get('/api/summary');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.totalSpent).toBe(0);
    expect(response.body.totalEarned).toBe(0);
    expect(response.body.transactionCount).toBe(0);
  });
});
