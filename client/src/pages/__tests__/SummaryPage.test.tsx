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
      spendings: [100, 200, -50],
      transactionCount: 3,
      spendingCount: 2,
      incomeCount: 1,
    },
    {
      month: '2023-10',
      spendings: [150, 250, 0],
      transactionCount: 2,
      spendingCount: 2,
      incomeCount: 0,
    },
  ],
  categories: [
    { id: 'cat-1', name: 'Food', color: '#ff0000' },
    { id: 'cat-2', name: 'Rent', color: '#00ff00' },
    { id: 'cat-3', name: 'Salary', color: '#0000ff', isIncome: true },
  ],
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
      expect(screen.getByText('Summary (Sep 2023 - Oct 2023)')).toBeInTheDocument();
    });

    // Check summary footers
    expect(screen.getByText(/Monthly: 2\.0 transactions \| \$350\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Annual: 24 transactions \| \$4,200\.00/)).toBeInTheDocument();

    expect(screen.getByText(/Monthly: 0\.5 transactions \| \$25\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Annual: 6 transactions \| \$300\.00/)).toBeInTheDocument();

    // Check chart titles
    expect(screen.getByText('Spendings')).toBeInTheDocument();
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Trend')).toBeInTheDocument();
  });

  it('handles empty data state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        categories: [],
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
