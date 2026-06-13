import { expect, describe, it } from '@jest/globals';
import {
  parseAmountToCents,
  parseCsvDate,
  matchComments,
  type CommentRow,
  type StagedTx,
} from '../commentMatching';

let nextRowId = 0;
const row = (
  amount: number | null,
  start: string | null,
  end: string | null = start,
  comment = 'note',
): CommentRow => ({
  id: nextRowId++,
  startDate: start,
  endDate: end,
  amountCents: amount === null ? null : Math.round(Math.abs(amount) * 100),
  comment,
});

const tx = (id: number, date: string, amount: number): StagedTx => ({
  id,
  date,
  amountCents: Math.round(Math.abs(amount) * 100),
  description: `tx ${id}`,
  amount,
});

describe('parseAmountToCents', () => {
  it('parses plain, currency, comma, parenthesised and signed values to absolute cents', () => {
    expect(parseAmountToCents('45.99')).toBe(4599);
    expect(parseAmountToCents('$1,234.50')).toBe(123450);
    expect(parseAmountToCents('(12.00)')).toBe(1200);
    expect(parseAmountToCents('-7.5')).toBe(750);
    expect(parseAmountToCents('  $0.01 ')).toBe(1);
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents(null)).toBeNull();
  });
});

describe('parseCsvDate', () => {
  it('takes the date portion of ISO timestamps as written and parses other formats', () => {
    expect(parseCsvDate('2024-01-15')).toBe('2024-01-15');
    expect(parseCsvDate('2024-01-15T23:30:00Z')).toBe('2024-01-15');
    expect(parseCsvDate('2024-01-15 08:23:00 UTC')).toBe('2024-01-15');
    expect(parseCsvDate('01/15/2024')).toBe('2024-01-15');
    expect(parseCsvDate('')).toBeNull();
    expect(parseCsvDate('not a date')).toBeNull();
  });
});

describe('matchComments', () => {
  it('matches a single row to a transaction within the drift window', () => {
    const r = row(50, '2024-01-01');
    const result = matchComments([r], [tx(10, '2024-01-03', 50)], 3);
    expect(result.matches).toEqual([{ txId: 10, rowId: r.id, comment: 'note' }]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.inRangeUnmatched).toHaveLength(0);
  });

  it('does not match when the date is outside the drift window', () => {
    const r = row(50, '2024-01-01');
    const result = matchComments([r], [tx(10, '2024-01-10', 50)], 3);
    expect(result.matches).toHaveLength(0);
    // 2024-01-01 falls within the staged span [2024-01-10, 2024-01-10]? No -> not in range.
    expect(result.inRangeUnmatched).toHaveLength(0);
  });

  it('matches by absolute amount regardless of sign', () => {
    const r = row(50, '2024-01-02');
    const result = matchComments([r], [tx(10, '2024-01-02', -50)], 1);
    expect(result.matches).toEqual([{ txId: 10, rowId: r.id, comment: 'note' }]);
  });

  it('uses maximum matching, not greedy nearest-date pairing', () => {
    // Orders on 1/1 and 1/3; transactions on 1/3 and 1/5; drift 3.
    // A greedy 1/3->1/3 pairing would strand 1/1 and 1/5 (4 days apart).
    const r1 = row(50, '2024-01-01', '2024-01-01', 'order A');
    const r2 = row(50, '2024-01-03', '2024-01-03', 'order B');
    const result = matchComments([r1, r2], [tx(10, '2024-01-03', 50), tx(11, '2024-01-05', 50)], 3);
    expect(result.conflicts).toHaveLength(0);
    expect(result.matches).toHaveLength(2);
    const byTx = Object.fromEntries(result.matches.map((m) => [m.txId, m.comment]));
    // Every transaction received exactly one of the two comments.
    expect(new Set(Object.values(byTx))).toEqual(new Set(['order A', 'order B']));
    expect(Object.keys(byTx).sort()).toEqual(['10', '11']);
  });

  it('applies an equal-count group arbitrarily and reports unequal counts as conflicts', () => {
    // 2 rows -> 1 transaction (same amount, both within drift) = conflict.
    const r1 = row(20, '2024-02-01');
    const r2 = row(20, '2024-02-01');
    const conflictResult = matchComments([r1, r2], [tx(10, '2024-02-01', 20)], 3);
    expect(conflictResult.matches).toHaveLength(0);
    expect(conflictResult.conflicts).toHaveLength(1);
    expect(conflictResult.conflicts[0].rows.map((r) => r.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(conflictResult.conflicts[0].txs.map((t) => t.id)).toEqual([10]);
  });

  it('leaves a same-amount transaction without a nearby order unmatched, not in conflict', () => {
    // One $50 order near tx 10; tx 11 is also $50 but far away -> just no comment.
    const r = row(50, '2024-03-01');
    const result = matchComments([r], [tx(10, '2024-03-01', 50), tx(11, '2024-06-01', 50)], 3);
    expect(result.conflicts).toHaveLength(0);
    expect(result.matches).toEqual([{ txId: 10, rowId: r.id, comment: 'note' }]);
  });

  it('flags rows inside the staged date span but with no amount match as in-range unmatched', () => {
    const r = row(999, '2024-01-05'); // amount with no matching transaction
    const result = matchComments([r], [tx(10, '2024-01-01', 50), tx(11, '2024-01-10', 75)], 3);
    expect(result.matches).toHaveLength(0);
    expect(result.inRangeUnmatched.map((x) => x.id)).toEqual([r.id]);
  });

  it('counts rows with unparseable amount or date', () => {
    const result = matchComments(
      [row(null, '2024-01-01'), row(50, null)],
      [tx(10, '2024-01-01', 50)],
      3,
    );
    expect(result.unparseableCount).toBe(2);
    expect(result.matches).toHaveLength(0);
  });

  it('skips matched rows whose comment text is empty', () => {
    const r = row(50, '2024-01-02', '2024-01-02', '   ');
    const result = matchComments([r], [tx(10, '2024-01-02', 50)], 1);
    expect(result.matches).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('matches a date range spanning the transaction date', () => {
    const r = row(30, '2024-04-01', '2024-04-10');
    const result = matchComments([r], [tx(10, '2024-04-05', 30)], 0);
    expect(result.matches).toEqual([{ txId: 10, rowId: r.id, comment: 'note' }]);
  });
});
