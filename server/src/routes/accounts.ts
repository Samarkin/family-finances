import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

router.get('/accounts', (_req: Request, res: Response) => {
  const db = getDb();

  try {
    const accounts = db.prepare('SELECT AccountId as id, Name as name FROM Account').all() as {
      id: number;
      name: string;
    }[];
    res.json(accounts);
  } catch (error) {
    console.error('Fetch accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts', message: (error as Error).message });
  }
});

router.post('/accounts', (req: Request, res: Response) => {
  const { name } = req.body;
  const db = getDb();

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Account name is required' });
    return;
  }

  try {
    const info = db.prepare('INSERT INTO Account (Name) VALUES (?)').run(name);
    res.status(201).json({ id: info.lastInsertRowid, name });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      res.status(409).json({ error: 'Account with this name already exists' });
      return;
    }
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account', message: (error as Error).message });
  }
});

export default router;
