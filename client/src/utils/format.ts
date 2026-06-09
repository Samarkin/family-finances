export const getMonthsBetween = (start: string, end: string): string[] => {
  const months: string[] = [];
  if (!start || !end || start === 'null' || end === 'null') return months;
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(endYear) || isNaN(endMonth)) return months;
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

export const parseMonth = (monthStr: string): Date => {
  const [year, month] = monthStr.split('-');
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1);
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const formatCurrency = (amount: number): string => currencyFormatter.format(amount);

const monthLongFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const monthShortFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const monthOnlyFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
const yearShortFormatter = new Intl.DateTimeFormat('en-US', { year: '2-digit' });

export const formatMonthLong = (monthStr: string): string =>
  monthLongFormatter.format(parseMonth(monthStr));

export const formatMonthShort = (monthStr: string): string =>
  monthShortFormatter.format(parseMonth(monthStr));

export const formatMonthCompact = (monthStr: string): string => {
  const date = parseMonth(monthStr);
  return `${monthOnlyFormatter.format(date)} '${yearShortFormatter.format(date)}`;
};
