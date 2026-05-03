import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import PreviewPage from '../PreviewPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock fetch
const mockFetch = jest.fn<() => Promise<Partial<Response>>>();
global.fetch = mockFetch as unknown as typeof fetch;

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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
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
  });

  it('renders error state on fetch failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    });

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
});
