import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { FileStageRow, TransactionStageRow } from '../db/types.js';
import { calculateTransactionHash } from '../utils/hash.js';
import { CATEGORY_NAMES } from '../constants/categories.js';

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
          comment: tx.Comment,
        };
      })
      .filter((tx) => tx !== null);

    const personsRows = db.prepare('SELECT PersonId as id, Name as name FROM Person').all() as {
      id: number;
      name: string;
    }[];
    const persons: Record<number, string> = {};
    personsRows.forEach((r) => (persons[r.id] = r.name));

    res.json({
      filename: fileStage.Filename,
      transactions: filteredTransactions,
      duplicateCount,
      accountId: fileStage.AccountId,
      sign: !!fileStage.Sign,
      persons,
      categories: CATEGORY_NAMES,
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
    const result = db
      .prepare(
        'UPDATE FileStage SET Sign = (CASE WHEN Sign = 0 THEN 1 ELSE 0 END) WHERE FileStageId = ?',
      )
      .run(id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Staged file not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
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
        // Hash uses absolute value of amount, so we don't need to check fileStage.Sign
        const hash = calculateTransactionHash(tx.Date, tx.Description, tx.Amount, accountId);
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
  const { ids, categoryId, personId, comment } = req.body;
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
      const params: (string | number | null)[] = [];

      if (categoryId !== undefined) {
        updates.push('CategoryId = ?');
        params.push(categoryId);
      }
      if (personId !== undefined) {
        updates.push('PersonId = ?');
        params.push(personId);
      }
      if (comment !== undefined) {
        updates.push('Comment = ?');
        params.push(comment);
      }

      if (updates.length === 0) return;

      query += updates.join(', ');

      if (Array.isArray(ids) && ids.length > 0) {
        query += ` WHERE TransactionStageId IN (${ids.map(() => '?').join(',')})`;
        params.push(...(ids as (string | number | null)[]));
      } else {
        // Apply to all transactions in this file
        query += ' WHERE FileStageId = ?';
        params.push(id as string);
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

router.post('/preview/:id/apply-comments', (req: Request, res: Response) => {
  const { id } = req.params;
  const { comments } = req.body;
  const db = getDb();

  if (!Array.isArray(comments)) {
    res.status(400).json({ error: 'comments must be an array of { id, comment }' });
    return;
  }

  try {
    db.transaction(() => {
      const checkTx = db.prepare(
        'SELECT 1 FROM TransactionStage WHERE TransactionStageId = ? AND FileStageId = ?',
      );
      // Append to any existing comment, separated by a newline.
      const appendComment = db.prepare(
        `UPDATE TransactionStage
         SET Comment = CASE
           WHEN Comment IS NULL OR Comment = '' THEN ?
           ELSE Comment || char(10) || ?
         END
         WHERE TransactionStageId = ?`,
      );

      for (const entry of comments) {
        const txId = entry?.id;
        const text = entry?.comment;
        if (txId === undefined || typeof text !== 'string' || text === '') continue;
        if (!checkTx.get(txId, id)) {
          throw new Error('INVALID_TRANSACTION');
        }
        appendComment.run(text, text, txId);
      }
    })();

    res.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'INVALID_TRANSACTION') {
      res.status(400).json({ error: 'One or more transactions do not belong to this file' });
      return;
    }
    console.error('Apply comments error:', error);
    res.status(500).json({ error: 'Failed to apply comments', message: (error as Error).message });
  }
});

router.post('/preview/:id/submit', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  try {
    db.prepare('BEGIN TRANSACTION').run();

    const fileStage = db
      .prepare('SELECT * FROM FileStage WHERE FileStageId = ?')
      .get(id) as FileStageRow;

    if (!fileStage) {
      throw new Error('NOT_FOUND');
    }

    if (fileStage.AccountId === null) {
      throw new Error('MISSING_ACCOUNT');
    }

    const incomplete = db
      .prepare(
        `SELECT 1 FROM TransactionStage ts 
         WHERE FileStageId = ? 
         AND (CategoryId IS NULL OR PersonId IS NULL)
         AND NOT EXISTS (SELECT 1 FROM "Transaction" t WHERE t.Hash = ts.Hash)
         LIMIT 1`,
      )
      .get(id);

    if (incomplete) {
      throw new Error('INCOMPLETE_TRANSACTIONS');
    }

    // Create main File record
    const { lastInsertRowid: fileId } = db
      .prepare('INSERT INTO "File" (Filename, AccountId) VALUES (?, ?)')
      .run(fileStage.Filename, fileStage.AccountId);

    // Move non-duplicate transactions using a single SQL query
    db.prepare(
      `
      INSERT OR IGNORE INTO "Transaction" (Hash, Month, DayOfMonth, Description, CategoryId, Amount, AccountId, FileId, PersonId, Comment)
      SELECT
        Hash,
        substr(Date, 1, 7),
        CAST(substr(Date, 9, 2) AS INTEGER),
        Description,
        CategoryId,
        CASE WHEN ? = 1 THEN -Amount ELSE Amount END,
        ?,
        ?,
        PersonId,
        Comment
      FROM TransactionStage
      WHERE FileStageId = ?
    `,
    ).run(fileStage.Sign ? 1 : 0, fileStage.AccountId, fileId, id);

    // Delete staged data (cascade delete handles TransactionStage)
    db.prepare('DELETE FROM FileStage WHERE FileStageId = ?').run(id);

    db.prepare('COMMIT').run();

    res.json({ success: true });
  } catch (error) {
    if (db.inTransaction) {
      db.prepare('ROLLBACK').run();
    }
    const msg = (error as Error).message;
    if (msg === 'NOT_FOUND') {
      res.status(404).json({ error: 'Staged file not found' });
    } else if (msg === 'MISSING_ACCOUNT') {
      res.status(400).json({ error: 'Account must be assigned before submitting' });
    } else if (msg === 'INCOMPLETE_TRANSACTIONS') {
      res.status(400).json({ error: 'All transactions must have a category and person assigned' });
    } else {
      console.error('Submit error:', error);
      res.status(500).json({ error: 'Failed to submit data', message: msg });
    }
  }
});

router.post('/preview/:id/discard', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  try {
    const result = db.prepare('DELETE FROM FileStage WHERE FileStageId = ?').run(id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Staged file not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Discard error:', error);
    res.status(500).json({ error: 'Failed to discard data', message: (error as Error).message });
  }
});

export default router;
