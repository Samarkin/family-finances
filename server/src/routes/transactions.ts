import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { CATEGORY_NAMES, INCOME_CATEGORIES_SQL_LIST } from '../constants/categories.js';

const router = Router();

router.get('/transactions/months', (_req, res, next) => {
  try {
    const db = getDb();
    const rows = db
      .prepare('SELECT DISTINCT Month FROM "Transaction" ORDER BY Month DESC')
      .all() as { Month: string }[];
    res.json({ months: rows.map((r) => r.Month) });
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', (req, res, next) => {
  try {
    const { month, personId, offset = '0', count, sort } = req.query;

    if (!count) {
      res.status(400).json({ error: 'Count parameter is mandatory' });
      return;
    }

    const countNum = parseInt(count as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    if (isNaN(countNum) || isNaN(offsetNum)) {
      res.status(400).json({ error: 'Invalid count or offset' });
      return;
    }

    const db = getDb();
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (month) {
      whereClause += ' AND t.Month = ?';
      params.push(month as string);
    }

    if (personId) {
      whereClause += ' AND t.PersonId = ?';
      params.push(Number(personId));
    }

    // Sorting logic
    let orderBy = 't.Month DESC, t.DayOfMonth DESC';
    if (sort) {
      const [field, direction] = (sort as string).split(':');
      const dir = direction?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      switch (field) {
        case 'date':
          orderBy = `t.Month ${dir}, t.DayOfMonth ${dir}`;
          break;
        case 'description':
          orderBy = `t.Description ${dir}`;
          break;
        case 'amount':
          orderBy = `t.Amount ${dir}`;
          break;
        case 'personId':
          orderBy = `p.Name ${dir}`;
          break;
        case 'accountId':
          orderBy = `a.Name ${dir}`;
          break;
        case 'categoryId':
          orderBy = `t.CategoryId ${dir}`;
          break;
      }
    }

    const incomeCondition = INCOME_CATEGORIES_SQL_LIST
      ? `CategoryId IN (${INCOME_CATEGORIES_SQL_LIST})`
      : '1=0';

    const summaryQuery = `
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN NOT (${incomeCondition}) AND CategoryId != 'payments' THEN Amount ELSE 0 END) as totalSpent,
        SUM(CASE WHEN ${incomeCondition} AND CategoryId != 'payments' THEN -Amount ELSE 0 END) as totalEarned,
        SUM(CASE WHEN CategoryId = 'payments' THEN Amount ELSE 0 END) as netPayments
      FROM "Transaction" t
      ${whereClause}
    `;

    const summary = db.prepare(summaryQuery).get(...params) as {
      totalCount: number;
      totalSpent: number | null;
      totalEarned: number | null;
      netPayments: number | null;
    };

    const dataQuery = `
      SELECT 
        t.Hash as id,
        t.Month || '-' || printf('%02d', t.DayOfMonth) as date,
        t.Description as description,
        t.CategoryId as categoryId,
        t.Amount as amount,
        t.AccountId as accountId,
        t.PersonId as personId
      FROM "Transaction" t
      LEFT JOIN Person p ON t.PersonId = p.PersonId
      LEFT JOIN Account a ON t.AccountId = a.AccountId
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const data = db.prepare(dataQuery).all(...params, countNum, offsetNum);

    const personsRows = db.prepare('SELECT PersonId as id, Name as name FROM Person').all() as {
      id: number;
      name: string;
    }[];
    const persons: Record<number, string> = {};
    personsRows.forEach((r) => (persons[r.id] = r.name));

    const accountsRows = db.prepare('SELECT AccountId as id, Name as name FROM Account').all() as {
      id: number;
      name: string;
    }[];
    const accounts: Record<number, string> = {};
    accountsRows.forEach((r) => (accounts[r.id] = r.name));

    res.json({
      data,
      totalCount: summary.totalCount,
      totalSpent: summary.totalSpent || 0,
      totalEarned: summary.totalEarned || 0,
      netPayments: summary.netPayments || 0,
      persons,
      accounts,
      categories: CATEGORY_NAMES,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
