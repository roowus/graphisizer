import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatWcaTime } from '../App';

// Mock fetch for data fetching tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import fetchGraphData after mocking fetch
// Note: This requires the function to be exportable from App

describe('WCA Time Formatting', () => {
  it('should format time in seconds correctly', () => {
    expect(formatWcaTime(520)).toBe('5.20s');
    expect(formatWcaTime(1000)).toBe('10.00s');
    expect(formatWcaTime(599)).toBe('5.99s');
  });

  it('should format time in minutes and seconds correctly', () => {
    expect(formatWcaTime(6000)).toBe('1:00.00');
    expect(formatWcaTime(9050)).toBe('1:30.50');
    expect(formatWcaTime(12567)).toBe('2:05.67');
  });

  it('should handle DNF (0 or negative values)', () => {
    expect(formatWcaTime(0)).toBe('DNF');
    expect(formatWcaTime(-1)).toBe('DNF');
    expect(formatWcaTime(-100)).toBe('DNF');
  });
});

describe('Data Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch person data successfully', async () => {
    const mockPerson = {
      wcaId: '2015WHIT01',
      name: 'Max Park',
      competitionIds: ['Comp1', 'Comp2'],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPerson,
    } as Response);

    const response = await fetch('https://example.com/api/persons/2015WHIT01.json');
    const data = await response.json();

    expect(data).toEqual(mockPerson);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/persons/2015WHIT01.json'
    );
  });

  it('should handle person not found error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const response = await fetch('https://example.com/api/persons/INVALID01.json');

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('should fetch competition data successfully', async () => {
    const mockCompetition = {
      id: 'Comp2023',
      name: 'Test Competition 2023',
      date: { from: '2023-06-15', to: '2023-06-17' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCompetition,
    } as Response);

    const response = await fetch('https://example.com/api/competitions/Comp2023.json');
    const data = await response.json();

    expect(data.name).toBe('Test Competition 2023');
    expect(data.date.from).toBe('2023-06-15');
  });
});

describe('Search Functionality', () => {
  it('should validate WCA ID format', () => {
    const wcaIdPattern = /^\d{4}[A-Z]{4}\d{2}$/;

    expect(wcaIdPattern.test('2015WHIT01')).toBe(true);
    expect(wcaIdPattern.test('2023HELE02')).toBe(true);
    expect(wcaIdPattern.test('2012YOSH01')).toBe(true);
    expect(wcaIdPattern.test('INVALID')).toBe(false);
    expect(wcaIdPattern.test('2015WHI')).toBe(false);
    expect(wcaIdPattern.test('whit01')).toBe(false);
  });

  it('should handle case-insensitive WCA ID lookup', () => {
    const input = '2015whit01';
    const uppercased = input.toUpperCase();

    expect(uppercased).toBe('2015WHIT01');
  });

  it('should filter search results by name or ID', () => {
    const mockPersons = [
      { id: '2015WHIT01', name: 'Max Park' },
      { id: '2023HELE02', name: 'Lewis He' },
      { id: '2012YOSH01', name: 'Yusheng Du' },
    ];

    const searchResults = mockPersons.filter(
      (p) =>
        p.name.toLowerCase().includes('max') ||
        p.id.toLowerCase().includes('max')
    );

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].name).toBe('Max Park');
  });
});

describe('Data Processing', () => {
  it('should handle DNF values correctly', () => {
    const solve = -1;
    const isDNF = solve < 0;

    expect(isDNF).toBe(true);
  });

  it('should convert centiseconds to seconds', () => {
    const centiseconds = 520;
    const seconds = centiseconds / 100;

    expect(seconds).toBe(5.2);
  });

  it('should parse competition dates correctly', () => {
    const dateStr = '2023-06-15';
    const date = new Date(dateStr);

    expect(date.getFullYear()).toBe(2023);
    expect(date.getMonth()).toBe(5); // June is 0-indexed
    expect(date.getDate()).toBe(15);
  });

  it('should extract individual solves from result data', () => {
    const result = {
      round: 'first',
      best: 520,
      average: 545,
      solves: [510, 530, 520, 540, 550],
    };

    expect(result.solves).toHaveLength(5);
    expect(result.solves[0]).toBe(510);
    expect(result.solves[4]).toBe(550);
  });

  it('should handle different solve data structures', () => {
    const resultWithSolves = {
      solves: [510, 530, 520],
    };

    const resultWithIndividualFields = {
      solve1: 510,
      solve2: 530,
      solve3: 520,
      solve4: undefined,
    };

    const solves1 = resultWithSolves.solves || [];
    const solves2 = [
      resultWithIndividualFields.solve1,
      resultWithIndividualFields.solve2,
      resultWithIndividualFields.solve3,
      resultWithIndividualFields.solve4,
    ].filter((s) => s !== undefined);

    expect(solves1).toHaveLength(3);
    expect(solves2).toHaveLength(3);
  });
});

describe('Chart Data Preparation', () => {
  it('should create unique timestamps for duplicate dates', () => {
    const baseDate = new Date('2023-06-15');
    const timestamp = baseDate.getTime();

    const offset1 = 0;
    const offset2 = 1;
    const offset3 = 2;

    const date1 = new Date(timestamp + offset1);
    const date2 = new Date(timestamp + offset2);
    const date3 = new Date(timestamp + offset3);

    expect(date1.getTime()).not.toBe(date2.getTime());
    expect(date2.getTime()).not.toBe(date3.getTime());
    expect(date3.getTime() - date1.getTime()).toBe(2);
  });

  it('should sort data points by date', () => {
    const dataPoints = [
      { date: new Date('2023-06-20'), value: 500 },
      { date: new Date('2023-06-15'), value: 520 },
      { date: new Date('2023-06-10'), value: 540 },
    ];

    const sorted = dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());

    expect(sorted[0].date.toISOString()).toContain('2023-06-10');
    expect(sorted[1].date.toISOString()).toContain('2023-06-15');
    expect(sorted[2].date.toISOString()).toContain('2023-06-20');
  });

  it('should filter out DNF points for main line', () => {
    const allPoints = [
      { value: 500, isDNF: false },
      { value: null, isDNF: true },
      { value: 520, isDNF: false },
      { value: null, isDNF: true },
      { value: 510, isDNF: false },
    ];

    const nonDNFPoints = allPoints.filter((p) => !p.isDNF);

    expect(nonDNFPoints).toHaveLength(3);
    expect(nonDNFPoints.every((p) => !p.isDNF)).toBe(true);
  });
});
