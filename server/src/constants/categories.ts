export interface Category {
  id: CategoryId;
  name: string;
  color: string;
}

export const CATEGORIES = {
  salary: { id: 'salary', name: 'Salary', color: '#7f7f7f' },
  stock: { id: 'stock', name: 'Stock', color: '#7faf7f' },
  payments: { id: 'payments', name: 'Payments', color: '#607d8b' },
  housing: { id: 'housing', name: 'Housing', color: '#3366cc' },
  food: { id: 'food', name: 'Food & Drinks', color: '#ff3c00' },
  groceries: { id: 'groceries', name: 'Groceries', color: '#4caf50' },
  gas: { id: 'gas', name: 'Gas & Car', color: '#dc3912' },
  utilities: { id: 'utilities', name: 'Bills & Utilities', color: '#ff9900' },
  travel: { id: 'travel', name: 'Travel', color: '#009688' },
  entertainment: { id: 'entertainment', name: 'Entertainment', color: '#109618' },
  shopping: { id: 'shopping', name: 'Shopping', color: '#990099' },
  health: { id: 'health', name: 'Health', color: '#0099c6' },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

export const CATEGORY_LIST = Object.values(CATEGORIES);

export const RAW_CATEGORY_MAP: Record<string, CategoryId> = {
  Airfare: 'travel',
  Airlines: 'travel',
  'Car Rental': 'travel',
  Dining: 'food',
  Entertainment: 'entertainment',
  'Food & Drinks': 'food',
  Food: 'food',
  'Gas/Car': 'gas',
  'Gas/Automotive': 'gas',
  Grocery: 'groceries',
  Groceries: 'groceries',
  'Health Care': 'health',
  Health: 'health',
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
};
