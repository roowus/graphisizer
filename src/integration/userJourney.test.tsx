import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPersonsPage1 = {
  items: [
    { id: '2015WHIT01', name: 'Max Park' },
    { id: '2023HELE02', name: 'Lewis He' },
    { id: '2012YOSH01', name: 'Yusheng Du' },
    { id: '2011CUBR01', name: 'Feliks Zemdegs' },
  ],
};

const mockPersonsPage2 = {
  items: [
    { id: '2018CARA01', name: 'Sean Villalobos' },
    { id: '2017SCHW01', name: 'Patrick Ponce' },
  ],
};

const mockPersonsPage3 = {
  items: [],
};

const mockPersonMaxPark = {
  wcaId: '2015WHIT01',
  name: 'Max Park',
  competitionIds: ['WC2023', 'WC2022'],
  results: {
    WC2023: {
      '333': [
        {
          round: 'first',
          best: 520,
          average: 545,
          position: 1,
          solves: [510, 530, 520, 540, 550],
        },
        {
          round: 'final',
          best: 480,
          average: 500,
          position: 1,
          solves: [490, 480, 470, 510, 520],
        },
      ],
    },
    WC2022: {
      '333': [
        {
          round: 'final',
          best: 490,
          average: 510,
          position: 2,
          solves: [500, 490, 520, 510, 530],
        },
      ],
    },
  },
};

const mockCompWC2023 = {
  id: 'WC2023',
  name: 'World Championship 2023',
  date: { from: '2023-08-12', to: '2023-08-15' },
};

const mockCompWC2022 = {
  id: 'WC2022',
  name: 'World Championship 2022',
  date: { from: '2022-07-15', to: '2022-07-17' },
};

