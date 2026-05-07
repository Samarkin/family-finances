import request from 'supertest';
import app from '../index.js';
import { getDb, closeDb } from '../db/connection.js';

describe('GET /api/accounts', () => {
  beforeAll(() => {
    const db = getDb();
    db.prepare('INSERT INTO Account (Name) VALUES (?)').run('Test Bank');
    db.prepare('INSERT INTO Account (Name) VALUES (?)').run('Other Credit Card');
  });

  afterAll(() => {
    closeDb();
  });

  it('should return 200 and the list of accounts', async () => {
    const response = await request(app).get('/api/accounts');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
    expect(response.body).toContainEqual({ id: 1, name: 'Test Bank' });
    expect(response.body).toContainEqual({ id: 2, name: 'Other Credit Card' });
  });
});

describe('POST /api/accounts', () => {
  beforeAll(() => {
    process.env.DB_PATH = ':memory:';
  });

  afterAll(() => {
    closeDb();
  });

  it('should create a new account and return 201', async () => {
    const response = await request(app).post('/api/accounts').send({ name: 'New Bank' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      name: 'New Bank',
    });

    // Verify it was actually created
    const getResponse = await request(app).get('/api/accounts');
    expect(getResponse.body).toContainEqual({ id: response.body.id, name: 'New Bank' });
  });

  it('should return 400 if name is missing', async () => {
    const response = await request(app).post('/api/accounts').send({});
    expect(response.status).toBe(400);
  });

  it('should return 409 if account already exists', async () => {
    await request(app).post('/api/accounts').send({ name: 'Duplicate Bank' });
    const response = await request(app).post('/api/accounts').send({ name: 'Duplicate Bank' });
    expect(response.status).toBe(409);
  });
});
