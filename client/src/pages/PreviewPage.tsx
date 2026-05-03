import { useEffect, useState } from 'react';
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
} from '@mui/material';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const response = await fetch(`/api/preview/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch preview data');
        }
        const previewData = await response.json();
        setData(previewData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [id]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="warning">No data found</Alert>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Preview: {data.filename}
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Total Transactions: {data.transactions.length} | Duplicates: {data.duplicateCount}
      </Typography>

      <TableContainer component={Paper} sx={{ mt: 3 }}>
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
    </Box>
  );
}
