import request from 'supertest';
import app from '../index.js';
import { closeDb } from '../db/connection.js';

describe('GET /api/status', () => {
  afterAll(() => {
    closeDb();
  });

  it('should return 200 and db memory status', async () => {
    const response = await request(app).get('/api/status');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      db: 'memory',
    });
  });
});
