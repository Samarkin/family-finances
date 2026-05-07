import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../index.js';
import { getDb, closeDb } from '../db/connection.js';

describe('POST /api/persons', () => {
  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM TransactionStage').run();
    db.prepare('DELETE FROM "Transaction"').run();
    db.prepare('DELETE FROM Person').run();
  });

  afterAll(() => {
    closeDb();
  });

  it('should create a new person', async () => {
    const response = await request(app).post('/api/persons').send({ name: 'New Person' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      name: 'New Person',
    });

    const db = getDb();
    const person = db
      .prepare('SELECT Name as name FROM Person WHERE PersonId = ?')
      .get(response.body.id);
    expect(person).toEqual({ name: 'New Person' });
  });

  it('should return 400 if name is missing', async () => {
    const response = await request(app).post('/api/persons').send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Person name is required');
  });

  it('should return 409 if person already exists', async () => {
    await request(app).post('/api/persons').send({ name: 'Duplicate Person' });
    const response = await request(app).post('/api/persons').send({ name: 'Duplicate Person' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Person with this name already exists');
  });
});
