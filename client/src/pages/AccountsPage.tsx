import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import { CheckCircle, Pending } from '@mui/icons-material';

interface Account {
  id: number;
  name: string;
}

interface FileData {
  id: number;
  filename: string;
  accountName: string;
  range: string;
}

const getMonthsBetween = (start: string, end: string): string[] => {
  if (!start || !end || start === 'null' || end === 'null') return [];
  const months = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(endYear) || isNaN(endMonth)) return [];

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${month.toString().padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
};

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
};

export default function AccountsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [committedFiles, setCommittedFiles] = useState<FileData[]>([]);
  const [previewFiles, setPreviewFiles] = useState<FileData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, commRes, prevRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/files'),
          fetch('/api/preview-files'),
        ]);

        if (!accRes.ok || !commRes.ok || !prevRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [accData, commData, prevData] = await Promise.all([
          accRes.json(),
          commRes.json(),
          prevRes.json(),
        ]);

        setAccounts(accData);
        setCommittedFiles(commData.data);
        setPreviewFiles(prevData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const matrixData = useMemo(() => {
    const coverage: Record<
      string,
      Record<string, { type: 'committed' | 'preview'; file: string }>
    > = {};
    const allMonthsSet = new Set<string>();

    // Process committed files
    committedFiles.forEach((file) => {
      const [start, end] = file.range.split(' : ');
      const months = getMonthsBetween(start, end);
      months.forEach((m) => {
        allMonthsSet.add(m);
        if (!coverage[file.accountName]) coverage[file.accountName] = {};
        coverage[file.accountName][m] = { type: 'committed', file: file.filename };
      });
    });

    // Process preview files (committed takes precedence)
    previewFiles.forEach((file) => {
      if (!file.accountName || !file.range) return;
      const [start, end] = file.range.split(' : ');
      const months = getMonthsBetween(start, end);
      months.forEach((m) => {
        allMonthsSet.add(m);
        if (!coverage[file.accountName]) coverage[file.accountName] = {};
        if (!coverage[file.accountName][m]) {
          coverage[file.accountName][m] = { type: 'preview', file: file.filename };
        }
      });
    });

    const sortedMonths = Array.from(allMonthsSet).sort();
    // Keep only last 24 months to keep table manageable, or just show all?
    // Let's show all for now as it's likely a small list.

    return { coverage, months: sortedMonths };
  }, [committedFiles, previewFiles]);

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ m: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Typography variant="h4" gutterBottom>
        Accounts Coverage
      </Typography>

      <Box sx={{ mb: 2, display: 'flex', gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CheckCircle color="success" fontSize="small" />
          <Typography variant="body2">Committed</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Pending color="warning" fontSize="small" />
          <Typography variant="body2">In Review (Preview)</Typography>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ flexGrow: 1, maxHeight: 'calc(100vh - 250px)' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 'bold',
                  minWidth: 150,
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  backgroundColor: 'white',
                }}
              >
                Account
              </TableCell>
              {matrixData.months.map((month) => (
                <TableCell
                  key={month}
                  align="center"
                  sx={{ fontWeight: 'bold', minWidth: 80, zIndex: 2 }}
                >
                  {formatMonth(month)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id} hover>
                <TableCell
                  sx={{
                    fontWeight: 500,
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    backgroundColor: 'white',
                    borderRight: '1px solid rgba(224, 224, 224, 1)',
                  }}
                >
                  {account.name}
                </TableCell>
                {matrixData.months.map((month) => {
                  const info = matrixData.coverage[account.name]?.[month];
                  return (
                    <TableCell key={month} align="center">
                      {info ? (
                        <Tooltip title={`${info.file} (${info.type})`}>
                          {info.type === 'committed' ? (
                            <CheckCircle color="success" fontSize="small" />
                          ) : (
                            <Pending color="warning" fontSize="small" />
                          )}
                        </Tooltip>
                      ) : (
                        <Box sx={{ width: 20, height: 20, mx: 'auto' }} />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
