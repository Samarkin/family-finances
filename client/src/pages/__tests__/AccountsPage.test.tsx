import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import AccountsPage from '../AccountsPage';
import { MemoryRouter } from 'react-router-dom';

// Mock fetch
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const mockAccounts = [
  { id: 1, name: 'Checking' },
  { id: 2, name: 'Savings' },
];

const mockCommittedFiles = {
  data: [
    {
      id: 1,
      filename: 'checking_jan_mar.csv',
      accountName: 'Checking',
      range: '2023-01 : 2023-03',
    },
  ],
};

const mockPreviewFiles = {
  data: [
    {
      id: 2,
      filename: 'savings_feb.csv',
      accountName: 'Savings',
      range: '2023-02 : 2023-02',
    },
  ],
};

describe('AccountsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state then data matrix', async () => {
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url.includes('/api/accounts')) {
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        }
        if (url.includes('/api/files')) {
          return Promise.resolve({ ok: true, json: async () => mockCommittedFiles } as Response);
        }
        if (url.includes('/api/preview-files')) {
          return Promise.resolve({ ok: true, json: async () => mockPreviewFiles } as Response);
        }
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Accounts Coverage')).toBeInTheDocument();
    });

    // Check months in header (sorted ascending: Jan, Feb, Mar)
    const headers = screen.getAllByRole('columnheader');
    expect(headers[1]).toHaveTextContent('Jan 23');
    expect(headers[2]).toHaveTextContent('Feb 23');
    expect(headers[3]).toHaveTextContent('Mar 23');

    // Check account names
    expect(screen.getByText('Checking')).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();

    // Check for icons (using testid or just presence)
    // Legend has 1 of each.
    // Checking has 3 months committed.
    // Savings has 1 month in review.
    const checkIcons = screen.getAllByTestId('CheckCircleIcon');
    const pendingIcons = screen.getAllByTestId('PendingIcon');

    expect(checkIcons.length).toBe(4); // 3 in table + 1 in legend
    expect(pendingIcons.length).toBe(2); // 1 in table + 1 in legend
  });

  it('handles fetch error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    } as Response);

    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    });
  });
});
