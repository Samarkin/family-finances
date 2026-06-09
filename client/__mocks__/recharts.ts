import React from 'react';

export const ResponsiveContainer = ({ children }: { children: React.ReactNode }) =>
  React.createElement('div', { style: { width: '800px', height: '400px' } }, children);

export const PieChart = ({ children }: { children: React.ReactNode }) =>
  React.createElement('div', { 'data-testid': 'mock-pie-chart' }, children);

export const Pie = ({
  data,
  onClick,
}: {
  data: { id: string; name: string; value: number }[];
  onClick?: (entry: { id: string; name: string; value: number }) => void;
}) =>
  React.createElement(
    'div',
    null,
    ...(data ?? []).map((entry) =>
      React.createElement(
        'button',
        {
          key: entry.id,
          'data-testid': `pie-slice-${entry.id}`,
          onClick: () => onClick?.(entry),
        },
        entry.name,
      ),
    ),
  );

export const ComposedChart = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: (data: { activeLabel?: string }) => void;
}) =>
  React.createElement(
    'div',
    { 'data-testid': 'mock-composed-chart', onClick: () => onClick?.({ activeLabel: '2023-09' }) },
    children,
  );

export const Area = ({
  dataKey,
  onClick,
}: {
  dataKey: string;
  onClick?: (entry: Record<string, unknown>) => void;
}) =>
  React.createElement('div', {
    'data-testid': `mock-area-${dataKey}`,
    onClick: () => onClick?.({ month: '2023-09' }),
  });

export const Cell = () => null;
export const CartesianGrid = () => null;
export const XAxis = () => null;
export const YAxis = () => null;
export const Line = () => null;
export const Tooltip = () => null;
