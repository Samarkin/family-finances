import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Papa from 'papaparse';
import { formatCurrency } from '../utils/format';
import {
  matchComments,
  parseAmountToCents,
  parseCsvDate,
  type CommentRow,
  type ConflictGroup,
  type StagedTx,
} from '../utils/commentMatching';

/** A staged transaction as rendered on the Preview page. */
export interface WizardTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
}

interface CommentImportWizardProps {
  file: File;
  previewId: string;
  transactions: WizardTransaction[];
  onClose: () => void;
  onApplied: () => void;
}

const NONE = '';
const PREVIEW_ROWS = 5;
const DEFAULT_DRIFT = 3;

/** Pick the first column header matching any of the given patterns. */
function guessColumn(fields: string[], patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = fields.find((f) => pattern.test(f));
    if (match) return match;
  }
  return NONE;
}

function describeRowDate(row: CommentRow): string {
  if (!row.startDate) return '—';
  return row.endDate && row.endDate !== row.startDate
    ? `${row.startDate} → ${row.endDate}`
    : row.startDate;
}

/**
 * Two-step modal for importing comments from an arbitrary CSV and mapping them
 * onto the staged transactions currently being reviewed. All parsing and
 * matching happen client-side; nothing is written until "Apply" is pressed.
 */
export default function CommentImportWizard({
  file,
  previewId,
  transactions,
  onClose,
  onApplied,
}: CommentImportWizardProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [fields, setFields] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [amountCol, setAmountCol] = useState(NONE);
  const [startCol, setStartCol] = useState(NONE);
  const [endCol, setEndCol] = useState(NONE);
  const [commentCol, setCommentCol] = useState(NONE);

  const [drift, setDrift] = useState(DEFAULT_DRIFT);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (cancelled) return;
      const result = Papa.parse<Record<string, string>>(String(reader.result ?? ''), {
        header: true,
        skipEmptyLines: true,
      });
      const parsedFields = result.meta.fields ?? [];
      if (parsedFields.length === 0 || result.data.length === 0) {
        setParseError('Could not find any columns or rows in this CSV.');
        return;
      }
      setFields(parsedFields);
      setRows(result.data);
      setAmountCol(guessColumn(parsedFields, [/amount|total|price|cost/i]));
      setStartCol(guessColumn(parsedFields, [/order date|start|^date|date/i]));
      setEndCol(guessColumn(parsedFields, [/ship date|end date/i]));
      setCommentCol(guessColumn(parsedFields, [/product|item|name|title|description/i]));
    };
    reader.onerror = () => {
      if (!cancelled) setParseError('Failed to read the CSV file.');
    };
    reader.readAsText(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

  const stagedTxs = useMemo<StagedTx[]>(
    () =>
      transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        amountCents: Math.round(Math.abs(tx.amount) * 100),
        description: tx.description,
        amount: tx.amount,
      })),
    [transactions],
  );

  const commentRows = useMemo<CommentRow[]>(() => {
    if (!amountCol || !startCol || !commentCol) return [];
    return rows.map((row, index) => {
      const startDate = parseCsvDate(row[startCol]);
      const endDate = endCol ? parseCsvDate(row[endCol]) : startDate;
      return {
        id: index,
        startDate,
        endDate,
        amountCents: parseAmountToCents(row[amountCol]),
        comment: row[commentCol] ?? '',
      };
    });
  }, [rows, amountCol, startCol, endCol, commentCol]);

  const result = useMemo(
    () => matchComments(commentRows, stagedTxs, drift),
    [commentRows, stagedTxs, drift],
  );

  const noCommentTxs = useMemo(() => {
    const matchedIds = new Set(result.matches.map((m) => m.txId));
    return stagedTxs.filter((tx) => !matchedIds.has(tx.id));
  }, [result.matches, stagedTxs]);

  const canProceed = !!amountCol && !!startCol && !!commentCol;

  const handleApply = useCallback(async () => {
    setApplyError(null);
    setApplying(true);
    try {
      const response = await fetch(`/api/preview/${previewId}/apply-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: result.matches.map(({ txId, comment }) => ({ id: txId, comment })),
        }),
      });
      if (response.ok) {
        onApplied();
        onClose();
      } else {
        const errData = await response.json().catch(() => ({}));
        setApplyError(errData.error || 'Failed to apply comments');
      }
    } catch {
      setApplyError('An unexpected error occurred');
    } finally {
      setApplying(false);
    }
  }, [previewId, result.matches, onApplied, onClose]);

  const columnSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    optional = false,
  ) => (
    <FormControl size="small" sx={{ minWidth: 200 }} error={!optional && !value}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(e) => onChange(e.target.value)} displayEmpty>
        {optional && (
          <MenuItem value={NONE}>
            <em>None</em>
          </MenuItem>
        )}
        {fields.map((field) => (
          <MenuItem key={field} value={field}>
            {field}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Import comments — {file.name}</DialogTitle>
      <DialogContent dividers>
        {parseError ? (
          <Alert severity="error">{parseError}</Alert>
        ) : step === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Select which columns hold the amount, date(s) and the comment text. The end-date
              column is optional — leave it as <em>None</em> for single-date CSVs.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {columnSelect('Amount', amountCol, setAmountCol)}
              {columnSelect('Start date', startCol, setStartCol)}
              {columnSelect('End date (optional)', endCol, setEndCol, true)}
              {columnSelect('Comment', commentCol, setCommentCol)}
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {fields.map((field) => (
                      <TableCell key={field} sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                        {field}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <TableRow key={i}>
                      {fields.map((field) => (
                        <TableCell key={field} sx={{ whiteSpace: 'nowrap' }}>
                          {row[field]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ maxWidth: 360 }}>
              <Typography gutterBottom>Date drift: {drift} day(s)</Typography>
              <Slider
                value={drift}
                onChange={(_, v) => setDrift(v as number)}
                min={0}
                max={7}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>

            <Alert severity={result.matches.length > 0 ? 'success' : 'info'}>
              <strong>{result.matches.length}</strong> comment(s) will be applied to{' '}
              {transactions.length} staged transaction(s).
              {result.unparseableCount > 0 &&
                ` ${result.unparseableCount} CSV row(s) were skipped (unparseable amount or date).`}
            </Alert>

            <ConflictsSection conflicts={result.conflicts} />

            <SummaryList
              title="CSV rows in range but unmatched"
              total={result.inRangeUnmatched.length}
              rows={result.inRangeUnmatched.slice(0, PREVIEW_ROWS).map((row) => ({
                key: row.id,
                left: describeRowDate(row),
                amount: row.amountCents !== null ? row.amountCents / 100 : 0,
                text: row.comment,
              }))}
            />

            <SummaryList
              title="Staged transactions without a comment"
              total={noCommentTxs.length}
              rows={noCommentTxs.slice(0, PREVIEW_ROWS).map((tx) => ({
                key: tx.id,
                left: tx.date,
                amount: tx.amount,
                text: tx.description,
              }))}
            />

            {applyError && <Alert severity="error">{applyError}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {step === 1 && <Button onClick={() => setStep(0)}>Back</Button>}
        {step === 0 ? (
          <Button
            variant="contained"
            disabled={!canProceed || !!parseError}
            onClick={() => setStep(1)}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={result.matches.length === 0 || applying}
            onClick={handleApply}
          >
            Apply {result.matches.length} comment(s)
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

interface SummaryRow {
  key: number;
  left: string;
  amount: number;
  text: string;
}

/** A "total + first N" list used for the unmatched / no-comment summaries. */
function SummaryList({ title, total, rows }: { title: string; total: number; rows: SummaryRow[] }) {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {title}: {total}
        {total > rows.length && ` (showing first ${rows.length})`}
      </Typography>
      {total === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell sx={{ whiteSpace: 'nowrap', width: 160 }}>{row.left}</TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>
                    {formatCurrency(row.amount)}
                  </TableCell>
                  <TableCell>{row.text}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

/** Read-only listing of conflicts; the user resolves them via the drift slider. */
function ConflictsSection({ conflicts }: { conflicts: ConflictGroup[] }) {
  return (
    <Box>
      <Typography
        variant="subtitle2"
        gutterBottom
        color={conflicts.length > 0 ? 'error' : 'inherit'}
      >
        Conflicts: {conflicts.length}
      </Typography>
      {conflicts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            These groups have an unequal number of CSV rows and transactions. Adjust the drift
            slider to resolve them; unresolved conflicts are left unchanged.
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableBody>
                {conflicts.map((group, i) => (
                  <TableRow key={i} sx={{ verticalAlign: 'top' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Typography variant="caption" color="text.secondary">
                        {group.rows.length} CSV row(s)
                      </Typography>
                      {group.rows.map((row) => (
                        <Typography key={row.id} variant="body2">
                          {describeRowDate(row)} ·{' '}
                          {formatCurrency(row.amountCents !== null ? row.amountCents / 100 : 0)} ·{' '}
                          {row.comment}
                        </Typography>
                      ))}
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Typography variant="caption" color="text.secondary">
                        {group.txs.length} transaction(s)
                      </Typography>
                      {group.txs.map((tx) => (
                        <Typography key={tx.id} variant="body2">
                          {tx.date} · {formatCurrency(tx.amount)} · {tx.description}
                        </Typography>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
