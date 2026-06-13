import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import CommentImportWizard, { type WizardTransaction } from '../CommentImportWizard';

const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const makeFile = (csv: string) => new File([csv], 'orders.csv', { type: 'text/csv' });

const transactions: WizardTransaction[] = [
  { id: 10, date: '2024-01-02', amount: -50, description: 'AMAZON MKTPL' },
  { id: 11, date: '2024-01-05', amount: -20, description: 'AMZN' },
];

const renderWizard = (file: File, txs = transactions) => {
  const onApplied = jest.fn();
  const onClose = jest.fn();
  render(
    <CommentImportWizard
      file={file}
      previewId="123"
      transactions={txs}
      onClose={onClose}
      onApplied={onApplied}
    />,
  );
  return { onApplied, onClose };
};

describe('CommentImportWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-maps columns, previews matches, and applies appended comments', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as Response);

    const { onApplied, onClose } = renderWizard(
      makeFile('Order Date,Total,Items\n2024-01-02,50.00,Widget\n2024-01-03,20.00,Gadget\n'),
    );

    // Step 1 renders the CSV preview once parsed.
    expect(await screen.findByText('Widget')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Both rows match (50 -> 1/2 exact; 20 -> 1/5 within the default 3-day drift).
    const applyButton = await screen.findByRole('button', { name: /Apply 2 comment/i });
    fireEvent.click(applyButton);

    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/preview/123/apply-comments');
    expect(JSON.parse(init?.body as string)).toEqual({
      comments: [
        { id: 10, comment: 'Widget' },
        { id: 11, comment: 'Gadget' },
      ],
    });
  });

  it('reports a conflict when two CSV rows match one transaction and disables apply', async () => {
    renderWizard(
      makeFile('Order Date,Total,Items\n2024-01-02,50.00,Widget\n2024-01-02,50.00,Gadget\n'),
      [{ id: 10, date: '2024-01-02', amount: -50, description: 'AMAZON' }],
    );

    expect(await screen.findByText('Widget')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Conflicts: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply 0 comment/i })).toBeDisabled();
  });
});
