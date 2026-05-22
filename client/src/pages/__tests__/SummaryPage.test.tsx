import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import SummaryPage from '../SummaryPage';
import { MemoryRouter } from 'react-router-dom';

// Mock fetch
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// Mock ResponsiveContainer to render its children
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts') as Record<string, unknown>;
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: '800px', height: '400px' }}>{children}</div>
    ),
  };
});

const mockSummaryData = {
  data: [
    {
      month: '2023-09',
      spendings: [100, 200],
      totalSpent: 300,
      totalEarned: 0,
      transactionCount: 2,
    },
    {
      month: '2023-10',
      spendings: [150, 250],
      totalSpent: 400,
      totalEarned: 50,
      transactionCount: 3,
    },
  ],
  categories: [
    { id: 'cat-1', name: 'Food', color: '#ff0000' },
    { id: 'cat-2', name: 'Rent', color: '#00ff00' },
  ],
  allTimeSpendings: [250, 450],
  totalSpent: 700,
  totalEarned: 50,
  transactionCount: 5,
  totalMonths: 2,
};

describe('SummaryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state then data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSummaryData,
    } as Response);

    render(
      <MemoryRouter>
        <SummaryPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });

    // Check summary footers
    expect(screen.getByText(/Total: 5 transactions/)).toBeInTheDocument();
    expect(screen.getByText(/Avg: 2\.5 transactions/)).toBeInTheDocument();
    expect(screen.getByText(/\$700\.00/)).toBeInTheDocument(); // Total Spent
    expect(screen.getByText(/\$350\.00/)).toBeInTheDocument(); // Avg Spent
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument(); // Total Earned
    expect(screen.getByText(/\$25\.00/)).toBeInTheDocument(); // Avg Earned

    // Check chart titles
    expect(screen.getByText('Total Spendings (2 months)')).toBeInTheDocument();
    expect(screen.getByText('Average Spendings (Sep 2023 - Oct 2023)')).toBeInTheDocument();
    expect(screen.getByText('12-Month Spending Trend')).toBeInTheDocument();
  });

  it('handles empty data state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        categories: [],
        allTimeSpendings: [],
        totalSpent: 0,
        totalEarned: 0,
        transactionCount: 0,
        totalMonths: 0,
      }),
    } as Response);

    render(
      <MemoryRouter>
        <SummaryPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No transactions found. Upload some files to see the summary.'),
      ).toBeInTheDocument();
    });
  });

  it('handles fetch error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    } as Response);

    render(
      <MemoryRouter>
        <SummaryPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch summary data')).toBeInTheDocument();
    });
  });
});
