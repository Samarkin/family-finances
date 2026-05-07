import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

router.post('/persons', (req: Request, res: Response) => {
  const { name } = req.body;
  const db = getDb();

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Person name is required' });
    return;
  }

  try {
    const info = db.prepare('INSERT INTO Person (Name) VALUES (?)').run(name);
    res.status(201).json({ id: info.lastInsertRowid, name });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      res.status(409).json({ error: 'Person with this name already exists' });
      return;
    }
    console.error('Create person error:', error);
    res.status(500).json({ error: 'Failed to create person', message: (error as Error).message });
  }
});

export default router;
