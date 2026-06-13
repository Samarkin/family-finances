/**
 * Pure logic for matching rows of an arbitrary "comment" CSV (e.g. an Amazon
 * order history) to the staged transactions shown on the Preview page.
 *
 * Matching is intentionally simple: amount must match exactly (by absolute
 * value, to the cent) and the transaction date must fall within a configurable
 * drift window around the CSV row's date range. Because an exact amount match is
 * required, ambiguity can only arise between rows and transactions that share
 * the same absolute amount, so everything is bucketed by amount (in cents).
 *
 * Within a bucket the only thing that distinguishes candidates is the date, so
 * we build a bipartite feasibility graph (row <-> transaction when the dates are
 * compatible) and resolve each connected component independently:
 *   - equal number of rows and transactions with a perfect matching -> apply
 *     (the exact pairing is immaterial since all amounts are identical);
 *   - anything else -> a conflict the user resolves by adjusting the drift.
 * A naive "nearest date" pairing is deliberately avoided, since it can strand
 * otherwise-matchable pairs (e.g. orders 1/1 & 1/3 vs transactions 1/3 & 1/5).
 */

/** A row of the imported comment CSV, projected onto the selected columns. */
export interface CommentRow {
  /** Stable identifier (the row's index in the parsed CSV). */
  id: number;
  /** Start of the date range, as `YYYY-MM-DD`, or null if unparseable. */
  startDate: string | null;
  /** End of the date range, as `YYYY-MM-DD`. Equal to `startDate` for single-date CSVs. */
  endDate: string | null;
  /** Absolute amount in cents, or null if unparseable. */
  amountCents: number | null;
  /** The comment text to attach to a matched transaction. */
  comment: string;
}

/** A staged transaction from the Preview page, projected for matching. */
export interface StagedTx {
  id: number;
  /** Transaction date, as `YYYY-MM-DD`. */
  date: string;
  /** Absolute amount in cents. */
  amountCents: number;
  description: string;
  /** Signed amount, kept only for display in conflict/summary lists. */
  amount: number;
}

/** A single comment to be written onto a transaction. */
export interface CommentMatch {
  txId: number;
  rowId: number;
  comment: string;
}

/** A group of rows and transactions that could not be resolved automatically. */
export interface ConflictGroup {
  rows: CommentRow[];
  txs: StagedTx[];
}

export interface MatchResult {
  /** Comments that will be applied (only rows whose comment text is non-empty). */
  matches: CommentMatch[];
  /** Unresolved groups (unequal counts or no perfect matching). */
  conflicts: ConflictGroup[];
  /** Rows with no transaction of equal amount within drift, whose date overlaps the staged range. */
  inRangeUnmatched: CommentRow[];
  /** Rows skipped because their amount or date columns could not be parsed. */
  unparseableCount: number;
}

/**
 * Parse a currency-ish string into an absolute integer number of cents.
 * Tolerates `$`, thousands separators, surrounding parentheses (accounting
 * negatives) and leading minus signs. Returns null if no number is found.
 */
export function parseAmountToCents(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw)
    .replace(/[$,\s()]/g, '')
    .replace(/^-/, '');
  if (cleaned === '' || !/\d/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.abs(value) * 100);
}

/**
 * Extract the calendar date (`YYYY-MM-DD`) from a CSV cell. The date portion is
 * taken "as written" (UTC for ISO timestamps); the drift window absorbs any
 * timezone offset, so no conversion is performed. Falls back to `Date` parsing
 * for less structured formats. Returns null when no date can be derived.
 */
