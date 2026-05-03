import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import PreviewPage from '../PreviewPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock fetch
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const mockData = {
  filename: 'test-transactions.csv',
  transactions: [
    {
      id: 1,
      date: '2025-05-01',
      description: 'Test Transaction 1',
      amount: 100.5,
      rawCategory: 'Food',
    },
  ],
  duplicateCount: 1,
  accountId: null,
  sign: false,
};

const mockAccounts = [
  { id: 1, name: 'Test Bank' },
  { id: 2, name: 'Other Credit Card' },
];

describe('PreviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
    render(
      <MemoryRouter initialEntries={['/preview/123']}>
        <Routes>
          <Route path="/preview/:id" element={<PreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders preview data after successful fetch', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/accounts') {
        return Promise.resolve({
          ok: true,
          json: async () => mockAccounts,
        } as Response);
      }
      if (url === '/api/preview/123') {
        return Promise.resolve({
          ok: true,
          json: async () => mockData,
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <MemoryRouter initialEntries={['/preview/123']}>
        <Routes>
          <Route path="/preview/:id" element={<PreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Preview: test-transactions.csv')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Transactions: 1 | Duplicates: 1')).toBeInTheDocument();
    expect(screen.getByText('Test Transaction 1')).toBeInTheDocument();
    expect(screen.getByText('100.50')).toBeInTheDocument();

    // Check for new UI elements
    expect(screen.getByLabelText('Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Invert Signs')).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    } as Response);

    render(
      <MemoryRouter initialEntries={['/preview/123']}>
        <Routes>
          <Route path="/preview/:id" element={<PreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch preview data')).toBeInTheDocument();
    });
  });

  it('opens "Add New Account" modal when selected', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/accounts')
        return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
      if (url === '/api/preview/123')
        return Promise.resolve({ ok: true, json: async () => mockData } as Response);
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <MemoryRouter initialEntries={['/preview/123']}>
        <Routes>
          <Route path="/preview/:id" element={<PreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByLabelText('Account')).toBeInTheDocument());

    // Open select
    fireEvent.mouseDown(screen.getByLabelText('Account'));

    // Find and click "Add new..."
    const addNewOption = screen.getByText('Add new...');
    fireEvent.click(addNewOption);

    // Verify modal is open
    expect(screen.getByText('Add New Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Account Name')).toBeInTheDocument();
  });

  it('creates a new account via modal', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 3, name: 'Brand New Bank' }),
          } as Response);
        }
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => mockData } as Response);
        if (url === '/api/preview/123/account' && options?.method === 'PUT')
          return Promise.resolve({ ok: true } as Response);
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/preview/123']}>
        <Routes>
          <Route path="/preview/:id" element={<PreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByLabelText('Account')).toBeInTheDocument());

    // Open modal
    fireEvent.mouseDown(screen.getByLabelText('Account'));
    fireEvent.click(screen.getByText('Add new...'));

    // Fill name and submit
    const input = screen.getByLabelText('Account Name');
    fireEvent.change(input, { target: { value: 'Brand New Bank' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      // Check that account creation was called
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/accounts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Brand New Bank' }),
        }),
      );
      // Check that the preview was updated with the new account id
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/preview/123/account',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ accountId: 3 }),
        }),
      );
    });

    await waitFor(() => {
      // Modal should be closed
      expect(screen.queryByText('Add New Account')).not.toBeInTheDocument();
    });
  });
});
