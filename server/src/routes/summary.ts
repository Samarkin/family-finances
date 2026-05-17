import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { CATEGORIES, CategoryId } from '../constants/categories.js';

const router = Router();

router.get('/summary', (req, res, next) => {
  try {
    const db = getDb();

    // 1. Define categories for the response
    const categoriesList = Object.entries(CATEGORIES).map(([id, cat]) => ({
      id: id as CategoryId,
      name: cat.name,
      color: cat.color,
    }));

    // 2. Get global totals
    const globalTotals = db
      .prepare(
        `
      SELECT 
        SUM(CASE WHEN Amount > 0 THEN Amount ELSE 0 END) as totalSpent,
        SUM(CASE WHEN Amount < 0 THEN ABS(Amount) ELSE 0 END) as totalEarned,
        COUNT(*) as transactionCount,
        COUNT(DISTINCT Month) as totalMonths
      FROM "Transaction"
    `,
      )
      .get() as {
      totalSpent: number | null;
      totalEarned: number | null;
      transactionCount: number;
      totalMonths: number;
    };

    const allTimeCategoryBreakdown = db
      .prepare(
        `
      SELECT 
        CategoryId,
        SUM(Amount) as totalAmount
      FROM "Transaction"
      GROUP BY CategoryId
    `,
      )
      .all() as { CategoryId: string; totalAmount: number }[];

    const allTimeSpendings = categoriesList.map((cat) => {
      const breakdown = allTimeCategoryBreakdown.find((b) => b.CategoryId === cat.id);
      return breakdown ? breakdown.totalAmount : 0;
    });

    // 3. Get monthly aggregates for the last 12 active months
    const monthlyStats = db
      .prepare(
        `
      SELECT 
        Month,
        SUM(CASE WHEN Amount > 0 THEN Amount ELSE 0 END) as totalSpent,
        SUM(CASE WHEN Amount < 0 THEN ABS(Amount) ELSE 0 END) as totalEarned,
        COUNT(*) as transactionCount
      FROM "Transaction"
      GROUP BY Month
      ORDER BY Month DESC
      LIMIT 12
    `,
      )
      .all() as {
      Month: string;
      totalSpent: number;
      totalEarned: number;
      transactionCount: number;
    }[];

    if (monthlyStats.length === 0) {
      return res.json({
        data: [],
        categories: categoriesList,
        allTimeSpendings,
        totalSpent: globalTotals.totalSpent || 0,
        totalEarned: globalTotals.totalEarned || 0,
        transactionCount: globalTotals.transactionCount,
        totalMonths: globalTotals.totalMonths || 0,
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
      WHERE Month IN (${monthList.map(() => '?').join(',')})
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
        totalSpent: stats.totalSpent,
        totalEarned: stats.totalEarned,
        transactionCount: stats.transactionCount,
      };
    });

    res.json({
      data,
      categories: categoriesList,
      allTimeSpendings,
      totalSpent: globalTotals.totalSpent || 0,
      totalEarned: globalTotals.totalEarned || 0,
      transactionCount: globalTotals.transactionCount,
      totalMonths: globalTotals.totalMonths || 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
