import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPersonsPage1 = {
  items: [
    { id: '2015WHIT01', name: 'Max Park' },
    { id: '2023HELE02', name: 'Lewis He' },
  ],
};

const mockPersonsPage2 = { items: [] };
const mockPersonsPage3 = { items: [] };

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks for search
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
      return Promise.reject(new Error('Not found'));
    });
  });

  describe('Initial Rendering', () => {
    it('should render the header with title', () => {
      render(<App />);
      expect(screen.getByText('WCA Progress Tracker')).toBeInTheDocument();
    });

    it('should render the subtitle', () => {
      render(<App />);
      expect(screen.getByText('Track and compare WCA competition progression over time')).toBeInTheDocument();
    });

    it('should render empty state when no graphs added', () => {
      render(<App />);
      expect(screen.getByText('Start Tracking Progress')).toBeInTheDocument();
      expect(screen.getByText(/Lewis He, Max Park, Yusheng Du/)).toBeInTheDocument();
    });

    it('should render the form with all required inputs', () => {
      render(<App />);

      expect(screen.getByPlaceholderText('Search by ID or name...')).toBeInTheDocument();
      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(2); // Event and Result Type selects
      expect(screen.getByRole('button', { name: /\+ add graph/i })).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should show event options in dropdown', () => {
      render(<App />);
      const selects = screen.getAllByRole('combobox');
      const eventSelect = selects[0]; // First select is Event

      expect(eventSelect).toContainHTML('3x3x3 Cube');
      expect(eventSelect).toContainHTML('2x2x2 Cube');
    });

    it('should show result type options in dropdown', () => {
      render(<App />);
      const selects = screen.getAllByRole('combobox');
      const resultTypeSelect = selects[1]; // Second select is Result Type

      expect(resultTypeSelect).toContainHTML('Single Best');
      expect(resultTypeSelect).toContainHTML('Average');
      expect(resultTypeSelect).toContainHTML('Rank');
      expect(resultTypeSelect).toContainHTML('All Solves');
    });

    it('should update WCA ID input when user types', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Search by ID or name...');
      await user.type(input, '2015WHIT01');

      expect(input).toHaveValue('2015WHIT01');
    });

    it('should not add graph when WCA ID is empty', async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole('button', { name: /\+ add graph/i });
      await user.click(addButton);

      // Should still show empty state
      expect(screen.getByText('Start Tracking Progress')).toBeInTheDocument();
    });
  });

  describe('Graph Card Rendering', () => {
    const mockPersonData = {
      wcaId: '2015WHIT01',
      name: 'Max Park',
      competitionIds: ['ExampleComp2023'],
      results: {
        ExampleComp2023: {
          '333': [
            {
              round: 'first',
              best: 520,
              average: 545,
              position: 1,
              solves: [510, 530, 520, 540, 550],
            },
          ],
        },
      },
    };

    const mockCompData = {
      id: 'ExampleComp2023',
      name: 'Example Competition 2023',
      date: { from: '2023-06-15', to: '2023-06-17' },
    };

    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        // Handle search API calls
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
        // Handle person data fetch
        if (url.includes('/api/persons/2015WHIT01')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockPersonData,
          } as Response);
        }
        // Handle competition data fetch
        if (url.includes('/api/competitions/')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCompData,
          } as Response);
        }
        return Promise.reject(new Error('Not found'));
      });
    });

    it('should show loading state when adding graph', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Search by ID or name...');

      // Directly set value and trigger both input and change events
      input.value = '2015WHIT01';
      fireEvent.input(input, { target: { value: '2015WHIT01' } });
      fireEvent.change(input, { target: { value: '2015WHIT01' } });

      const addButton = screen.getByRole('button', { name: /\+ add graph/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/loading data/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should display graph card after successful data fetch', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Search by ID or name...');
      input.value = '2015WHIT01';
      fireEvent.input(input, { target: { value: '2015WHIT01' } });
      fireEvent.change(input, { target: { value: '2015WHIT01' } });

      const addButton = screen.getByRole('button', { name: /\+ add graph/i });
      await user.click(addButton);

      await waitFor(
        () => {
          expect(screen.getByText('Max Park')).toBeInTheDocument();
          expect(screen.getByText('2015WHIT01')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('should remove graph when close button clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Search by ID or name...');
      input.value = '2015WHIT01';
      fireEvent.input(input, { target: { value: '2015WHIT01' } });
      fireEvent.change(input, { target: { value: '2015WHIT01' } });

      const addButton = screen.getByRole('button', { name: /\+ add graph/i });
      await user.click(addButton);

      await waitFor(
        () => {
          expect(screen.getByText('Max Park')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      const closeButton = screen.getAllByText('✕')[0];
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Max Park')).not.toBeInTheDocument();
      });
    });
  });
});