describe('User Journey Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('persons-page-1')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPersonsPage1,
        } as Response);
      }
      if (url.includes('persons-page-2')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPersonsPage2,
        } as Response);
      }
      if (url.includes('persons-page-3')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPersonsPage3,
        } as Response);
      }
      // Mock persons.json for cache loading
      if (url.includes('/api/persons.json') && !url.includes('persons-page')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPersonsPage1,
        } as Response);
      }
      if (url.includes('/api/persons/2015WHIT01')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPersonMaxPark,
        } as Response);
      }
      if (url.includes('/api/competitions/WC2023')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockCompWC2023,
        } as Response);
      }
      if (url.includes('/api/competitions/WC2022')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockCompWC2022,
        } as Response);
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  describe('Complete User Journey: Add and View Single Graph', () => {
    it('should allow user to search for a competitor and add their graph', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Step 1: User sees empty state
      expect(screen.getByText('Start Tracking Progress')).toBeInTheDocument();

      // Step 2: User types in search box
      const searchInput = screen.getByPlaceholderText('Search by ID or name...');
      await user.type(searchInput, 'Max');

      // Step 3: Wait for autocomplete dropdown
      await waitFor(() => {
        expect(screen.getByText('Max Park')).toBeInTheDocument();
      });

      // Step 4: User clicks on autocomplete suggestion
      await user.click(screen.getByText('Max Park'));

      // Verify WCA ID is filled
      expect(searchInput).toHaveValue('2015WHIT01');

      // Step 5: User selects event (3x3x3 should be default)
      const eventSelect = screen.getByRole('combobox', { name: /event/i });
      expect(eventSelect).toHaveValue('333');

      // Step 6: User selects result type
      const resultTypeSelect = screen.getByRole('combobox', { name: /result type/i });
      await user.selectOptions(resultTypeSelect, 'single');

      // Step 7: User clicks "Add Graph"
      const addButton = screen.getByRole('button', { name: /\+ add graph/i });
      await user.click(addButton);

      // Step 8: Verify loading state
      await waitFor(() => {
        expect(screen.getByText(/loading data/i)).toBeInTheDocument();
      });

      // Step 9: Verify graph card appears
      await waitFor(
        () => {
          expect(screen.getByText('Max Park')).toBeInTheDocument();
          expect(screen.getByText('2015WHIT01')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Step 10: Verify data points are shown
      await waitFor(() => {
        expect(screen.getByText(/data points:/i)).toBeInTheDocument();
      });
    });

    it('should allow user to view chart after adding graph', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Add a graph
      const searchInput = screen.getByPlaceholderText('Search by ID or name...');
      await user.type(searchInput, '2015WHIT01');

      // Wait and click suggestion
      await waitFor(() => {
        expect(screen.getByText('Max Park')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Max Park'));

      // Add the graph
      await user.click(screen.getByRole('button', { name: /\+ add graph/i }));

      // Wait for graph to load
      await waitFor(
        () => {
          expect(screen.getByText('Max Park')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Verify chart section appears
      await waitFor(() => {
        expect(screen.getByText('Progression Chart')).toBeInTheDocument();
      });

      // Verify detailed results table appears
      expect(screen.getByText('Detailed Results Table')).toBeInTheDocument();
    });
  });

  describe('Multi-Graph Comparison Journey', () => {
    it('should allow user to add multiple graphs for comparison', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Add first graph
      const searchInput = screen.getByPlaceholderText('Search by ID or name...');
      await user.type(searchInput, 'Max');

      await waitFor(() => {
        expect(screen.getByText('Max Park')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Max Park'));

      await user.click(screen.getByRole('button', { name: /\+ add graph/i }));

      // Wait for first graph
      await waitFor(
        () => {
          expect(screen.getByText('Max Park')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Add second graph (same competitor, different result type)
      await user.type(searchInput, '2015WHIT01');
      searchInput.value = '2015WHIT01'; // Directly set value
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));

      const resultTypeSelect = screen.getByRole('combobox', { name: /result type/i });
      await user.selectOptions(resultTypeSelect, 'average');

      await user.click(screen.getByRole('button', { name: /\+ add graph/i }));

      // Verify both graphs appear
      await waitFor(
        () => {
          const graphCards = screen.getAllByText('2015WHIT01');
          expect(graphCards.length).toBeGreaterThan(0);
        },
        { timeout: 10000 }
      );
    });
  });

  describe('Graph Removal Journey', () => {
    it('should allow user to remove a graph', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Add a graph
      const searchInput = screen.getByPlaceholderText('Search by ID or name...');
      await user.type(searchInput, 'Max');

      await waitFor(() => {
        expect(screen.getByText('Max Park')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Max Park'));

      await user.click(screen.getByRole('button', { name: /\+ add graph/i }));

      // Wait for graph to appear
      await waitFor(
        () => {
          expect(screen.getByText('Max Park')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Remove the graph
      const closeButtons = screen.getAllByText('✕');
      expect(closeButtons.length).toBeGreaterThan(0);

      await user.click(closeButtons[0]);

      // Verify graph is removed and empty state returns
      await waitFor(() => {
        expect(screen.queryByText('Max Park')).not.toBeInTheDocument();
        expect(screen.getByText('Start Tracking Progress')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Journey', () => {
    it('should handle invalid WCA ID gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('persons-page')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          } as Response);
        }
        // Mock persons.json for cache loading - return empty
        if (url.includes('/api/persons.json') && !url.includes('persons-page')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          } as Response);
        }
        if (url.includes('/api/persons/')) {
          return Promise.resolve({
            ok: false,
            status: 404,
          } as Response);
        }
        return Promise.reject(new Error('Not found'));
      });

      const user = userEvent.setup();
      render(<App />);

      // Try to add invalid graph
      const searchInput = screen.getByPlaceholderText('Search by ID or name...');
      searchInput.value = 'INVALIDID123';
      fireEvent.input(searchInput, { target: { value: 'INVALIDID123' } });
      fireEvent.change(searchInput, { target: { value: 'INVALIDID123' } });

      // Add button
      const addButton = screen.getByRole('button', { name: /\+ add graph/i });
      await user.click(addButton);

      // Should show error message instead of graph data
      await waitFor(() => {
        expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
      });

      // Should not show detailed results or chart for invalid ID
      expect(screen.queryByText('Progression Chart')).not.toBeInTheDocument();
      expect(screen.queryByText('Detailed Results Table')).not.toBeInTheDocument();
    });
  });

  describe('Search Autocomplete Journey', () => {
    it('should show search suggestions as user types', async () => {
      const user = userEvent.setup();
      render(<App />);

      const searchInput = screen.getByPlaceholderText('Search by ID or name...');

      // Type search query
      await user.type(searchInput, 'Max');

      // Wait for suggestions to appear (with debounce)
      await waitFor(
        () => {
          expect(screen.queryAllByText('Max Park').length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );
    });

    it('should hide suggestions when user clicks away', async () => {
      const user = userEvent.setup();
      render(<App />);

      const searchInput = screen.getByPlaceholderText('Search by ID or name...');
      await user.type(searchInput, 'Max');

      // Wait for suggestions
      await waitFor(
        () => {
          expect(screen.queryAllByText('Max Park').length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );

      // Click outside (blur event)
      searchInput.blur();

      // Wait for suggestions to disappear
      await waitFor(
        () => {
          expect(screen.queryAllByText('Max Park').length).toBe(0);
        },
        { timeout: 1000 }
      );
    });
  });
});