export function parseCsvDate(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str === '') return null;

  // Fast path: an ISO-ish value beginning with YYYY-MM-DD (optionally a time).
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Fall back to Date parsing for other formats (e.g. "01/15/2024", "Jan 15, 2024").
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Convert a `YYYY-MM-DD` string into a day ordinal for cheap arithmetic. */
function toOrdinal(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

/**
 * Maximum bipartite matching via augmenting paths (Kuhn's algorithm). `adj`
 * maps each left node (index) to the right nodes (indices) it can pair with.
 * Returns `matchRight[r] = l` (or -1) for every right node.
 */
function maxMatching(leftCount: number, rightCount: number, adj: number[][]): number[] {
  const matchRight = new Array<number>(rightCount).fill(-1);

  const tryAssign = (left: number, seen: boolean[]): boolean => {
    for (const right of adj[left]) {
      if (seen[right]) continue;
      seen[right] = true;
      if (matchRight[right] === -1 || tryAssign(matchRight[right], seen)) {
        matchRight[right] = left;
        return true;
      }
    }
    return false;
  };

  for (let left = 0; left < leftCount; left++) {
    tryAssign(left, new Array<boolean>(rightCount).fill(false));
  }
  return matchRight;
}

interface BucketResolution {
  matches: { rowIdx: number; txIdx: number }[];
  conflicts: { rowIdxs: number[]; txIdxs: number[] }[];
  /** Indices (within the bucket) of rows that had no feasible transaction. */
  isolatedRowIdxs: number[];
}

/**
 * Resolve one amount bucket: rows and transactions sharing an absolute amount.
 * Edges connect a row to a transaction whose date lies within the drift window.
 */
function resolveBucket(rows: CommentRow[], txs: StagedTx[], driftDays: number): BucketResolution {
  // Build the feasibility adjacency (row index -> list of tx indices).
  const adj: number[][] = rows.map((row) => {
    const startOrd = toOrdinal(row.startDate as string) - driftDays;
    const endOrd = toOrdinal(row.endDate as string) + driftDays;
    const feasible: number[] = [];
    txs.forEach((tx, txIdx) => {
      const ord = toOrdinal(tx.date);
      if (ord >= startOrd && ord <= endOrd) feasible.push(txIdx);
    });
    return feasible;
  });

  const result: BucketResolution = { matches: [], conflicts: [], isolatedRowIdxs: [] };

  // Find connected components over the bipartite feasibility graph.
  const txAdj: number[][] = txs.map(() => []);
  adj.forEach((txIdxs, rowIdx) => txIdxs.forEach((txIdx) => txAdj[txIdx].push(rowIdx)));

  const rowSeen = new Array<boolean>(rows.length).fill(false);
  const txSeen = new Array<boolean>(txs.length).fill(false);

  for (let startRow = 0; startRow < rows.length; startRow++) {
    if (rowSeen[startRow]) continue;
    if (adj[startRow].length === 0) {
      result.isolatedRowIdxs.push(startRow);
      rowSeen[startRow] = true;
      continue;
    }

    // BFS to collect one connected component of rows + transactions.
    const compRows: number[] = [];
    const compTxs: number[] = [];
    const rowQueue = [startRow];
    rowSeen[startRow] = true;
    while (rowQueue.length > 0) {
      const r = rowQueue.shift() as number;
      compRows.push(r);
      for (const t of adj[r]) {
        if (txSeen[t]) continue;
        txSeen[t] = true;
        compTxs.push(t);
        for (const r2 of txAdj[t]) {
          if (!rowSeen[r2]) {
            rowSeen[r2] = true;
            rowQueue.push(r2);
          }
        }
      }
    }

    // Re-index the component locally and compute a maximum matching.
    const localRowOf = new Map<number, number>();
    compRows.forEach((r, i) => localRowOf.set(r, i));
    const localTxOf = new Map<number, number>();
    compTxs.forEach((t, i) => localTxOf.set(t, i));
    const localAdj = compRows.map((r) =>
      adj[r].filter((t) => localTxOf.has(t)).map((t) => localTxOf.get(t) as number),
    );
    const matchRight = maxMatching(compRows.length, compTxs.length, localAdj);
    const matchedCount = matchRight.filter((l) => l !== -1).length;

    if (compRows.length === compTxs.length && matchedCount === compRows.length) {
      // Perfect matching covering all rows and transactions -> apply it.
      matchRight.forEach((localRow, localTx) => {
        result.matches.push({ rowIdx: compRows[localRow], txIdx: compTxs[localTx] });
      });
    } else {
      result.conflicts.push({ rowIdxs: compRows, txIdxs: compTxs });
    }
  }

  return result;
}

/**
 * Match comment-CSV rows to staged transactions. See the module comment for the
 * matching semantics.
 */
export function matchComments(
  rows: CommentRow[],
  transactions: StagedTx[],
  driftDays: number,
): MatchResult {
  const matches: CommentMatch[] = [];
  const conflicts: ConflictGroup[] = [];
  const inRangeUnmatched: CommentRow[] = [];
  let unparseableCount = 0;

  // Overall date span of the staged transactions, used to flag "in range" rows.
  let minTxDate: string | null = null;
  let maxTxDate: string | null = null;
  for (const tx of transactions) {
    if (minTxDate === null || tx.date < minTxDate) minTxDate = tx.date;
    if (maxTxDate === null || tx.date > maxTxDate) maxTxDate = tx.date;
  }

  // Bucket transactions by absolute amount (cents).
  const txByAmount = new Map<number, StagedTx[]>();
  for (const tx of transactions) {
    const bucket = txByAmount.get(tx.amountCents);
    if (bucket) bucket.push(tx);
    else txByAmount.set(tx.amountCents, [tx]);
  }

  // Bucket the (parseable) rows by absolute amount.
  const rowsByAmount = new Map<number, CommentRow[]>();
  for (const row of rows) {
    if (row.amountCents === null || row.startDate === null || row.endDate === null) {
      unparseableCount++;
      continue;
    }
    const bucket = rowsByAmount.get(row.amountCents);
    if (bucket) bucket.push(row);
    else rowsByAmount.set(row.amountCents, [row]);
  }

  const flagUnmatched = (row: CommentRow) => {
    if (
      minTxDate !== null &&
      maxTxDate !== null &&
      row.startDate !== null &&
      row.endDate !== null &&
      row.startDate <= maxTxDate &&
      row.endDate >= minTxDate
    ) {
      inRangeUnmatched.push(row);
    }
  };

  for (const [amountCents, bucketRows] of rowsByAmount) {
    const bucketTxs = txByAmount.get(amountCents);
    if (!bucketTxs || bucketTxs.length === 0) {
      bucketRows.forEach(flagUnmatched);
      continue;
    }

    const resolution = resolveBucket(bucketRows, bucketTxs, driftDays);

    for (const { rowIdx, txIdx } of resolution.matches) {
      const row = bucketRows[rowIdx];
      if (row.comment.trim() !== '') {
        matches.push({ txId: bucketTxs[txIdx].id, rowId: row.id, comment: row.comment });
      }
    }

    for (const conflict of resolution.conflicts) {
      conflicts.push({
        rows: conflict.rowIdxs.map((i) => bucketRows[i]),
        txs: conflict.txIdxs.map((i) => bucketTxs[i]),
      });
    }

    resolution.isolatedRowIdxs.forEach((i) => flagUnmatched(bucketRows[i]));
  }

  inRangeUnmatched.sort((a, b) => (a.startDate as string).localeCompare(b.startDate as string));

  return { matches, conflicts, inRangeUnmatched, unparseableCount };
}
