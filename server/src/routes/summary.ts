import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { CATEGORIES, CategoryId } from '../constants/categories.js';

const router = Router();

router.get('/summary', (req, res, next) => {
  try {
    const db = getDb();

    // 1. Define categories for the response (excluding payments)
    const categoriesList = Object.entries(CATEGORIES)
      .filter(([id]) => id !== 'payments')
      .map(([id, cat]) => ({
        id: id as CategoryId,
        name: cat.name,
        color: cat.color,
        isIncome: 'isIncome' in cat ? ((cat as { isIncome?: boolean }).isIncome ?? false) : false,
      }));

    const incomeCategories = Object.entries(CATEGORIES)
      .filter(([, cat]) => 'isIncome' in cat && (cat as { isIncome?: boolean }).isIncome)
      .map(([id]) => `'${id}'`)
      .join(', ');

    const incomeCondition = incomeCategories ? `CategoryId IN (${incomeCategories})` : '1=0';

    // 2. Get monthly aggregates for the last 12 active months (excluding payments from totals)
    const monthlyStats = db
      .prepare(
        `
      SELECT 
        Month,
        COUNT(*) as transactionCount,
        SUM(CASE WHEN NOT (${incomeCondition}) AND CategoryId != 'payments' THEN 1 ELSE 0 END) as spendingCount,
        SUM(CASE WHEN ${incomeCondition} AND CategoryId != 'payments' THEN 1 ELSE 0 END) as incomeCount
      FROM "Transaction"
      GROUP BY Month
      ORDER BY Month DESC
      LIMIT 12
    `,
      )
      .all() as {
      Month: string;
      transactionCount: number;
      spendingCount: number;
      incomeCount: number;
    }[];

    if (monthlyStats.length === 0) {
      return res.json({
        data: [],
        categories: categoriesList,
      });
    }

    // Order from oldest to newest for the chart
    const statsReversed = [...monthlyStats].reverse();
    const monthList = statsReversed.map((s) => s.Month);

    // 4. Get category breakdown per month
    const categoryBreakdown = db
      .prepare(
        `
      SELECT 
        Month,
        CategoryId,
        SUM(Amount) as totalAmount
      FROM "Transaction"
      WHERE Month IN (${monthList.map(() => '?').join(',')}) AND CategoryId != 'payments'
      GROUP BY Month, CategoryId
    `,
      )
      .all(...monthList) as { Month: string; CategoryId: string; totalAmount: number }[];

    // 5. Format data
    const data = statsReversed.map((stats) => {
      const month = stats.Month;
      const spendings = categoriesList.map((cat) => {
        const breakdown = categoryBreakdown.find(
          (b) => b.Month === month && b.CategoryId === cat.id,
        );
        return breakdown ? breakdown.totalAmount : 0;
      });

      return {
        month,
        spendings,
        transactionCount: stats.transactionCount,
        spendingCount: stats.spendingCount,
        incomeCount: stats.incomeCount,
      };
    });

    res.json({
      data,
      categories: categoriesList,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
