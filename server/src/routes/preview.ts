import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

interface TransactionStageRow {
  TransactionStageId: number;
  Hash: string;
  Date: string;
  Description: string;
  Amount: number;
  RawCategory: string | null;
  CategoryId: string | null;
  PersonId: number | null;
}

interface FileStageRow {
  FileStageId: number;
  Filename: string;
  Sign: number;
  AccountId: number | null;
}

router.get('/preview/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  try {
    const fileStage = db
      .prepare('SELECT * FROM FileStage WHERE FileStageId = ?')
      .get(id) as FileStageRow;

    if (!fileStage) {
      res.status(404).json({ error: 'Staged file not found' });
      return;
    }

    const transactions = db
      .prepare('SELECT * FROM TransactionStage WHERE FileStageId = ?')
      .all(id) as TransactionStageRow[];

    // Duplicate detection: check if Hash exists in the main Transaction table
    const checkDuplicate = db.prepare('SELECT 1 FROM "Transaction" WHERE Hash = ? LIMIT 1');

    let duplicateCount = 0;
    const enrichedTransactions = transactions.map((tx) => {
      const isDuplicate = !!checkDuplicate.get(tx.Hash);
      if (isDuplicate) duplicateCount++;

      return {
        ...tx,
        Amount: fileStage.Sign ? -tx.Amount : tx.Amount,
        isDuplicate,
      };
    });

    res.json({
      filename: fileStage.Filename,
      transactions: enrichedTransactions,
      duplicateCount,
    });
  } catch (error) {
    console.error('Preview error:', error);
    res
      .status(500)
      .json({ error: 'Failed to fetch preview data', message: (error as Error).message });
  }
});

export default router;
