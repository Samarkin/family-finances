import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import SummaryPage from '../SummaryPage';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';

// Mock fetch
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const mockSummaryData = {
  data: [
    {
      month: '2023-09',
      spendings: [100, 200, -50],
      spendingCount: 2,
      incomeCount: 1,
    },
    {
      month: '2023-10',
      spendings: [150, 250, 0],
      spendingCount: 2,
      incomeCount: 0,
    },
  ],
  categories: [
    { id: 'cat-1', name: 'Food', color: '#ff0000' },
    { id: 'cat-2', name: 'Rent', color: '#00ff00' },
    { id: 'cat-3', name: 'Salary', color: '#0000ff', isIncome: true },
  ],
  hasPrev: true,
};

// Full coverage for the two displayed months → 100% complete, label hidden
const mockAccounts = [{ id: 1, name: 'Checking' }];
const mockFiles = {
  data: [{ id: 1, filename: 'checking.csv', accountName: 'Checking', range: '2023-09 : 2023-10' }],
};

// Partial coverage: Savings only covers 2023-09, missing 2023-10 → 75% (3/4)
const mockAccountsPartial = [
  { id: 1, name: 'Checking' },
  { id: 2, name: 'Savings' },
];
const mockFilesPartial = {
  data: [
    { id: 1, filename: 'checking.csv', accountName: 'Checking', range: '2023-09 : 2023-10' },
    { id: 2, filename: 'savings.csv', accountName: 'Savings', range: '2023-09 : 2023-09' },
  ],
};

function setupMocks(
  summaryData = mockSummaryData,
  accounts: { id: number; name: string }[] = mockAccounts,
  files: {
    data: { id: number; filename: string; accountName: string; range: string }[];
  } = mockFiles,
) {
  mockFetch.mockImplementation((url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/api/accounts')) {
      return Promise.resolve({ ok: true, json: async () => accounts } as Response);
    }
    if (urlStr.includes('/api/files')) {
      return Promise.resolve({ ok: true, json: async () => files } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => summaryData } as Response);
  });
}

describe('SummaryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state then data', async () => {
    setupMocks();

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

    // Check navigation buttons
    const olderButton = screen.getByRole('button', { name: /older/i });
    const newerButton = screen.getByRole('button', { name: /newer/i });

    expect(olderButton).not.toBeDisabled();
    expect(newerButton).toBeDisabled(); // Offset is 0

    // At 100% coverage the label is hidden
    expect(screen.queryByText(/% complete/)).not.toBeInTheDocument();
  });

  it('updates offset and re-fetches when navigation buttons are clicked', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <SummaryPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Summary (Sep 2023 - Oct 2023)')).toBeInTheDocument();
    });

    const olderButton = screen.getByRole('button', { name: /older/i });
    fireEvent.click(olderButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/summary?offset=1');
    });

    await waitFor(() => {
      const newerButton = screen.getByRole('button', { name: /newer/i });
      expect(newerButton).not.toBeDisabled();
    });

    const newerButton = screen.getByRole('button', { name: /newer/i });
    fireEvent.click(newerButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/summary?offset=0');
    });
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

  it('navigates with category filter when a spending pie slice is clicked', async () => {
    setupMocks();

    const router = createMemoryRouter([{ path: '/', element: <SummaryPage /> }], {
      initialEntries: ['/'],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('Summary (Sep 2023 - Oct 2023)')).toBeInTheDocument();
    });

    // cat-1 is a spending category (not income) so its slice appears in the Spendings pie
    const slice = screen.getByTestId('pie-slice-cat-1');
    fireEvent.click(slice);

    await waitFor(() => {
      expect(router.state.location.pathname + router.state.location.search).toBe(
        '/transactions?category=cat-1',
      );
    });
  });

  it('navigates with month filter when an area is clicked', async () => {
    setupMocks();

    const router = createMemoryRouter([{ path: '/', element: <SummaryPage /> }], {
      initialEntries: ['/'],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('Summary (Sep 2023 - Oct 2023)')).toBeInTheDocument();
    });

    // The ComposedChart mock fires onClick({ activeLabel: '2023-09' }) when clicked
    const chart = screen.getByTestId('mock-composed-chart');
    fireEvent.click(chart);

    await waitFor(() => {
      expect(router.state.location.pathname + router.state.location.search).toBe(
        '/transactions?month=2023-09',
      );
    });
  });

  it('shows completion percentage when coverage is incomplete', async () => {
    setupMocks(mockSummaryData, mockAccountsPartial, mockFilesPartial);

    render(
      <MemoryRouter>
        <SummaryPage />
      </MemoryRouter>,
    );

    // 2 accounts × 2 months = 4 slots; Checking: 2/2, Savings: 1/2 → 75.0%
    await waitFor(() => {
      expect(screen.getByText(/75\.0% complete/)).toBeInTheDocument();
    });
  });

  it('navigates to accounts page when completion label is clicked', async () => {
    setupMocks(mockSummaryData, mockAccountsPartial, mockFilesPartial);

    const router = createMemoryRouter([{ path: '/', element: <SummaryPage /> }], {
      initialEntries: ['/'],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText(/75\.0% complete/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/75\.0% complete/));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/accounts');
    });
  });

  it('completion tooltip lists accounts with missing months', async () => {
    setupMocks(mockSummaryData, mockAccountsPartial, mockFilesPartial);

    render(
      <MemoryRouter>
        <SummaryPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/75\.0% complete/)).toBeInTheDocument();
    });

    fireEvent.mouseOver(screen.getByText(/75\.0% complete/));

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Missing data:');
    expect(tooltip).toHaveTextContent("Savings: Oct '23");
  });
});
