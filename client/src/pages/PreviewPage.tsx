import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  personId?: string;
}

interface PreviewData {
  filename: string;
  transactions: StagedTransaction[];
  duplicateCount: number;
  accountId: number | null;
  sign: boolean;
}

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PreviewData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    try {
      const response = await fetch(`/api/preview/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch preview data');
      }
      const previewData = await response.json();
      setData(previewData);
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
    } catch (_err) {
      setModalError('An unexpected error occurred');
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="warning">No data found</Alert>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Preview: {data.filename}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, alignItems: 'center', mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="account-select-label">Account</InputLabel>
          <Select
            labelId="account-select-label"
            value={data.accountId || ''}
            label="Account"
            onChange={handleAccountChange}
          >
            <MenuItem value="">
              <em>None</em>
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

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="subtitle1">
          Total Transactions: {data.transactions.length} | Duplicates: {data.duplicateCount}
        </Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Raw Category</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{tx.date}</TableCell>
                <TableCell>{tx.description}</TableCell>
                <TableCell align="right">{tx.amount.toFixed(2)}</TableCell>
                <TableCell>{tx.rawCategory || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
    </Box>
  );
}
