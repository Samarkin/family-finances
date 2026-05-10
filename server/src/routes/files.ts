import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

router.get('/files', (_req: Request, res: Response) => {
  const db = getDb();
  try {
    const files = db
      .prepare(
        `
      SELECT 
        f.FileId as id, 
        f.Filename as filename, 
        a.Name as accountName, 
        MIN(t.Month) || ' : ' || MAX(t.Month) as range
      FROM "File" f
      JOIN Account a ON f.AccountId = a.AccountId
      JOIN "Transaction" t ON f.FileId = t.FileId
      GROUP BY f.FileId
    `,
      )
      .all();

    res.json({ data: files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files', message: (error as Error).message });
  }
});

router.get('/preview-files', (_req: Request, res: Response) => {
  const db = getDb();
  try {
    const files = db
      .prepare(
        `
      SELECT 
        fs.FileStageId as id, 
        fs.Filename as filename, 
        a.Name as accountName, 
        MIN(substr(ts.Date, 1, 7)) || ' : ' || MAX(substr(ts.Date, 1, 7)) as range
      FROM FileStage fs
      LEFT JOIN Account a ON fs.AccountId = a.AccountId
      LEFT JOIN TransactionStage ts ON fs.FileStageId = ts.FileStageId
      GROUP BY fs.FileStageId
    `,
      )
      .all();

    res.json({ data: files });
  } catch (error) {
    console.error('Error fetching preview files:', error);
    res
      .status(500)
      .json({ error: 'Failed to fetch preview files', message: (error as Error).message });
  }
});

router.post('/files/:id/delete', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  try {
    const result = db.prepare('DELETE FROM "File" WHERE FileId = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file', message: (error as Error).message });
  }
});

export default router;
