import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import FilesPage from '../FilesPage';
import { MemoryRouter } from 'react-router-dom';

// Mock fetch
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const mockFiles = {
  data: [
    { id: 1, filename: 'committed.csv', accountName: 'Test Bank', range: '2023-01 : 2023-02' },
  ],
};

const mockStagedFiles = {
  data: [{ id: 10, filename: 'staged.csv', accountName: null, range: '2023-03 : 2023-03' }],
};

describe('FilesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders files and staged files', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/files') {
        return Promise.resolve({
          ok: true,
          json: async () => mockFiles,
        } as Response);
      }
      if (url === '/api/preview-files') {
        return Promise.resolve({
          ok: true,
          json: async () => mockStagedFiles,
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <MemoryRouter>
        <FilesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('committed.csv')).toBeInTheDocument();
      expect(screen.getByText('staged.csv')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Bank')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('2023-01 : 2023-02')).toBeInTheDocument();
    expect(screen.getByText('2023-03 : 2023-03')).toBeInTheDocument();
    expect(screen.getByText('Committed')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText(/Count: 1 committed \| 1 in review/)).toBeInTheDocument();
  });

  it('uploads a CSV via the Upload button and navigates to preview', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (url === '/api/files' || url === '/api/preview-files') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      if (url === '/api/upload' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ fileStageId: 99 }) } as Response);
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <FilesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('No files found.')).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/upload',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('opens delete dialog and deletes a committed file', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (url === '/api/files' && options?.method === 'POST') {
        return Promise.resolve({ ok: true } as Response);
      }
      if (url === '/api/files') {
        return Promise.resolve({ ok: true, json: async () => mockFiles } as Response);
      }
      if (url === '/api/preview-files') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      if (url === '/api/files/1/delete' && options?.method === 'POST') {
        return Promise.resolve({ ok: true } as Response);
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <FilesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('committed.csv')).toBeInTheDocument());

    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete File')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "committed.csv"/)).toBeInTheDocument();

    const confirmBtn = screen.getByText('Delete');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/files/1/delete',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('opens delete dialog and discards a staged file', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (url === '/api/files') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      if (url === '/api/preview-files') {
        return Promise.resolve({ ok: true, json: async () => mockStagedFiles } as Response);
      }
      if (url === '/api/preview/10/discard' && options?.method === 'POST') {
        return Promise.resolve({ ok: true } as Response);
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <FilesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('staged.csv')).toBeInTheDocument());

    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete File')).toBeInTheDocument();
    expect(
      screen.getByText(/This will discard all in-review transactions for this file/),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByText('Delete');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/preview/10/discard',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('renders empty state when no files are found', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/files' || url === '/api/preview-files') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <MemoryRouter>
        <FilesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No files found.')).toBeInTheDocument();
    });
  });

  it('navigates to preview page when preview icon is clicked', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/files') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      if (url === '/api/preview-files') {
        return Promise.resolve({ ok: true, json: async () => mockStagedFiles } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <MemoryRouter initialEntries={['/files']}>
        <FilesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTitle('Preview')).toBeInTheDocument());

    const previewBtn = screen.getByTitle('Preview');
    expect(previewBtn).toHaveAttribute('href', '/preview/10');
  });
});
