import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { uploadTransactionsCsv } from '../upload';

const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe('uploadTransactionsCsv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts the file and returns the fileStageId', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ fileStageId: 42 }) } as Response);
    const file = new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' });

    const id = await uploadTransactionsCsv(file);

    expect(id).toBe(42);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/upload');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it('accepts a .csv file even without a text/csv MIME type', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ fileStageId: 7 }) } as Response);
    const file = new File(['x'], 'orders.CSV', { type: '' });

    await expect(uploadTransactionsCsv(file)).resolves.toBe(7);
  });

  it('rejects non-CSV files without calling the server', async () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });

    await expect(uploadTransactionsCsv(file)).rejects.toThrow('Please upload a CSV file.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws the server error message on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Bad columns' }),
    } as Response);
    const file = new File(['x'], 'data.csv', { type: 'text/csv' });

    await expect(uploadTransactionsCsv(file)).rejects.toThrow('Bad columns');
  });
});
