import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Box,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip as MuiTooltip,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  Line,
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
  isIncome?: boolean;
}

interface MonthData {
  month: string;
  spendings: number[];
  spendingCount: number;
  incomeCount: number;
}

interface SummaryData {
  data: MonthData[];
  categories: Category[];
  hasPrev: boolean;
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

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PieDataPoint }[];
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <Box sx={{ backgroundColor: 'white', p: 1.5, border: '1px solid #ccc' }}>
        <Typography sx={{ color: data.color, fontSize: '1.1rem', fontWeight: 500, mb: 0.5 }}>
          {data.name}
        </Typography>
        <Typography variant="body2" sx={{ color: data.color }}>
          Monthly: {formatCurrency(data.value)}
        </Typography>
        <Typography variant="body2" sx={{ color: data.color }}>
          Annual: {formatCurrency(data.value * 12)}
        </Typography>
      </Box>
    );
  }
  return null;
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
          <Tooltip content={<CustomTooltip />} />
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
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/summary?offset=${offset}`);
        if (!res.ok) throw new Error('Failed to fetch summary data');
        const data = await res.json();
        if (active) {
          setSummaryData(data);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to fetch summary data');
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => {
      active = false;
    };
  }, [offset]);

  const averages = useMemo(() => {
    if (!summaryData || summaryData.data.length === 0) return null;
    const numMonths = summaryData.data.length;

    let totalSpentAllMonths = 0;
    let totalEarnedAllMonths = 0;
    let totalSpendingTransactions = 0;
    let totalIncomeTransactions = 0;

    summaryData.data.forEach((month) => {
      totalSpendingTransactions += month.spendingCount;
      totalIncomeTransactions += month.incomeCount;
    });

    const categoryAverages = summaryData.categories.map((cat, index) => {
      const totalForCategory = summaryData.data.reduce(
        (sum, month) => sum + month.spendings[index],
        0,
      );

      if (cat.isIncome) {
        totalEarnedAllMonths -= totalForCategory;
      } else {
        totalSpentAllMonths += totalForCategory;
      }

      return {
        name: cat.name,
        value: totalForCategory / numMonths,
        color: cat.color,
        id: cat.id,
        isIncome: !!cat.isIncome,
      };
    });

    return {
      spent: totalSpentAllMonths / numMonths,
      earned: totalEarnedAllMonths / numMonths,
      spendingTransactions: totalSpendingTransactions / numMonths,
      incomeTransactions: totalIncomeTransactions / numMonths,
      startMonth: summaryData.data[0].month,
      endMonth: summaryData.data[summaryData.data.length - 1].month,
      categoryAverages,
    };
  }, [summaryData]);

  const pieAvgSpendingsData = useMemo(() => {
    if (!averages) return [];
    return averages.categoryAverages.filter((item) => !item.isIncome && item.value > 0);
  }, [averages]);

  const pieAvgIncomeData = useMemo(() => {
    if (!averages) return [];
    return averages.categoryAverages
      .filter((item) => item.isIncome && item.value < 0)
      .map((item) => ({ ...item, value: -item.value }));
  }, [averages]);

  const areaChartData = useMemo(() => {
    if (!summaryData) return [];
    return summaryData.data.map((monthData) => {
      const obj: Record<string, string | number> = { month: monthData.month };
      let net = 0;
      summaryData.categories.forEach((cat, index) => {
        const val = monthData.spendings[index];
        obj[cat.id] = val;
        net += val;
      });
      obj.savings = net;
      return obj;
    });
  }, [summaryData]);

  if (loading && !summaryData) {
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

  if (!summaryData || summaryData.data.length === 0) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {averages
            ? `Summary (${formatMonthShort(averages.startMonth)} - ${formatMonthShort(averages.endMonth)})`
            : 'Summary'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {loading && <CircularProgress size={24} sx={{ mr: 1 }} />}
          <MuiTooltip title="Older">
            <span>
              <IconButton
                onClick={() => setOffset((prev) => prev + 1)}
                disabled={!summaryData.hasPrev || loading}
                aria-label="Older"
              >
                <ChevronLeft />
              </IconButton>
            </span>
          </MuiTooltip>
          <MuiTooltip title="Newer">
            <span>
              <IconButton
                onClick={() => setOffset((prev) => Math.max(0, prev - 1))}
                disabled={offset === 0 || loading}
                aria-label="Newer"
              >
                <ChevronRight />
              </IconButton>
            </span>
          </MuiTooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {averages && (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryPieChart
                title="Spendings"
                data={pieAvgSpendingsData}
                onPieClick={() => navigate('/transactions')}
                footer={
                  <>
                    Monthly: {averages.spendingTransactions.toFixed(1)} transactions |{' '}
                    {formatCurrency(averages.spent)}
                    <br />
                    Annual: {(averages.spendingTransactions * 12).toFixed(0)} transactions |{' '}
                    {formatCurrency(averages.spent * 12)}
                  </>
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryPieChart
                title="Income"
                data={pieAvgIncomeData}
                onPieClick={() => navigate('/transactions')}
                footer={
                  <>
                    Monthly: {averages.incomeTransactions.toFixed(1)} transactions |{' '}
                    {formatCurrency(averages.earned)}
                    <br />
                    Annual: {(averages.incomeTransactions * 12).toFixed(0)} transactions |{' '}
                    {formatCurrency(averages.earned * 12)}
                  </>
                }
              />
            </Grid>
          </>
        )}

        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 500 }}>
            <Typography variant="subtitle1" gutterBottom>
              Trend
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={areaChartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={formatMonthCompact} />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  labelFormatter={(label: React.ReactNode) =>
                    typeof label === 'string' ? formatMonthLong(label) : ''
                  }
                  formatter={(
                    value: string | number | readonly (string | number)[] | undefined,
                    name: string | number | undefined,
                  ) => {
                    if (typeof value !== 'number') return [String(value), name];
                    if (name === 'Savings') {
                      const displayValue = -value;
                      const isNegative = displayValue < 0;
                      return [
                        <strong key="val" style={{ color: isNegative ? 'red' : 'inherit' }}>
                          {formatCurrency(displayValue)}
                        </strong>,
                        name,
                      ];
                    }
                    return [formatCurrency(value), name];
                  }}
                />
                {summaryData.categories.map((cat) => (
                  <Area
                    key={cat.id}
                    type="monotone"
                    dataKey={cat.id}
                    stackId={cat.isIncome ? 'income' : 'spending'}
                    stroke={cat.color}
                    fill={cat.color}
                    fillOpacity={1}
                    name={cat.name}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="savings"
                  stroke="#000000"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Savings"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
