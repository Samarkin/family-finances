import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getDb } from '../db/connection.js';
import { parseCSV } from '../services/csvParser.js';
import { AccountRow, PersonRow } from '../db/types.js';
import { calculateTransactionHash } from '../utils/hash.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const csvContent = req.file.buffer.toString('utf-8');
    const transactions = parseCSV(csvContent);
    const filename = req.file.originalname;

    const db = getDb();

    // Start a transaction
    const fileStageId = db.transaction(() => {
      // 1. Try to guess Account from filename or transactions
      let guessedAccountId: number | null = null;

      // Check accounts for filename regex match
      const accounts = db
        .prepare('SELECT AccountId, FilenameRegex, AccountRegex FROM Account')
        .all() as AccountRow[];
      for (const account of accounts) {
        if (account.FilenameRegex && new RegExp(account.FilenameRegex, 'i').test(filename)) {
          guessedAccountId = account.AccountId;
          break;
        }
      }

      // If not found by filename, check transactions rawAccount
      if (!guessedAccountId) {
        for (const tx of transactions) {
          if (tx.rawAccount) {
            for (const account of accounts) {
              if (
                account.AccountRegex &&
                new RegExp(account.AccountRegex, 'i').test(tx.rawAccount)
              ) {
                guessedAccountId = account.AccountId;
                break;
              }
            }
          }
          if (guessedAccountId) break;
        }
      }

      // 2. Insert into FileStage
      const insertFileStage = db.prepare(
        'INSERT INTO FileStage (Filename, AccountId) VALUES (?, ?)',
      );
      const result = insertFileStage.run(filename, guessedAccountId);
      const newFileStageId = result.lastInsertRowid as number;

      // 3. Insert into TransactionStage
      const insertTxStage = db.prepare(`
        INSERT INTO TransactionStage (Hash, Date, Description, Amount, RawCategory, CategoryId, FileStageId, PersonId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const personStatements = db
        .prepare('SELECT PersonId, MemberRegex FROM Person')
        .all() as PersonRow[];

      for (const tx of transactions) {
        let txPersonId: number | null = null;
        if (tx.rawPerson) {
          for (const person of personStatements) {
            if (person.MemberRegex && new RegExp(person.MemberRegex, 'i').test(tx.rawPerson)) {
              txPersonId = person.PersonId;
              break;
            }
          }
        }

        const hash = calculateTransactionHash(
          tx.date,
          tx.description,
          tx.amount,
          guessedAccountId || undefined,
        );
        insertTxStage.run(
          hash,
          tx.date,
          tx.description,
          tx.amount,
          tx.rawCategory || null,
          tx.categoryId || null,
          newFileStageId,
          txPersonId,
        );
      }

      return newFileStageId;
    })();

    res.json({ fileStageId });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file', message: (error as Error).message });
  }
});

export default router;
