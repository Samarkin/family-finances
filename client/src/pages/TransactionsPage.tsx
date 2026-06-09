import { useState, useCallback, useEffect, useMemo } from 'react';
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
  Popover,
  TextField,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  ChatBubble as ChatBubbleIcon,
  ChatBubbleOutlineOutlined as ChatBubbleOutlineIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataGrid } from '@mui/x-data-grid';
import type {
  GridColDef,
  GridPaginationModel,
  GridSortModel,
  GridRowModel,
} from '@mui/x-data-grid';

interface TransactionData {
  id: string;
  date: string;
  description: string;
  categoryId: string;
  amount: number;
  accountId: number;
  personId: number;
  comment: string | null;
}

export default function TransactionsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const monthParam = searchParams.get('month') || 'All Time';
  const categoryParam = searchParams.get('category') || 'all';

  const [data, setData] = useState<TransactionData[]>([]);
  const [persons, setPersons] = useState<Record<number, string>>({});
  const [accounts, setAccounts] = useState<Record<number, string>>({});
  const [categories, setCategories] = useState<Record<string, { name: string; isIncome: boolean }>>(
    {},
  );
  const [totalCount, setTotalCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [netPayments, setNetPayments] = useState(0);

  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 20,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);

  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const [commentAnchor, setCommentAnchor] = useState<HTMLElement | null>(null);
  const [commentTxId, setCommentTxId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('count', paginationModel.pageSize.toString());
      params.set('offset', (paginationModel.page * paginationModel.pageSize).toString());

      if (monthParam !== 'All Time') {
        params.set('month', monthParam);
      }

      if (categoryParam !== 'all') {
        params.set('category', categoryParam);
      }

      if (sortModel.length > 0) {
        const { field, sort } = sortModel[0];
        if (sort) {
          params.set('sort', `${field}:${sort}`);
        }
      }

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch transactions');
      }
      const json = await res.json();

      setData(json.data || []);
      setTotalCount(json.totalCount || 0);
      setTotalSpent(json.totalSpent || 0);
      setTotalEarned(json.totalEarned || 0);
      setNetPayments(json.netPayments || 0);
      setPersons(json.persons || []);
      setAccounts(json.accounts || []);
      setCategories(json.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [paginationModel.page, paginationModel.pageSize, monthParam, categoryParam, sortModel]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  useEffect(() => {
    async function fetchMonths() {
      try {
        const res = await fetch('/api/transactions/months');
        if (res.ok) {
          const json = await res.json();
          setAvailableMonths(json.months || []);
        }
      } catch (err) {
        console.error('Failed to fetch months:', err);
      }
    }
    void fetchMonths();
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Upload failed');
        }

        const { fileStageId } = await response.json();
        navigate(`/preview/${fileStageId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsUploading(false);
      }
    },
    [navigate],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'text/csv') {
        handleUpload(file);
      } else {
        setError('Please upload a CSV file.');
      }
    },
    [handleUpload],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  const handleCommentOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>, txId: string, currentComment: string | null) => {
      e.stopPropagation();
      setCommentTxId(txId);
      setCommentText(currentComment ?? '');
      setCommentAnchor(e.currentTarget);
    },
    [],
  );

  const handleCommentClose = useCallback(() => {
    setCommentAnchor(null);
    setCommentTxId(null);
  }, []);

  const processRowUpdate = useCallback(
    async (newRow: GridRowModel, oldRow: GridRowModel) => {
      const updates: { personId?: number; categoryId?: string } = {};
      if (newRow.personId !== oldRow.personId) updates.personId = newRow.personId as number;
      if (newRow.categoryId !== oldRow.categoryId) updates.categoryId = newRow.categoryId as string;

      if (Object.keys(updates).length === 0) return oldRow;

      const res = await fetch(`/api/transactions/${newRow.id as string}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error((errData as { error?: string }).error || 'Failed to update transaction');
      }

      await fetchTransactions();
      return newRow;
    },
    [fetchTransactions],
  );

  const handleProcessRowUpdateError = useCallback((err: Error) => {
    setError(err.message || 'Failed to update transaction');
  }, []);

  const handleCommentSave = useCallback(async () => {
    if (!commentTxId) return;
    setCommentSaving(true);
    try {
      const res = await fetch(`/api/transactions/${commentTxId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText || null }),
      });
      if (res.ok) {
        setData((prev) =>
          prev.map((tx) => (tx.id === commentTxId ? { ...tx, comment: commentText || null } : tx)),
        );
        handleCommentClose();
      }
    } catch (err) {
      console.error('Failed to save comment:', err);
    } finally {
      setCommentSaving(false);
    }
  }, [commentTxId, commentText, handleCommentClose]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }),
    [],
  );

  const monthFormatters = useMemo(
    () => ({
      long: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }),
      short: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }),
    }),
    [],
  );

  const formatMonth = useCallback(
    (monthStr: string, short = false) => {
      if (monthStr === 'All Time') return monthStr;
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return monthFormatters[short ? 'short' : 'long'].format(date);
    },
    [monthFormatters],
  );

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'date',
        headerName: 'Date',
        width: 120,
      },
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
      {
        field: 'amount',
        headerName: 'Amount',
        width: 120,
        type: 'number',
        renderCell: (params) => {
          const amount = params.value as number;
          const categoryId = params.row.categoryId as string;
          const category = categories[categoryId];
          const isIncome = category?.isIncome;
          const isAnomaly = isIncome ? amount > 0 : amount < 0;
          const formattedAmount = currencyFormatter.format(amount);
          return <span style={{ color: isAnomaly ? 'red' : 'inherit' }}>{formattedAmount}</span>;
        },
      },
      {
        field: 'categoryId',
        headerName: 'Category',
        width: 130,
        editable: true,
        type: 'singleSelect',
        valueOptions: Object.entries(categories).map(([id, cat]) => ({
          value: id,
          label: cat.name,
        })),
      },
      {
        field: 'personId',
        headerName: 'Person',
        width: 150,
        editable: true,
        type: 'singleSelect',
        valueOptions: Object.entries(persons).map(([id, name]) => ({
          value: Number(id),
          label: name,
        })),
      },
      {
        field: 'accountId',
        headerName: 'Account',
        width: 180,
        valueGetter: (value?: number) => (value ? accounts[value] || value : value),
      },
      {
        field: 'comment',
        headerName: '',
        width: 40,
        sortable: false,
        renderCell: (params) => {
          const comment = params.value as string | null;
          return (
            <Tooltip title={comment ?? <em>No comment</em>}>
              <IconButton
                size="small"
                aria-label="comment"
                onClick={(e) => handleCommentOpen(e, params.row.id as string, comment)}
              >
                {comment ? (
                  <ChatBubbleIcon fontSize="small" color="primary" />
                ) : (
                  <ChatBubbleOutlineIcon fontSize="small" color="disabled" />
                )}
              </IconButton>
            </Tooltip>
          );
        },
      },
    ],
    [persons, accounts, categories, currencyFormatter, handleCommentOpen],
  );

  const dropdownMonths = useMemo(() => {
    const months = ['All Time', ...availableMonths];
    if (monthParam !== 'All Time' && !months.includes(monthParam)) {
      months.push(monthParam);
    }
    return months;
  }, [availableMonths, monthParam]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Typography variant="h4" gutterBottom>
        Transactions
      </Typography>

      <Paper
        variant="outlined"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        sx={{
          p: 3,
          mb: 3,
          textAlign: 'center',
          backgroundColor: '#fafafa',
          borderStyle: 'dashed',
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#f0f0f0' },
        }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input type="file" id="file-input" accept=".csv" hidden onChange={onFileChange} />
        <UploadIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
        <Typography variant="h6">Drag & drop a CSV file here or click to browse</Typography>
        {isUploading && (
          <Box sx={{ mt: 1 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2" component="span">
              Uploading...
            </Typography>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
        <Box>
          <Typography variant="h6">
            {(() => {
              const catName =
                categoryParam !== 'all' ? (categories[categoryParam]?.name ?? categoryParam) : null;
              if (catName) {
                return monthParam === 'All Time'
                  ? `${catName}: All Time`
                  : `${catName}: ${formatMonth(monthParam)}`;
              }
              return monthParam === 'All Time'
                ? 'All Transactions'
                : `Transactions: ${formatMonth(monthParam)}`;
            })()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total: {totalCount} | Spent: {currencyFormatter.format(totalSpent)} | Earned:{' '}
            {currencyFormatter.format(totalEarned)} | Payments:{' '}
            {currencyFormatter.format(netPayments)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryParam}
              label="Category"
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  searchParams.delete('category');
                } else {
                  searchParams.set('category', val);
                }
                setSearchParams(searchParams);
                setPaginationModel((prev) => ({ ...prev, page: 0 }));
              }}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {Object.entries(categories).map(([id, cat]) => (
                <MenuItem key={id} value={id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={monthParam}
              label="Month"
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'All Time') {
                  searchParams.delete('month');
                } else {
                  searchParams.set('month', val);
                }
                setSearchParams(searchParams);
                setPaginationModel((prev) => ({ ...prev, page: 0 }));
              }}
            >
              {dropdownMonths.map((m) => (
                <MenuItem key={m} value={m}>
                  {formatMonth(m, true)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, width: '100%', minHeight: 0 }}>
        <DataGrid
          sx={{ height: '100%' }}
          rows={data}
          columns={columns}
          rowCount={totalCount}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={(newModel) => {
            setSortModel(newModel);
            setPaginationModel((prev) => ({ ...prev, page: 0 }));
          }}
          pageSizeOptions={[20, 50, 100]}
          disableRowSelectionOnClick
          disableColumnMenu
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={handleProcessRowUpdateError}
        />
      </Box>

      <Popover
        open={!!commentAnchor}
        anchorEl={commentAnchor}
        onClose={handleCommentClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 300 }}>
          <Typography variant="subtitle2" gutterBottom>
            Comment
          </Typography>
          <TextField
            multiline
            rows={3}
            fullWidth
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            autoFocus
          />
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" onClick={handleCommentClose}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleCommentSave}
              disabled={commentSaving}
            >
              Save
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
