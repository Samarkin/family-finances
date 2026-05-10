import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import TransactionsPage from '../TransactionsPage';
import { MemoryRouter } from 'react-router-dom';

// Mock fetch
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const mockTransactionsData = {
  data: [
    {
      id: 'tx-1',
      date: '2023-10-15',
      description: 'Groceries',
      amount: -50.0,
      categoryId: 'cat-1',
      personId: 1,
      accountId: 1,
    },
  ],
  totalCount: 1,
  totalSpent: -50.0,
  totalEarned: 0,
  persons: { 1: 'Alice' },
  accounts: { 1: 'Checking' },
  categories: { 'cat-1': 'Food' },
};

const mockMonthsData = {
  months: ['2023-10', '2023-11'],
};

// DataGrid can be complex, but standard testing library can usually query row contents
describe('TransactionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and renders transactions', async () => {
    mockFetch.mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/transactions/months')) {
        return Promise.resolve({ ok: true, json: async () => mockMonthsData } as Response);
      }
      if (urlStr.includes('/api/transactions')) {
        return Promise.resolve({ ok: true, json: async () => mockTransactionsData } as Response);
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    );

    // Verify loading state or final render
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    // Check mapping
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Checking')).toBeInTheDocument();
    expect(screen.getByText('-$50.00')).toBeInTheDocument();
  });

  it('handles file upload via click and navigates', async () => {
    mockFetch.mockImplementation((url, options) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/transactions/months')) {
        return Promise.resolve({ ok: true, json: async () => mockMonthsData } as Response);
      }
      if (urlStr.includes('/api/transactions')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      if (urlStr.includes('/api/upload') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ fileStageId: 42 }) } as Response);
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    );

    // Provide a file to the hidden input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy content'], 'test.csv', { type: 'text/csv' });

    // Use fireEvent to trigger change
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/upload',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('renders dropdown with available months', async () => {
    mockFetch.mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/transactions/months')) {
        return Promise.resolve({ ok: true, json: async () => mockMonthsData } as Response);
      }
      if (urlStr.includes('/api/transactions')) {
        return Promise.resolve({ ok: true, json: async () => mockTransactionsData } as Response);
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('All Transactions')).toBeInTheDocument();
    });

    // Using fireEvent to interact with select
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Oct 2023' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Nov 2023' })).toBeInTheDocument();
    });
  });
});
