import { calculateTransactionHash } from '../hash.js';

describe('calculateTransactionHash', () => {
  it('should produce the same hash for identical inputs', () => {
    const hash1 = calculateTransactionHash('2023-01-01', 'Test', 10.0, 1);
    const hash2 = calculateTransactionHash('2023-01-01', 'Test', 10.0, 1);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different dates', () => {
    const hash1 = calculateTransactionHash('2023-01-01', 'Test', 10.0, 1);
    const hash2 = calculateTransactionHash('2023-01-02', 'Test', 10.0, 1);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different descriptions', () => {
    const hash1 = calculateTransactionHash('2023-01-01', 'Test 1', 10.0, 1);
    const hash2 = calculateTransactionHash('2023-01-01', 'Test 2', 10.0, 1);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different amounts', () => {
    const hash1 = calculateTransactionHash('2023-01-01', 'Test', 10.0, 1);
    const hash2 = calculateTransactionHash('2023-01-01', 'Test', 10.1, 1);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different accounts', () => {
    const hash1 = calculateTransactionHash('2023-01-01', 'Test', 10.0, 1);
    const hash2 = calculateTransactionHash('2023-01-01', 'Test', 10.0, 2);
    expect(hash1).not.toBe(hash2);
  });

  it('should handle null accountId', () => {
    const hash1 = calculateTransactionHash('2023-01-01', 'Test', 10.0, null);
    const hash2 = calculateTransactionHash('2023-01-01', 'Test', 10.0, undefined);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash when accountId is added', () => {
    const hash1 = calculateTransactionHash('2023-01-01', 'Test', 10.0, null);
    const hash2 = calculateTransactionHash('2023-01-01', 'Test', 10.0, 1);
    expect(hash1).not.toBe(hash2);
  });
});
