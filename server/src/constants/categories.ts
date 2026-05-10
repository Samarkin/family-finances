export const CATEGORIES = {
  salary: { name: 'Salary', color: '#7f7f7f' },
  stock: { name: 'Stock', color: '#7faf7f' },
  payments: { name: 'Payments & Transfers', color: '#607d8b' },
  housing: { name: 'Housing', color: '#3366cc' },
  food: { name: 'Food & Drinks', color: '#ff3c00' },
  groceries: { name: 'Groceries', color: '#4caf50' },
  gas: { name: 'Gas & Car', color: '#dc3912' },
  utilities: { name: 'Utilities & Bills', color: '#ff9900' },
  travel: { name: 'Travel', color: '#009688' },
  entertainment: { name: 'Entertainment & Toys', color: '#109618' },
  shopping: { name: 'Shopping & Necessities', color: '#990099' },
  health: { name: 'Health & Beauty', color: '#0099c6' },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

export const CATEGORY_NAMES: Record<CategoryId, string> = Object.fromEntries(
  Object.entries(CATEGORIES).map(([id, cat]) => [id, cat.name]),
) as Record<CategoryId, string>;

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
