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
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';

interface TransactionData {
  id: string;
  date: string;
  description: string;
  categoryId: string;
  amount: number;
  accountId: number;
  personId: number;
}

export default function TransactionsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const monthParam = searchParams.get('month') || 'All Time';

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

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('count', paginationModel.pageSize.toString());
      params.set('offset', (paginationModel.page * paginationModel.pageSize).toString());

      if (monthParam !== 'All Time') {
        params.set('month', monthParam);
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
  }, [paginationModel.page, paginationModel.pageSize, monthParam, sortModel]);

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
        valueGetter: (value?: string) => (value ? categories[value]?.name || value : value),
      },
      {
        field: 'personId',
        headerName: 'Person',
        width: 150,
        valueGetter: (value?: number) => (value ? persons[value] || value : value),
      },
      {
        field: 'accountId',
        headerName: 'Account',
        width: 180,
        valueGetter: (value?: number) => (value ? accounts[value] || value : value),
      },
    ],
    [persons, accounts, categories, currencyFormatter],
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
            {monthParam === 'All Time'
              ? 'All Transactions'
              : `Transactions: ${formatMonth(monthParam)}`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total: {totalCount} | Spent: {currencyFormatter.format(totalSpent)} | Earned:{' '}
            {currencyFormatter.format(totalEarned)} | Payments:{' '}
            {currencyFormatter.format(netPayments)}
          </Typography>
        </Box>

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
              setPaginationModel((prev) => ({ ...prev, page: 0 })); // reset page on filter change
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
        />
      </Box>
    </Box>
  );
}
