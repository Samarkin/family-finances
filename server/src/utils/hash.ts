import crypto from 'crypto';

/**
 * Calculates a unique hash for a transaction.
 * Hash components: Date (YYYY-MM-DD), Description, Amount, AccountId.
 */
export function calculateTransactionHash(
  date: string,
  description: string,
  amount: number,
  accountId?: number | null,
): string {
  const hash = crypto.createHash('sha256');
  // Use a consistent representation for amount (e.g., normalize to string)
  // AccountId can be null if not yet assigned.
  hash.update(`${date}-${description}-${amount}-${accountId || ''}`);
  return hash.digest('hex');
}
