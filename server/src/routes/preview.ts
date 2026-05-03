import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { FileStageRow, TransactionStageRow } from '../db/types.js';
import { calculateTransactionHash } from '../utils/hash.js';

const router = Router();

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
    const filteredTransactions = transactions
      .map((tx) => {
        const isDuplicate = !!checkDuplicate.get(tx.Hash);
        if (isDuplicate) {
          duplicateCount++;
          return null;
        }

        return {
          id: tx.TransactionStageId,
          date: tx.Date,
          description: tx.Description,
          amount: fileStage.Sign ? -tx.Amount : tx.Amount,
          rawCategory: tx.RawCategory,
          categoryId: tx.CategoryId,
          personId: tx.PersonId,
        };
      })
      .filter((tx) => tx !== null);

    res.json({
      filename: fileStage.Filename,
      transactions: filteredTransactions,
      duplicateCount,
      accountId: fileStage.AccountId,
      sign: !!fileStage.Sign,
    });
  } catch (error) {
    console.error('Preview error:', error);
    res
      .status(500)
      .json({ error: 'Failed to fetch preview data', message: (error as Error).message });
  }
});

router.put('/preview/:id/sign', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  try {
    db.transaction(() => {
      const fileStage = db
        .prepare('SELECT * FROM FileStage WHERE FileStageId = ?')
        .get(id) as FileStageRow;

      if (!fileStage) {
        throw new Error('NOT_FOUND');
      }

      const newSign = fileStage.Sign ? 0 : 1;
      db.prepare('UPDATE FileStage SET Sign = ? WHERE FileStageId = ?').run(newSign, id);

      // Recalculate hashes for all transactions in this file
      const transactions = db
        .prepare('SELECT * FROM TransactionStage WHERE FileStageId = ?')
        .all(id) as TransactionStageRow[];

      const updateHash = db.prepare(
        'UPDATE TransactionStage SET Hash = ? WHERE TransactionStageId = ?',
      );

      for (const tx of transactions) {
        const normalizedAmount = newSign ? -tx.Amount : tx.Amount;
        const hash = calculateTransactionHash(
          tx.Date,
          tx.Description,
          normalizedAmount,
          fileStage.AccountId,
        );
        updateHash.run(hash, tx.TransactionStageId);
      }
    })();

    res.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Staged file not found' });
      return;
    }
    console.error('Sign toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle sign', message: (error as Error).message });
  }
});

router.put('/preview/:id/account', (req: Request, res: Response) => {
  const { id } = req.params;
  const { accountId } = req.body;
  const db = getDb();

  try {
    db.transaction(() => {
      const fileStage = db
        .prepare('SELECT * FROM FileStage WHERE FileStageId = ?')
        .get(id) as FileStageRow;

      if (!fileStage) {
        throw new Error('NOT_FOUND');
      }

      db.prepare('UPDATE FileStage SET AccountId = ? WHERE FileStageId = ?').run(accountId, id);

      // Recalculate hashes for all transactions in this file since AccountId changed
      const transactions = db
        .prepare('SELECT * FROM TransactionStage WHERE FileStageId = ?')
        .all(id) as TransactionStageRow[];

      const updateHash = db.prepare(
        'UPDATE TransactionStage SET Hash = ? WHERE TransactionStageId = ?',
      );

      for (const tx of transactions) {
        const normalizedAmount = fileStage.Sign ? -tx.Amount : tx.Amount;
        const hash = calculateTransactionHash(tx.Date, tx.Description, normalizedAmount, accountId);
        updateHash.run(hash, tx.TransactionStageId);
      }
    })();

    res.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Staged file not found' });
      return;
    }
    console.error('Account update error:', error);
    res.status(500).json({ error: 'Failed to update account', message: (error as Error).message });
  }
});

router.post('/preview/:id/bulk-update', (req: Request, res: Response) => {
  const { id } = req.params;
  const { ids, categoryId, personId } = req.body;
  const db = getDb();

  try {
    db.transaction(() => {
      // Validate that all transactions belong to this fileStage (if IDs provided)
      if (Array.isArray(ids) && ids.length > 0) {
        const checkTx = db.prepare(
          'SELECT 1 FROM TransactionStage WHERE TransactionStageId = ? AND FileStageId = ?',
        );
        for (const txId of ids) {
          if (!checkTx.get(txId, id)) {
            throw new Error('INVALID_TRANSACTION');
          }
        }
      }

      // Update transactions
      let query = 'UPDATE TransactionStage SET ';
      const updates: string[] = [];
      const params: (string | number)[] = [];

      if (categoryId !== undefined) {
        updates.push('CategoryId = ?');
        params.push(categoryId);
      }
      if (personId !== undefined) {
        updates.push('PersonId = ?');
        params.push(personId);
      }

      if (updates.length === 0) return;

      query += updates.join(', ');

      if (Array.isArray(ids) && ids.length > 0) {
        query += ` WHERE TransactionStageId IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      } else {
        // Apply to all transactions in this file
        query += ' WHERE FileStageId = ?';
        params.push(id);
      }

      db.prepare(query).run(...params);
    })();

    res.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'INVALID_TRANSACTION') {
      res.status(400).json({ error: 'One or more transactions do not belong to this file' });
      return;
    }
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update', message: (error as Error).message });
  }
});

export default router;
