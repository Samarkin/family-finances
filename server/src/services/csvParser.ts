import Papa from 'papaparse';
import { RAW_CATEGORY_MAP, CategoryId } from '../constants/categories.js';

export interface NormalizedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  rawCategory?: string;
  categoryId?: CategoryId;
  rawAccount?: string;
  rawPerson?: string;
}

const DATE_COLUMNS = ['transaction date', 'date', 'posted date', 'posting date', 'post date'];
const DESCRIPTION_COLUMNS = ['description', 'transaction description', 'memo', 'title'];
const AMOUNT_COLUMNS = ['amount', 'amount (usd)', 'amount ($)', 'value'];
const DEBIT_COLUMNS = ['debit', 'charge', 'withdrawal'];
const CREDIT_COLUMNS = ['credit', 'deposit', 'payment'];
const ACCOUNT_COLUMNS = ['account no.', 'account #', 'card no.', 'card #'];
const PERSON_COLUMNS = ['purchased by', 'card member', 'user'];
const CATEGORY_COLUMNS = ['category', 'raw category', 'type'];

function findColumn(headers: string[], options: string[]): string | undefined {
  return headers.find((h) => options.includes(h.toLowerCase()));
}

function parseDate(dateStr: string): string {
  // Try common formats. Native Date.parse is often good enough for these.
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Unable to parse date: ${dateStr}`);
  }
  return date.toISOString().split('T')[0];
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  // Remove currency symbols, commas, and handle parentheses for negatives
  let clean = val.replace(/[$,]/g, '').trim();
  if (clean.startsWith('(') && clean.endsWith(')')) {
    clean = '-' + clean.substring(1, clean.length - 1);
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseCSV(csvContent: string): NormalizedTransaction[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // We'll handle typing manually for better control
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`CSV Parsing error: ${result.errors[0].message}`);
  }

  const headers = result.meta.fields || [];
  const dateCol = findColumn(headers, DATE_COLUMNS);
  const descCol = findColumn(headers, DESCRIPTION_COLUMNS);
  const amountCol = findColumn(headers, AMOUNT_COLUMNS);
  const debitCol = findColumn(headers, DEBIT_COLUMNS);
  const creditCol = findColumn(headers, CREDIT_COLUMNS);
  const accountCol = findColumn(headers, ACCOUNT_COLUMNS);
  const personCol = findColumn(headers, PERSON_COLUMNS);
  const categoryCol = findColumn(headers, CATEGORY_COLUMNS);

  if (!dateCol || !descCol || (!amountCol && !debitCol && !creditCol)) {
    throw new Error(
      'CSV format not recognized: missing required columns (Date, Description, and Amount/Debit/Credit)',
    );
  }

  return result.data.map((row: Record<string, string>) => {
    let amount = 0;
    if (amountCol) {
      amount = parseAmount(row[amountCol]);
    } else {
      const debit = parseAmount(row[debitCol as string]);
      const credit = parseAmount(row[creditCol as string]);
      // If both are present, typically one is empty or they are additive (though usually one is positive and other empty)
      // Standard: Spendings are positive or in Debit, Income is negative or in Credit.
      // We will normalize to: Spendings = positive, Income = negative.
      // But architecture says: "one column that contains a single number – either positive for spendings and negative for payments, or the exact opposite (which is why we have a sign inversion mechanism)"
      // For two columns: Debit is usually positive spending, Credit is usually positive income.
      // So Normalized Amount = Debit - Credit.
      amount = debit - credit;
    }

    const rawCategory = categoryCol ? row[categoryCol] : undefined;
    const categoryId = rawCategory ? RAW_CATEGORY_MAP[rawCategory] : undefined;

    return {
      date: parseDate(row[dateCol]),
      description: row[descCol] || '',
      amount: amount,
      rawCategory,
      categoryId,
      rawAccount: accountCol ? row[accountCol] : undefined,
      rawPerson: personCol ? row[personCol] : undefined,
    };
  });
}
