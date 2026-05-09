import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TableSortLabel,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';

interface Account {
  id: number;
  name: string;
}

interface StagedTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  rawCategory?: string;
  categoryId?: string;
  personId?: number;
}

interface PreviewData {
  filename: string;
  transactions: StagedTransaction[];
  duplicateCount: number;
  accountId: number | null;
  sign: boolean;
  categories: Record<string, string>;
  persons: Record<number, string>;
}

type Order = 'asc' | 'desc';

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [data, setData] = useState<PreviewData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection & Sort state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof StagedTransaction>('date');
  const [showOnlyNeedsReview, setShowOnlyNeedsReview] = useState(true);
  const [, setHasInitializedFilter] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [personModalError, setPersonModalError] = useState<string | null>(null);

  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      const response = await fetch(`/api/preview/${id}/submit`, { method: 'POST' });
      if (response.ok) {
        navigate('/transactions');
      } else {
        const errData = await response.json();
        setSubmitError(errData.error || 'Failed to submit data');
      }
    } catch {
      setSubmitError('An unexpected error occurred');
    }
  };

  const handleDiscard = async () => {
    try {
      const response = await fetch(`/api/preview/${id}/discard`, { method: 'POST' });
      if (response.ok) {
        navigate('/transactions');
      }
    } catch (err) {
      console.error('Failed to discard:', err);
    }
  };

  const fetchPreview = useCallback(async () => {
    try {
      const response = await fetch(`/api/preview/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch preview data');
      }
      const previewData = await response.json();
      setData(previewData);

      // Initialize the filter based on the initial fetch
      setHasInitializedFilter((prev) => {
        if (!prev) {
          const allReviewed = previewData.transactions.every(
            (tx: StagedTransaction) => tx.categoryId && tx.personId,
          );
          setShowOnlyNeedsReview(!allReviewed);
          return true;
        }
        return prev;
      });

      // Clear selection if transactions changed significantly
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  }, [id]);

  const fetchAccounts = useCallback(async () => {
    try {
      const accountsResponse = await fetch('/api/accounts');
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await fetchAccounts();
        await fetchPreview();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [fetchAccounts, fetchPreview]);

  const updateAccount = async (accountId: number | null) => {
    try {
      const response = await fetch(`/api/preview/${id}/account`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (response.ok) {
        fetchPreview();
      }
    } catch (err) {
      console.error('Failed to update account:', err);
    }
  };

  const handleAccountChange = async (event: SelectChangeEvent<number | string>) => {
    const value = event.target.value;
    if (value === 'ADD_NEW') {
      setIsModalOpen(true);
      return;
    }
    const accountId = value === '' ? null : (value as number);
    await updateAccount(accountId);
  };

  const handleSignToggle = async () => {
    try {
      const response = await fetch(`/api/preview/${id}/sign`, {
        method: 'PUT',
      });
      if (response.ok) {
        fetchPreview();
      }
    } catch (err) {
      console.error('Failed to toggle sign:', err);
    }
  };

  const ensureSelected = (txId: number) => {
    if (!selectedIds.has(txId)) {
      const next = new Set(selectedIds);
      next.add(txId);
      setSelectedIds(next);
    }
  };

  const handleBulkUpdate = async (
    ids: number[],
    categoryId?: string,
    personId?: number | string,
  ) => {
    if (ids.length === 0) return;
    if (categoryId === undefined && personId === undefined) return;

    try {
      const response = await fetch(`/api/preview/${id}/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          categoryId: categoryId || undefined,
          personId: personId || undefined,
        }),
      });

      if (response.ok) {
        fetchPreview();
      }
    } catch (err) {
      console.error('Bulk update failed:', err);
    }
  };

  const handleInlineChange = async (field: 'categoryId' | 'personId', value: string | number) => {
    // Row is already selected via onOpen
    const idsToUpdate = Array.from(selectedIds);

    if (field === 'categoryId') {
      await handleBulkUpdate(idsToUpdate, value as string, undefined);
    } else {
      await handleBulkUpdate(idsToUpdate, undefined, value as number);
    }
  };

  const handlePersonModalClose = () => {
    setIsPersonModalOpen(false);
    setNewPersonName('');
    setPersonModalError(null);
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) {
      setPersonModalError('Person name is required');
      return;
    }

    try {
      const response = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPersonName.trim() }),
      });

      if (response.ok) {
        const newPerson = await response.json();
        const idsToUpdate = Array.from(selectedIds);
        await handleBulkUpdate(idsToUpdate, undefined, newPerson.id);
        handlePersonModalClose();
      } else {
        const errData = await response.json();
        setPersonModalError(errData.error || 'Failed to create person');
      }
    } catch {
      setPersonModalError('An unexpected error occurred');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setNewAccountName('');
    setModalError(null);
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      setModalError('Account name is required');
      return;
    }

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAccountName.trim() }),
      });

      if (response.ok) {
        const newAccount = await response.json();
        await fetchAccounts();
        await updateAccount(newAccount.id);
        handleModalClose();
      } else {
        const errData = await response.json();
        setModalError(errData.error || 'Failed to create account');
      }
    } catch {
      setModalError('An unexpected error occurred');
    }
  };

  const handleRequestSort = (property: keyof StagedTransaction) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedTransactions = useMemo(() => {
    if (!data) return [];

    let txs = data.transactions;
    if (showOnlyNeedsReview) {
      txs = txs.filter((tx) => !tx.categoryId || !tx.personId);
    }

    return [...txs].sort((a, b) => {
      let aVal: string | number = a[orderBy] as string | number;
      let bVal: string | number = b[orderBy] as string | number;

      // For personId and categoryId, sort by name instead of id if possible
      if (orderBy === 'personId') {
        aVal = a.personId ? data.persons[a.personId] || '' : '';
        bVal = b.personId ? data.persons[b.personId] || '' : '';
      } else if (orderBy === 'categoryId') {
        aVal = a.categoryId ? data.categories[a.categoryId] || '' : '';
        bVal = b.categoryId ? data.categories[b.categoryId] || '' : '';
      }

      // Fallback
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, order, orderBy, showOnlyNeedsReview]);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked && sortedTransactions.length > 0) {
      setSelectedIds(new Set(sortedTransactions.map((tx) => tx.id)));
    } else {
      setSelectedIds(new Set());
    }
    setLastSelectedId(null);
  };

  const handleRowClick = (
    event: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    txId: number,
  ) => {
    if (event.shiftKey && lastSelectedId !== null) {
      const currentIndex = sortedTransactions.findIndex((tx) => tx.id === txId);
      const lastIndex = sortedTransactions.findIndex((tx) => tx.id === lastSelectedId);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);

        const next = new Set(selectedIds);
        for (let i = start; i <= end; i++) {
          next.add(sortedTransactions[i].id);
        }
        setSelectedIds(next);
        setLastSelectedId(txId);
        return;
      }
    }

    const next = new Set(selectedIds);
    if (next.has(txId)) {
      next.delete(txId);
      setLastSelectedId(null);
    } else {
      next.add(txId);
      setLastSelectedId(txId);
    }
    setSelectedIds(next);
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="warning">No data found</Alert>;

  const allSelected =
    sortedTransactions.length > 0 && sortedTransactions.every((tx) => selectedIds.has(tx.id));
  const hasRawCategory = data.transactions.some((tx) => !!tx.rawCategory);
  const needsReviewCount = data.transactions.filter((tx) => !tx.categoryId || !tx.personId).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
      <Typography variant="h4" gutterBottom>
        Preview: {data.filename}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, alignItems: 'center', mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }} error={!data.accountId}>
          <InputLabel id="account-select-label" shrink>
            Account
          </InputLabel>
          <Select
            labelId="account-select-label"
            value={data.accountId || ''}
            label="Account"
            onChange={handleAccountChange}
            displayEmpty
          >
            <MenuItem value="" disabled>
              <em>Select...</em>
            </MenuItem>
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.name}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem value="ADD_NEW" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
              Add new...
            </MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Switch checked={data.sign} onChange={handleSignToggle} />}
          label="Invert Signs"
        />

        <FormControlLabel
          control={
            <Switch
              checked={showOnlyNeedsReview}
              onChange={(e) => setShowOnlyNeedsReview(e.target.checked)}
            />
          }
          label={
            <Box component="span" sx={{ display: 'inline-flex', gap: 0.5 }}>
              Needs Review
              <Typography
                component="span"
                sx={{ color: needsReviewCount > 0 ? 'error.main' : 'inherit' }}
              >
                ({needsReviewCount})
              </Typography>
            </Box>
          }
        />

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="subtitle1">
          Total Transactions: {data.transactions.length} | Duplicates:{' '}
          <Box component="span" sx={{ fontWeight: data.duplicateCount > 0 ? 'bold' : 'normal' }}>
            {data.duplicateCount}
          </Box>
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ flexGrow: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={
                    selectedIds.size > 0 && selectedIds.size < data.transactions.length
                  }
                  checked={allSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ width: 110 }}>
                <TableSortLabel
                  active={orderBy === 'date'}
                  direction={orderBy === 'date' ? order : 'asc'}
                  onClick={() => handleRequestSort('date')}
                >
                  Date
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'description'}
                  direction={orderBy === 'description' ? order : 'asc'}
                  onClick={() => handleRequestSort('description')}
                >
                  Description
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ width: 100 }}>
                <TableSortLabel
                  active={orderBy === 'amount'}
                  direction={orderBy === 'amount' ? order : 'asc'}
                  onClick={() => handleRequestSort('amount')}
                >
                  Expense
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ width: 130 }}>
                <TableSortLabel
                  active={orderBy === 'personId'}
                  direction={orderBy === 'personId' ? order : 'asc'}
                  onClick={() => handleRequestSort('personId')}
                >
                  Person
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ width: 200 }}>
                <TableSortLabel
                  active={orderBy === 'categoryId'}
                  direction={orderBy === 'categoryId' ? order : 'asc'}
                  onClick={() => handleRequestSort('categoryId')}
                >
                  Category
                </TableSortLabel>
              </TableCell>
              {hasRawCategory && (
                <TableCell sx={{ width: 150 }}>
                  <TableSortLabel
                    active={orderBy === 'rawCategory'}
                    direction={orderBy === 'rawCategory' ? order : 'asc'}
                    onClick={() => handleRequestSort('rawCategory')}
                  >
                    Raw Category
                  </TableSortLabel>
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedTransactions.map((tx) => (
              <TableRow
                key={tx.id}
                selected={selectedIds.has(tx.id)}
                hover
                onClick={(e) => handleRowClick(e, tx.id)}
                onMouseDown={(e) => {
                  if (e.shiftKey) {
                    e.preventDefault();
                  }
                }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell padding="checkbox">
                  <Checkbox checked={selectedIds.has(tx.id)} />
                </TableCell>
                <TableCell>{tx.date}</TableCell>
                <TableCell>{tx.description}</TableCell>
                <TableCell align="right">{tx.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                    <Select
                      value={tx.personId || ''}
                      displayEmpty
                      onChange={(e) => {
                        if (String(e.target.value) === 'ADD_NEW') {
                          setIsPersonModalOpen(true);
                        } else {
                          handleInlineChange('personId', e.target.value as number);
                        }
                      }}
                      onOpen={() => ensureSelected(tx.id)}
                      error={!tx.personId}
                      sx={{ fontSize: '0.875rem' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MenuItem value="" disabled sx={{ fontSize: '0.875rem' }}>
                        <em>Select...</em>
                      </MenuItem>
                      {Object.entries(data.persons).map(([personId, name]) => (
                        <MenuItem key={personId} value={personId} sx={{ fontSize: '0.875rem' }}>
                          {name}
                        </MenuItem>
                      ))}
                      <Divider />
                      <MenuItem
                        value="ADD_NEW"
                        sx={{ fontStyle: 'italic', color: 'primary.main', fontSize: '0.875rem' }}
                      >
                        Add new...
                      </MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                    <Select
                      value={tx.categoryId || ''}
                      displayEmpty
                      onChange={(e) => handleInlineChange('categoryId', e.target.value as string)}
                      onOpen={() => ensureSelected(tx.id)}
                      error={!tx.categoryId}
                      sx={{ fontSize: '0.875rem' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MenuItem value="" disabled sx={{ fontSize: '0.875rem' }}>
                        <em>Select...</em>
                      </MenuItem>
                      {Object.entries(data.categories).map(([id, name]) => (
                        <MenuItem key={id} value={id} sx={{ fontSize: '0.875rem' }}>
                          {name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                {hasRawCategory && <TableCell>{tx.rawCategory || '-'}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          mt: 2,
          mb: 2,
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        {submitError && (
          <Alert severity="error" sx={{ flexGrow: 1 }}>
            {submitError}
          </Alert>
        )}
        <Button variant="outlined" onClick={() => setIsDiscardDialogOpen(true)}>
          Discard
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={needsReviewCount > 0 || !data.accountId}
        >
          Submit
        </Button>
      </Box>

      <Dialog open={isModalOpen} onClose={handleModalClose} fullWidth maxWidth="sm">
        <DialogTitle>Add New Account</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Account Name"
            fullWidth
            variant="standard"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            error={!!modalError}
            helperText={modalError}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateAccount();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleModalClose}>Cancel</Button>
          <Button onClick={handleCreateAccount} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isPersonModalOpen} onClose={handlePersonModalClose} fullWidth maxWidth="sm">
        <DialogTitle>Add New Person</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Person Name"
            fullWidth
            variant="standard"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            error={!!personModalError}
            helperText={personModalError}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreatePerson();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePersonModalClose}>Cancel</Button>
          <Button onClick={handleCreatePerson} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isDiscardDialogOpen}
        onClose={() => setIsDiscardDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Discard File?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to discard this file? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDiscardDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDiscard} color="error" variant="contained">
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
