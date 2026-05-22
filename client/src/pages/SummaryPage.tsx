import { useState, useEffect, useMemo } from 'react';
import { Typography, Box, Paper, Grid, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface MonthData {
  month: string;
  spendings: number[];
  totalSpent: number;
  totalEarned: number;
  transactionCount: number;
}

interface SummaryData {
  data: MonthData[];
  categories: Category[];
  allTimeSpendings: number[];
  totalSpent: number;
  totalEarned: number;
  transactionCount: number;
  totalMonths: number;
}

interface PieDataPoint {
  name: string;
  value: number;
  color: string;
  id: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const parseMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1);
};

const formatMonthShort = (monthStr: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
    parseMonth(monthStr),
  );

const formatMonthLong = (monthStr: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(parseMonth(monthStr));

const formatMonthCompact = (monthStr: string) => {
  const date = parseMonth(monthStr);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const year = new Intl.DateTimeFormat('en-US', { year: '2-digit' }).format(date);
  return `${month} '${year}`;
};

function SummaryPieChart({
  title,
  data,
  onPieClick,
  footer,
}: {
  title: string;
  data: PieDataPoint[];
  onPieClick: () => void;
  footer: React.ReactNode;
}) {
  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 400 }}>
      <Typography variant="subtitle1" gutterBottom>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius="95%"
            dataKey="value"
            onClick={onPieClick}
            style={{ cursor: 'pointer' }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown) =>
              typeof value === 'number' ? formatCurrency(value) : String(value ?? '')
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
        {footer}
      </Typography>
    </Paper>
  );
}

export default function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/summary')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch summary data');
        return res.json();
      })
      .then((data) => {
        setSummaryData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const pieTotalData = useMemo(() => {
    if (!summaryData) return [];
    return summaryData.categories
      .map((cat, index) => ({
        name: cat.name,
        value: summaryData.allTimeSpendings[index],
        color: cat.color,
        id: cat.id,
      }))
      .filter((item) => item.value > 0);
  }, [summaryData]);

  const averages = useMemo(() => {
    if (!summaryData || summaryData.data.length === 0) return null;
    const numMonths = summaryData.data.length;
    const totalSpent = summaryData.data.reduce((sum, month) => sum + month.totalSpent, 0);
    const totalEarned = summaryData.data.reduce((sum, month) => sum + month.totalEarned, 0);
    const totalTransactions = summaryData.data.reduce(
      (sum, month) => sum + month.transactionCount,
      0,
    );

    const categoryAverages = summaryData.categories
      .map((cat, index) => {
        const totalForCategory = summaryData.data.reduce(
          (sum, month) => sum + month.spendings[index],
          0,
        );
        return {
          name: cat.name,
          value: totalForCategory / numMonths,
          color: cat.color,
          id: cat.id,
        };
      })
      .filter((item) => item.value > 0);

    return {
      spent: totalSpent / numMonths,
      earned: totalEarned / numMonths,
      transactions: totalTransactions / numMonths,
      startMonth: summaryData.data[0].month,
      endMonth: summaryData.data[summaryData.data.length - 1].month,
      categoryAverages,
    };
  }, [summaryData]);

  const areaChartData = useMemo(() => {
    if (!summaryData) return [];
    return summaryData.data.map((monthData) => {
      const obj: Record<string, string | number> = { month: monthData.month };
      summaryData.categories.forEach((cat, index) => {
        obj[cat.id] = Math.max(0, monthData.spendings[index]);
      });
      return obj;
    });
  }, [summaryData]);

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

  if (!summaryData || summaryData.transactionCount === 0) {
    return (
      <Box sx={{ m: 2 }}>
        <Typography variant="h4" gutterBottom>
          Summary
        </Typography>
        <Alert severity="info">No transactions found. Upload some files to see the summary.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Summary
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SummaryPieChart
            title={`Total Spendings (${summaryData.totalMonths} months)`}
            data={pieTotalData}
            onPieClick={() => navigate('/transactions')}
            footer={
              <>
                Total: {summaryData.transactionCount} transactions | Spent:{' '}
                {formatCurrency(summaryData.totalSpent)} | Earned:{' '}
                {formatCurrency(summaryData.totalEarned)}
              </>
            }
          />
        </Grid>

        {averages && (
          <Grid size={{ xs: 12, md: 6 }}>
            <SummaryPieChart
              title={`Average Spendings (${formatMonthShort(averages.startMonth)} - ${formatMonthShort(averages.endMonth)})`}
              data={averages.categoryAverages}
              onPieClick={() => navigate('/transactions')}
              footer={
                <>
                  Avg: {averages.transactions.toFixed(1)} transactions | Spent:{' '}
                  {formatCurrency(averages.spent)} | Earned: {formatCurrency(averages.earned)}
                </>
              }
            />
          </Grid>
        )}

        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 500 }}>
            <Typography variant="subtitle1" gutterBottom>
              12-Month Spending Trend
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={formatMonthCompact} />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  labelFormatter={(label: unknown) =>
                    typeof label === 'string' ? formatMonthLong(label) : ''
                  }
                  formatter={(value: unknown) =>
                    typeof value === 'number' ? formatCurrency(value) : String(value ?? '')
                  }
                />
                {summaryData.categories.map((cat) => (
                  <Area
                    key={cat.id}
                    type="monotone"
                    dataKey={cat.id}
                    stackId="1"
                    stroke={cat.color}
                    fill={cat.color}
                    fillOpacity={1}
                    name={cat.name}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
