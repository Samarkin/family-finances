import request from 'supertest';
import app from '../index.js';
import { closeDb, getDb } from '../db/connection.js';
import { AccountRow, PersonRow, FileStageRow, TransactionStageRow } from '../db/types.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('POST /api/upload', () => {
  beforeAll(() => {
    process.env.DB_PATH = ':memory:';
  });

  afterAll(() => {
    closeDb();
  });

  it('should upload a CSV and return FileStageId', async () => {
    const csvContent = 'Date,Description,Amount\n2023-01-01,Test Transaction,10.00';
    const filePath = path.join(__dirname, 'test.csv');
    fs.writeFileSync(filePath, csvContent);

    const response = await request(app).post('/api/upload').attach('file', filePath);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('fileStageId');

    const db = getDb();
    const fileStage = db
      .prepare('SELECT * FROM FileStage WHERE FileStageId = ?')
      .get(response.body.fileStageId) as FileStageRow;
    expect(fileStage).toBeDefined();
    expect(fileStage.Filename).toBe('test.csv');

    const transactions = db
      .prepare('SELECT * FROM TransactionStage WHERE FileStageId = ?')
      .all(response.body.fileStageId) as TransactionStageRow[];
    expect(transactions.length).toBe(1);
    expect(transactions[0]).toMatchObject({
      Description: 'Test Transaction',
      Amount: 10, // Normalized amount
    });

    fs.unlinkSync(filePath);
  });

  it('should detect account from filename regex', async () => {
    const db = getDb();
    // Seed an account with a filename regex
    db.prepare('INSERT INTO Account (Name, FilenameRegex) VALUES (?, ?)').run(
      'Visa 1234',
      'visa.*1234',
    );

    const csvContent = 'Date,Description,Amount\n2023-01-01,Test Transaction,10.00';
    const filePath = path.join(__dirname, 'visa_stmt_1234.csv');
    fs.writeFileSync(filePath, csvContent);

    const response = await request(app).post('/api/upload').attach('file', filePath);

    expect(response.status).toBe(200);
    const fileStage = db
      .prepare('SELECT * FROM FileStage WHERE FileStageId = ?')
      .get(response.body.fileStageId) as FileStageRow;

    // Find AccountId for 'Visa 1234'
    const account = db
      .prepare('SELECT AccountId FROM Account WHERE Name = ?')
      .get('Visa 1234') as AccountRow;
    expect(fileStage.AccountId).toBe(account.AccountId);

    fs.unlinkSync(filePath);
  });

  it('should detect person from card member column', async () => {
    const db = getDb();
    // Seed a person with a member regex
    db.prepare('INSERT INTO Person (Name, MemberRegex) VALUES (?, ?)').run('John Doe', 'john.*doe');

    const csvContent =
      'Date,Description,Amount,Card Member\n2023-01-01,Test Transaction,10.00,JOHN DOE';
    const filePath = path.join(__dirname, 'test_person.csv');
    fs.writeFileSync(filePath, csvContent);

    const response = await request(app).post('/api/upload').attach('file', filePath);

    expect(response.status).toBe(200);
    const tx = db
      .prepare('SELECT * FROM TransactionStage WHERE FileStageId = ?')
      .get(response.body.fileStageId) as TransactionStageRow;

    // Find PersonId for 'John Doe'
    const person = db
      .prepare('SELECT PersonId FROM Person WHERE Name = ?')
      .get('John Doe') as PersonRow;
    expect(tx.PersonId).toBe(person.PersonId);

    fs.unlinkSync(filePath);
  });

  it('should return 400 if no file is uploaded', async () => {
    const response = await request(app).post('/api/upload');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No file uploaded');
  });
});
