export const CATEGORIES = {
  salary: { name: 'Salary', color: '#7f7f7f', isIncome: true },
  stock: { name: 'Stock', color: '#7faf7f', isIncome: true },
  payments: { name: 'Payments & Transfers', color: '#607d8b' },
  cashback: { name: 'Cashback & Settlements', color: '#ffc107' },
  housing: { name: 'Housing', color: '#3366cc' },
  food: { name: 'Food & Drinks', color: '#ff9900' },
  groceries: { name: 'Groceries', color: '#4caf50' },
  gas: { name: 'Gas & Car', color: '#dc3912' },
  utilities: { name: 'Utilities & Bills', color: '#ff3c00' },
  travel: { name: 'Travel', color: '#009688' },
  entertainment: { name: 'Entertainment & Toys', color: '#109618' },
  school: { name: 'School & Education', color: '#8d6e63' },
  shopping: { name: 'Shopping & Necessities', color: '#990099' },
  health: { name: 'Health & Beauty', color: '#0099c6' },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

export const CATEGORY_NAMES: Record<CategoryId, { name: string; isIncome: boolean }> =
  Object.fromEntries(
    Object.entries(CATEGORIES).map(([id, cat]) => [
      id,
      {
        name: cat.name,
        isIncome: 'isIncome' in cat ? ((cat as { isIncome?: boolean }).isIncome ?? false) : false,
      },
    ]),
  ) as Record<CategoryId, { name: string; isIncome: boolean }>;

export const RAW_CATEGORY_MAP: Record<string, CategoryId> = {
  ACCT_XFER: 'payments',
  Airfare: 'travel',
  Airlines: 'travel',
  'Bills & Utilities': 'utilities',
  'Car Rental': 'travel',
  Dining: 'food',
  Entertainment: 'entertainment',
  'Fees & Adjustments': 'payments',
  Food: 'food',
  'Food & Drink': 'food',
  'Food & Drinks': 'food',
  'Gas/Automotive': 'gas',
  'Gas/Car': 'gas',
  Groceries: 'groceries',
  Grocery: 'groceries',
  Health: 'health',
  'Health Care': 'health',
  Hotels: 'travel',
  Medical: 'health',
  Merchandise: 'shopping',
  Payment: 'payments',
  'Payment/Credit': 'payments',
  'Phone/Cable': 'utilities',
  Restaurants: 'food',
  Shopping: 'shopping',
  Transportation: 'travel',
  Travel: 'travel',
  Utilities: 'utilities',
  'Utilities & Bills': 'utilities',
};

export const INCOME_CATEGORIES_SQL_LIST = Object.entries(CATEGORIES)
  .filter(([, cat]) => 'isIncome' in cat && (cat as { isIncome?: boolean }).isIncome)
  .map(([id]) => `'${id}'`)
  .join(', ');

export const SUMMARY_CATEGORIES_LIST = Object.entries(CATEGORIES)
  .filter(([id]) => id !== 'payments')
  .map(([id, cat]) => ({
    id: id as CategoryId,
    name: cat.name,
    color: cat.color,
    isIncome: 'isIncome' in cat ? ((cat as { isIncome?: boolean }).isIncome ?? false) : false,
  }));
