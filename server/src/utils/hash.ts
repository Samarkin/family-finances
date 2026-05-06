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
  // Use absolute value for amount so that hash doesn't change when sign is flipped.
  // AccountId can be null if not yet assigned.
  hash.update(`${date}-${description}-${Math.abs(amount)}-${accountId || ''}`);
  return hash.digest('hex');
}
