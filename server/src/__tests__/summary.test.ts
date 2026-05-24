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
    insertTx.run('h6', '2024-01', 4, 'CC Payment', 'payments', 100, 1, 1, 1); // Should be excluded from totals and category list

    // Month 2: 2024-02 - Total Spent: 200 (food: 200), Total Earned: 0
    insertTx.run('h4', '2024-02', 1, 'Dinner', 'food', 200, 1, 1, 1);

    // Month 3: 2024-03 - Total Spent: 0, Total Earned: 1000 (salary)
    insertTx.run('h5', '2024-03', 1, 'Big Salary', 'salary', -1000, 1, 1, 1);
  });

  afterAll(() => {
    closeDb();
  });

  it('should return aggregated summary data and exclude payments', async () => {
    const response = await request(app).get('/api/summary');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('categories');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('hasPrev', false);

    const foodIdx = response.body.categories.findIndex((c: { id: string }) => c.id === 'food');
    const gasIdx = response.body.categories.findIndex((c: { id: string }) => c.id === 'gas');
    const salaryIdx = response.body.categories.findIndex((c: { id: string }) => c.id === 'salary');
    const paymentsIdx = response.body.categories.findIndex(
      (c: { id: string }) => c.id === 'payments',
    );

    expect(foodIdx).not.toBe(-1);
    expect(gasIdx).not.toBe(-1);
    expect(salaryIdx).not.toBe(-1);
    expect(paymentsIdx).toBe(-1); // Excluded from categories list

    // Verify categories
    const categoryIds = Object.keys(CATEGORIES).filter((id) => id !== 'payments');
    expect(response.body.categories.length).toBe(categoryIds.length);
    expect(response.body.categories[0]).toHaveProperty('id');
    expect(response.body.categories[0]).toHaveProperty('name');
    expect(response.body.categories[0]).toHaveProperty('color');
    expect(response.body.categories[0]).toHaveProperty('isIncome');

    const salaryCat = response.body.categories.find((c: { id: string }) => c.id === 'salary');
    expect(salaryCat.isIncome).toBe(true);
    const foodCat = response.body.categories.find((c: { id: string }) => c.id === 'food');
    expect(foodCat.isIncome).toBe(false);

    // Verify data
    expect(response.body.data.length).toBe(3);

    // Check 2024-01
    const jan = response.body.data.find((d: { month: string }) => d.month === '2024-01');
    expect(jan).toBeDefined();
    expect(jan.spendingCount).toBe(2);
    expect(jan.incomeCount).toBe(1);

    // Verify spendings array order matches categories
    expect(jan.spendings[foodIdx]).toBe(60);
    expect(jan.spendings[gasIdx]).toBe(40);
    expect(jan.spendings[salaryIdx]).toBe(-50);
    expect(jan.spendings.length).toBe(categoryIds.length);

    // Check 2024-02
    const feb = response.body.data.find((d: { month: string }) => d.month === '2024-02');
    expect(feb.spendingCount).toBe(1);
    expect(feb.incomeCount).toBe(0);
    expect(feb.spendings[foodIdx]).toBe(200);
  });

  it('should handle offset and hasPrev', async () => {
    const db = getDb();
    const insertTx = db.prepare(`
      INSERT INTO "Transaction" (Hash, Month, DayOfMonth, Description, CategoryId, Amount, AccountId, FileId, PersonId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Add 10 more months to have 13 total (3 existing + 10 new)
    for (let i = 1; i <= 10; i++) {
      const month = `2023-${String(i).padStart(2, '0')}`;
      insertTx.run(`h_extra_${i}`, month, 1, 'Extra', 'food', 10, 1, 1, 1);
    }

    // Total unique months: 13.
    // ORDER BY Month DESC: 2024-03, 2024-02, 2024-01, 2023-10, 2023-09, 2023-08, 2023-07, 2023-06, 2023-05, 2023-04, 2023-03, 2023-02, 2023-01

    const res1 = await request(app).get('/api/summary');
    expect(res1.body.data.length).toBe(12);
    expect(res1.body.hasPrev).toBe(true);
    expect(res1.body.data[11].month).toBe('2024-03');
    expect(res1.body.data[0].month).toBe('2023-02');

    const res2 = await request(app).get('/api/summary?offset=1');
    expect(res2.body.data.length).toBe(12);
    expect(res2.body.hasPrev).toBe(false); // Only 13 months total, offset 1 gets months 2-13
    expect(res2.body.data[11].month).toBe('2024-02');
    expect(res2.body.data[0].month).toBe('2023-01');
  });

  it('should handle no data gracefully', async () => {
    const db = getDb();
    db.prepare('DELETE FROM "Transaction"').run();

    const response = await request(app).get('/api/summary');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.hasPrev).toBe(false);
  });
});
