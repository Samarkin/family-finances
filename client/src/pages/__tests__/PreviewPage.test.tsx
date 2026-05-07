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
      categoryId: undefined,
      personId: undefined,
    },
    {
      id: 2,
      date: '2025-05-02',
      description: 'Test Transaction 2',
      amount: 200.0,
      rawCategory: 'Other',
      categoryId: undefined,
      personId: undefined,
    },
    {
      id: 3,
      date: '2025-05-03',
      description: 'Test Transaction 3',
      amount: 50.0,
      rawCategory: 'Bills',
      categoryId: undefined,
      personId: undefined,
    },
  ],
  duplicateCount: 1,
  accountId: null,
  sign: false,
  categories: [
    { id: 'food', name: 'Food & Drinks' },
    { id: 'groceries', name: 'Groceries' },
  ],
  persons: [
    { id: 1, name: 'Family' },
    { id: 2, name: 'Alice' },
  ],
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

    expect(screen.getByText('Total Transactions: 3 | Duplicates: 1')).toBeInTheDocument();
    expect(screen.getByText('Test Transaction 1')).toBeInTheDocument();
    expect(screen.getByText('100.50')).toBeInTheDocument();

    // Check for new UI elements
    expect(screen.getByLabelText('Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Invert Signs')).toBeInTheDocument();

    // Check for Category and Person columns with MISSING indicators
    // Both Person and Category are now a Select with "Select..."
    expect(screen.queryByText('MISSING')).not.toBeInTheDocument();
    expect(screen.getAllByText('Select...')).toHaveLength(6);
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

  it('opens "Add New Person" modal when selected', async () => {
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

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    // Find the inline person select for the first row (the first "Select...")
    const personSelect = screen.getAllByText('Select...')[0];
    fireEvent.mouseDown(personSelect);

    // Find and click "Add new..."
    // Since there are multiple "Add new..." options (one for Account, one for Person per row)
    // we use getAllByText and click the last one which is in the dropdown portal
    const addNewOptions = screen.getAllByText('Add new...');
    fireEvent.click(addNewOptions[addNewOptions.length - 1]);

    // Verify modal is open
    expect(screen.getByText('Add New Person')).toBeInTheDocument();
    expect(screen.getByLabelText('Person Name')).toBeInTheDocument();
  });

  it('creates a new person via modal and auto-assigns to selected transactions', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (typeof url === 'string') {
        if (url === '/api/persons' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 3, name: 'Brand New Person' }),
          } as Response);
        }
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => mockData } as Response);
        if (url === '/api/preview/123/bulk-update' && options?.method === 'POST')
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

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    const personSelect = screen.getAllByText('Select...')[0];
    fireEvent.mouseDown(personSelect);

    const addNewOptions = screen.getAllByText('Add new...');
    fireEvent.click(addNewOptions[addNewOptions.length - 1]);

    // Fill name and submit
    const input = screen.getByLabelText('Person Name');
    fireEvent.change(input, { target: { value: 'Brand New Person' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      // Check that person creation was called
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/persons',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Brand New Person' }),
        }),
      );
      // Check that the bulk-update was called with the new person id
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/preview/123/bulk-update',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ ids: [1], personId: 3 }),
        }),
      );
    });

    await waitFor(() => {
      // Modal should be closed
      expect(screen.queryByText('Add New Person')).not.toBeInTheDocument();
    });
  });

  it('performs inline update and selects unselected rows', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => mockData } as Response);
        if (url === '/api/preview/123/bulk-update' && options?.method === 'POST')
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

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    // Open inline category dropdown for the first row (the second "Select..." since the first is for Person)
    fireEvent.mouseDown(screen.getAllByText('Select...')[1]);
    fireEvent.click(screen.getByText('Groceries'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/preview/123/bulk-update',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ids: [1],
            categoryId: 'groceries',
          }),
        }),
      );
    });
  });

  it('toggles row selection on click', async () => {
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => mockData } as Response);
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

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    const row1 = screen.getByText('Test Transaction 1').closest('tr')!;
    const checkbox1 = row1.querySelector('input[type="checkbox"]') as HTMLInputElement;

    // Initially not selected
    expect(checkbox1.checked).toBe(false);

    // Click row toggles selection
    fireEvent.click(row1);
    expect(checkbox1.checked).toBe(true);

    // Click again unselects
    fireEvent.click(row1);
    expect(checkbox1.checked).toBe(false);
  });

  it('performs shift-click to select a range', async () => {
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => mockData } as Response);
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

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    const row1 = screen.getByText('Test Transaction 1').closest('tr')!;
    const row2 = screen.getByText('Test Transaction 2').closest('tr')!;
    const row3 = screen.getByText('Test Transaction 3').closest('tr')!;

    const checkbox1 = row1.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const checkbox2 = row2.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const checkbox3 = row3.querySelector('input[type="checkbox"]') as HTMLInputElement;

    // Click row 1
    fireEvent.click(row1);
    expect(checkbox1.checked).toBe(true);

    // Shift-click row 3
    fireEvent.click(row3, { shiftKey: true });

    // All 3 rows should be selected
    expect(checkbox1.checked).toBe(true);
    expect(checkbox2.checked).toBe(true);
    expect(checkbox3.checked).toBe(true);
  });

  it('prevents default mousedown behavior on shift-click to avoid text selection', async () => {
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => mockData } as Response);
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

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    const row1 = screen.getByText('Test Transaction 1').closest('tr')!;

    // Fire mousedown with shiftKey
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    });

    // Spy on preventDefault
    const preventDefaultSpy = jest.spyOn(mouseDownEvent, 'preventDefault');

    fireEvent(row1, mouseDownEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('resets lastSelectedId when unselecting a row so next shift-click does not span from it', async () => {
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => mockData } as Response);
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

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    const row1 = screen.getByText('Test Transaction 1').closest('tr')!;
    const row2 = screen.getByText('Test Transaction 2').closest('tr')!;
    const row3 = screen.getByText('Test Transaction 3').closest('tr')!;

    const checkbox1 = row1.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const checkbox2 = row2.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const checkbox3 = row3.querySelector('input[type="checkbox"]') as HTMLInputElement;

    // Click row 1
    fireEvent.click(row1);
    expect(checkbox1.checked).toBe(true);

    // Click row 1 again to unselect
    fireEvent.click(row1);
    expect(checkbox1.checked).toBe(false);

    // Shift-click row 3
    fireEvent.click(row3, { shiftKey: true });

    // Since lastSelectedId was reset, shift-click should act as a normal click on row 3
    expect(checkbox1.checked).toBe(false);
    expect(checkbox2.checked).toBe(false);
    expect(checkbox3.checked).toBe(true);
  });

  it('filters rows based on Needs Review toggle', async () => {
    const reviewedData = {
      ...mockData,
      transactions: [
        { ...mockData.transactions[0], categoryId: 'food', personId: 1 }, // reviewed
        { ...mockData.transactions[1], categoryId: undefined, personId: undefined }, // unreviewed
      ],
    };

    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => reviewedData } as Response);
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

    await waitFor(() => expect(screen.getByText('Test Transaction 2')).toBeInTheDocument());

    // Toggle should be on by default since one item is unreviewed
    const toggle = screen.getByLabelText(/^Needs Review \(1\)$/) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    // Only the unreviewed transaction should be visible
    expect(screen.queryByText('Test Transaction 1')).not.toBeInTheDocument();

    // Toggle off
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);

    // Now both should be visible
    expect(screen.getByText('Test Transaction 1')).toBeInTheDocument();
    expect(screen.getByText('Test Transaction 2')).toBeInTheDocument();
  });

  it('selects only visible items when Select All is clicked with filter active', async () => {
    const mixedData = {
      ...mockData,
      transactions: [
        { ...mockData.transactions[0], id: 1, categoryId: 'food', personId: 1 }, // reviewed
        { ...mockData.transactions[1], id: 2, categoryId: undefined, personId: undefined }, // unreviewed
        { ...mockData.transactions[2], id: 3, categoryId: undefined, personId: undefined }, // unreviewed
      ],
    };

    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => mixedData } as Response);
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

    await waitFor(() => expect(screen.getByText('Test Transaction 2')).toBeInTheDocument());

    // Toggle should be on by default since there are unreviewed items
    const toggle = screen.getByLabelText(/^Needs Review \(2\)$/) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    // Only unreviewed transactions should be visible
    expect(screen.queryByText('Test Transaction 1')).not.toBeInTheDocument();

    // Click "Select All" checkbox in the header
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(selectAllCheckbox);

    // Turn toggle off to see all items
    fireEvent.click(toggle);

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    // Now check which checkboxes are checked
    const row1 = screen.getByText('Test Transaction 1').closest('tr')!;
    const row2 = screen.getByText('Test Transaction 2').closest('tr')!;
    const row3 = screen.getByText('Test Transaction 3').closest('tr')!;

    const checkbox1 = row1.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const checkbox2 = row2.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const checkbox3 = row3.querySelector('input[type="checkbox"]') as HTMLInputElement;

    // Only the previously visible items should be selected
    expect(checkbox1.checked).toBe(false);
    expect(checkbox2.checked).toBe(true);
    expect(checkbox3.checked).toBe(true);
  });

  it('defaults Needs Review Only to false if all items are fully reviewed', async () => {
    const fullyReviewedData = {
      ...mockData,
      transactions: [{ ...mockData.transactions[0], categoryId: 'food', personId: 1 }],
    };

    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url === '/api/accounts')
          return Promise.resolve({ ok: true, json: async () => mockAccounts } as Response);
        if (url === '/api/preview/123')
          return Promise.resolve({ ok: true, json: async () => fullyReviewedData } as Response);
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

    await waitFor(() => expect(screen.getByText('Test Transaction 1')).toBeInTheDocument());

    // Toggle should be off since all are reviewed
    const toggle = screen.getByLabelText(/^Needs Review \(0\)$/) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });
});
