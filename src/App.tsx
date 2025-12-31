import { useState, useMemo, useEffect } from 'react';
import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, X, Trophy, Search, TrendingUp, Users, Share2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  ReferenceLine
} from 'recharts';
import './App.css';

interface DataPoint {
  date: Date;
  competitionName: string;
  value: number;
  round: string;
  position?: number;
  isDNF?: boolean;
  event?: string;
  graphId?: number;
}

interface Graph {
  id: number;
  wcaId: string;
  event: string;
  resultType: string;
  color: string;
  loading: boolean;
  error?: string;
  personName?: string;
  dataPoints: DataPoint[];
}

const API_BASE = 'https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master';

// Custom Dot component that handles both regular and DNF points
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;

  const isDNF = payload?.isDNF;
  const color = payload?.color || '#3b82f6';

  // If it's a DNF point, don't render here (handled by Scatter component)
  if (isDNF) return null;

  // For non-DNF points, render with graph color
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
    />
  );
};

// Custom Dot specifically for DNF points in Scatter chart
const DNFDot = (props: any) => {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;

  return (
    <g>
      {/* Very large invisible hit area for easier hovering - 60px radius for much better detection */}
      <circle
        cx={cx}
        cy={cy}
        r={60}
        fill="transparent"
        style={{ cursor: 'pointer' }}
      />
      {/* Visible dot - same size as regular dots (r=4) */}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#94a3b8"
        stroke="#64748b"
        strokeWidth={2}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
};

// Custom ActiveDot that handles both regular and DNF points
const CustomActiveDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;

  const isDNF = payload?.isDNF;
  const color = payload?.color || '#3b82f6';

  // If it's a DNF point, render as larger gray dot with glow
  if (isDNF) {
    return (
      <g>
        {/* Outer glow/halo */}
        <circle
          cx={cx}
          cy={cy}
          r={14}
          fill="#64748b"
          fillOpacity={0.2}
        />
        {/* Middle ring */}
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={2}
          strokeOpacity={0.6}
        />
        {/* Inner dot */}
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="#64748b"
          stroke="#94a3b8"
          strokeWidth={2}
        />
      </g>
    );
  }
  // For non-DNF points, render with graph color and glow effect
  return (
    <g>
      {/* Outer glow/halo */}
      <circle
        cx={cx}
        cy={cy}
        r={12}
        fill={color}
        fillOpacity={0.2}
      />
      {/* Middle ring */}
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.6}
      />
      {/* Inner dot */}
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={color}
        stroke="#fff"
        strokeWidth={1}
      />
    </g>
  );
};

// Format multi-blind result from WCA API encoding
// Format: 99DDDDDDDDD (11 digits total)
// - First 2 digits: 99 minus points (solved cubes)
// - Middle 5 digits: time in seconds
// - Last 2 digits: unsuccessful/missed cubes
// Example: 850347501 = 14/15 57:55
//   - 85 = 99 - 14 (solved)
//   - 03475 = 3475 seconds = 57:55
//   - 01 = 1 missed, so attempted = 14 + 1 = 15
function formatMultiBlind(result: number): string {
  if (result <= 0) return 'DNF';

  // Convert to string (9-digit format, not 11!)
  const resultStr = result.toString().padStart(9, '0');

  // First 2 digits: 99 minus solved
  const pointsPart = parseInt(resultStr.substring(0, 2));
  const solved = 99 - pointsPart;

  // Last 2 digits: missed/unsolved cubes
  const missed = parseInt(resultStr.substring(7, 9));

  // Attempted = solved + missed
  const attempted = solved + missed;

  // Middle 5 digits: time in seconds
  const timeSeconds = parseInt(resultStr.substring(2, 7));

  // Format time as HH:MM:SS (multi-blind can be very long)
  const hours = Math.floor(timeSeconds / 3600);
  const minutes = Math.floor((timeSeconds % 3600) / 60);
  const seconds = timeSeconds % 60;

  let timeStr = '';
  if (hours > 0) {
    timeStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else if (minutes > 0) {
    timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    timeStr = `${seconds}s`;
  }

  return `${solved}/${attempted} ${timeStr}`;
}

// Format WCA time (in centiseconds) to readable time string
export function formatWcaTime(time: number): string {
  if (time <= 0) return 'DNF';
  const seconds = time / 100;
  if (seconds < 60) {
    return seconds.toFixed(2) + 's';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`;
}

// Format value based on result type and event
function formatValue(value: number, resultType: string, eventId: string = ''): string {
  // Multi-blind special formatting
  if (eventId === '333mbf') {
    return formatMultiBlind(value);
  }

  // FMC (fewest moves) - move count, not time
  if (eventId === '333fm') {
    if (value <= 0) return 'DNF';
    return Math.round(value).toString();
  }

  // Rank and record types
  if (resultType === 'rank') {
    return Math.round(value).toString();
  }
  if (resultType === 'cr' || resultType === 'nr' || resultType === 'wr') {
    return Math.round(value).toString();
  }
  // Time-based events
  return formatWcaTime(value);
}

async function fetchPerson(wcaId: string) {
  const response = await fetch(`${API_BASE}/api/persons/${wcaId}.json`);
  if (!response.ok) throw new Error('Person not found');
  return response.json();
}

async function fetchCompetitions(_wcaId: string, competitionIds: string[]) {
  const compMap = new Map();
  await Promise.all(
    competitionIds.map(async (compId) => {
      try {
        const response = await fetch(`${API_BASE}/api/competitions/${compId}.json`);
        if (response.ok) {
          const comp = await response.json();
          console.log(`Fetched competition ${compId}:`, comp);
          console.log(`  - date object:`, comp.date);
          compMap.set(compId, comp);
        }
      } catch (e) {
        console.error(`Failed to fetch ${compId}`);
      }
    })
  );
  return compMap;
}

async function fetchGraphData(wcaId: string, event: string, resultType: string): Promise<{ personName: string; dataPoints: DataPoint[] }> {
  const person = await fetchPerson(wcaId);
  const competitions = await fetchCompetitions(wcaId, person.competitionIds);

  console.log('=== DEBUG fetchGraphData ===');
  console.log('WCA ID:', wcaId);
  console.log('Event:', event);
  console.log('Result Type:', resultType);
  console.log('Person name:', person.name);
  console.log('Competition IDs:', person.competitionIds);
  console.log('Person results keys:', Object.keys(person.results || {}));

  const dataPoints: DataPoint[] = [];

  for (const compId of person.competitionIds) {
    const comp = competitions.get(compId);
    if (!comp) {
      console.log(`Skipping ${compId}: competition not found`);
      continue;
    }

    console.log(`Processing ${compId}:`, comp.name);
    console.log(`  person.results[${compId}]:`, person.results[compId]);

    const compResults = person.results[compId];
    if (!compResults) {
      console.log(`  Skipping: no results for this competition`);
      continue;
    }

    console.log(`  compResults keys:`, Object.keys(compResults));
    console.log(`  compResults[${event}]:`, compResults[event]);

    if (!compResults[event]) {
      console.log(`  Skipping: no ${event} results`);
      continue;
    }

    const results = compResults[event];

    console.log(`  results array:`, results);
    console.log(`  resultType: ${resultType}`);

    // Parse date - use comp.date.from
    let compDate: Date;
    try {
      compDate = new Date(comp.date.from);
      if (isNaN(compDate.getTime())) {
        console.error('Date parsing error for:', comp.date.from);
        continue;
      }
    } catch (e) {
      console.error('Date parsing error for:', comp.date.from);
      continue;
    }

    if (resultType === 'single') {
      let addedCount = 0;
      for (const result of results) {
        console.log(`    Checking result:`, result);
        // Include DNF results with a flag
        const isDNF = result.best < 0;
        dataPoints.push({
          date: compDate,
          competitionName: comp.name,
          value: isDNF ? 0 : result.best, // Will be replaced with estimated value
          round: result.round,
          position: result.position,
          isDNF,
        });
        addedCount++;
      }
      console.log(`  Added ${addedCount} single results`);
    } else if (resultType === 'average') {
      let addedCount = 0;
      for (const result of results) {
        console.log(`    Checking result:`, result);
        const isDNF = !result.average || result.average <= 0;
        dataPoints.push({
          date: compDate,
          competitionName: comp.name,
          value: isDNF ? 0 : result.average,
          round: result.round,
          position: result.position,
          isDNF,
        });
        addedCount++;
      }
      console.log(`  Added ${addedCount} average results`);
    } else if (resultType === 'rank') {
      let addedCount = 0;
      for (const result of results) {
        console.log(`    Checking result:`, result);
        dataPoints.push({
          date: compDate,
          competitionName: comp.name,
          value: result.position,
          round: result.round,
          isDNF: false,
        });
        addedCount++;
      }
      console.log(`  Added ${addedCount} rank results`);
    } else if (resultType === 'cr' || resultType === 'nr' || resultType === 'wr') {
      // Use person's rank object which contains historical ranking data
      // The rank object has structure: { singles: { eventId: [{world, continent, country}] }, averages: {...} }
      let addedCount = 0;

      // Determine if we should use singles or averages based on typical usage
      // For 'wr', 'nr', 'cr' we typically want single rankings
      const rankCategory = 'singles'; // Could also be 'averages'

      if (person.rank && person.rank[rankCategory] && person.rank[rankCategory][event]) {
        const rankHistory = person.rank[rankCategory][event];

        // The rankHistory array contains rank entries in chronological order
        // We need to match each competition result to its corresponding rank entry
        let rankIndex = 0;

        for (const result of results) {
          // Get the rank entry for this competition
          // The rank array should be in the same order as the competition results
          if (rankIndex < rankHistory.length) {
            const rankEntry = rankHistory[rankIndex];

            let rankValue = result.position; // Default to competition position

            // Extract the appropriate rank based on resultType
            if (resultType === 'wr' && rankEntry.world !== undefined) {
              rankValue = rankEntry.world;
            } else if (resultType === 'cr' && rankEntry.country !== undefined) {
              rankValue = rankEntry.country;
            } else if (resultType === 'nr' && rankEntry.continent !== undefined) {
              rankValue = rankEntry.continent;
            }

            console.log(`    ${resultType} rank for ${result.round}:`, rankValue, '(rankEntry:', rankEntry, ')');

            dataPoints.push({
              date: compDate,
              competitionName: comp.name,
              value: rankValue,
              round: result.round,
              isDNF: false,
            });
            addedCount++;
            rankIndex++;
          }
        }
      } else {
        console.log(`  No rank data found for ${event} in ${rankCategory}, falling back to competition position`);
        // Fallback to competition position if rank data not available
        for (const result of results) {
          dataPoints.push({
            date: compDate,
            competitionName: comp.name,
            value: result.position,
            round: result.round,
            isDNF: false,
          });
          addedCount++;
        }
      }
      console.log(`  Added ${addedCount} ${resultType} results`);
    } else if (resultType === 'solves') {
      let addedCount = 0;
      for (const result of results) {
        console.log(`    Checking result for solves:`, result);
        // Try multiple possible fields for individual solves
        const solvesArray = result.solves || result.trips || [
          result.solve1,
          result.solve2,
          result.solve3,
          result.solve4,
          result.solve5
        ].filter(s => s !== undefined);

        if (solvesArray && solvesArray.length > 0) {
          for (const solve of solvesArray) {
            if (solve !== undefined && solve !== null) {
              const isDNF = solve < 0 || solve === -1;
              dataPoints.push({
                date: compDate,
                competitionName: comp.name,
                value: isDNF ? 0 : solve,
                round: result.round,
                isDNF,
              });
              addedCount++;
            }
          }
        } else {
          console.log(`      No solves found in result, available keys:`, Object.keys(result));
        }
      }
      console.log(`  Added ${addedCount} individual solves`);
    } else if (resultType === 'worst') {
      let addedCount = 0;
      for (const result of results) {
        console.log(`    Checking result for worst solve:`, result);
        // Try multiple possible fields for individual solves
        const solvesArray = result.solves || result.trips || [
          result.solve1,
          result.solve2,
          result.solve3,
          result.solve4,
          result.solve5
        ].filter(s => s !== undefined);

        if (solvesArray && solvesArray.length > 0) {
          // Filter out DNFs and negative values, then find the worst (highest) valid time
          const validSolves = solvesArray.filter((s: any) => s !== undefined && s !== null && s > 0);
          if (validSolves.length > 0) {
            const worstSolve = Math.max(...validSolves);
            dataPoints.push({
              date: compDate,
              competitionName: comp.name,
              value: worstSolve,
              round: result.round,
              isDNF: false,
            });
            addedCount++;
          }
        } else {
          console.log(`      No solves found in result, available keys:`, Object.keys(result));
        }
      }
      console.log(`  Added ${addedCount} worst solve times`);
    }
  }

  // Estimate values for DNF points based on previous non-DNF result
  const sortedPoints = dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());
  let lastValidValue = sortedPoints.find(p => !p.isDNF)?.value || 0;

  for (const point of sortedPoints) {
    if (point.isDNF) {
      point.value = lastValidValue; // Use last valid value for DNF
    } else {
      lastValidValue = point.value;
    }
  }

  console.log(`Final dataPoints count: ${dataPoints.length}`);
  console.log('=========================');

  return {
    personName: person.name,
    dataPoints: sortedPoints,
  };
}

function App() {
  const [wcaId, setWcaId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('333');
  const [selectedResultType, setSelectedResultType] = useState('single');
  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [hoveredDataArray, setHoveredDataArray] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingGraphId, setEditingGraphId] = useState<number | null>(null);
  const [editedWcaId, setEditedWcaId] = useState('');
  const [editedEvent, setEditedEvent] = useState('');
  const [editedResultType, setEditedResultType] = useState('');
  const [showImprovementMode, setShowImprovementMode] = useState(false);
  const [showPercentChange, setShowPercentChange] = useState(false);
  const [showUnitChange, setShowUnitChange] = useState(false);

  console.log('=== App Component Loaded (v2) - Raw mode by default ===');

  const events = [
    { id: '333', name: '3x3x3' },
    { id: '222', name: '2x2x2' },
    { id: '444', name: '4x4x4' },
    { id: '555', name: '5x5x5' },
    { id: '666', name: '6x6x6' },
    { id: '777', name: '7x7x7' },
    { id: '333oh', name: '3x3 One-Handed' },
    { id: '333bf', name: '3x3 Blindfolded' },
    { id: '444bf', name: '4x4 Blindfolded' },
    { id: '555bf', name: '5x5 Blindfolded' },
    { id: '333mbf', name: '3x3 Multi-Blind' },
    { id: '333fm', name: '3x3 Fewest Moves' },
    { id: 'clock', name: 'Clock' },
    { id: 'minx', name: 'Megaminx' },
    { id: 'pyram', name: 'Pyraminx' },
    { id: 'skewb', name: 'Skewb' },
    { id: 'sq1', name: 'Square-1' },
  ];

  const resultTypes = [
    { value: 'single', label: 'Single Best' },
    { value: 'average', label: 'Average' },
    { value: 'rank', label: 'Rank (Position)' },
    { value: 'solves', label: 'All Solves' },
    { value: 'worst', label: 'Worst Solve Time' },
  ];

  // Graph colors for consistent coloring
  const GRAPH_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#eab308'];

  // Reset state to homepage
  const resetToHomepage = () => {
    setGraphs([]);
    setWcaId('');
    setSelectedEvent('333');
    setSelectedResultType('single');
    setSearchQuery('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setHoveredData(null);
    setHoveredDataArray([]);
    setShowImprovementMode(false);
    setShowPercentChange(false);
    setShowUnitChange(false);
    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Parse URL params on mount to restore graphs
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const graphParams: Graph[] = [];

    // Parse view mode from URL
    const viewMode = params.get('view');
    if (viewMode === 'unit') {
      setShowImprovementMode(true);
      setShowUnitChange(true);
      setShowPercentChange(false);
    } else if (viewMode === 'percent') {
      setShowImprovementMode(true);
      setShowPercentChange(true);
      setShowUnitChange(false);
    } else {
      setShowImprovementMode(false);
      setShowUnitChange(false);
      setShowPercentChange(false);
    }

    params.forEach((value, key) => {
      if (key.startsWith('g')) {
        const parts = value.split(':');
        if (parts.length === 3) {
          const [wcaId, event, resultType] = parts;
          graphParams.push({
            id: parseInt(key.substring(1)),
            wcaId,
            event,
            resultType,
            color: GRAPH_COLORS[graphParams.length % GRAPH_COLORS.length],
            loading: true,
            dataPoints: []
          });
        }
      }
    });

    if (graphParams.length > 0) {
      setGraphs(graphParams);
      // Fetch data for each graph using the same API as the main app
      graphParams.forEach(async (graph) => {
        try {
          // Use the same fetchGraphData function as the main app
          const result = await fetchGraphData(graph.wcaId, graph.event, graph.resultType);

          setGraphs(prev => prev.map(g =>
            g.id === graph.id
              ? { ...g, loading: false, personName: result.personName, dataPoints: result.dataPoints }
              : g
          ));
        } catch (error) {
          console.error('Error loading graph from URL:', error);
          setGraphs(prev => prev.map(g =>
            g.id === graph.id
              ? { ...g, loading: false, error: 'Failed to load data' }
              : g
          ));
        }
      });
    }
  }, []);

  // Update URL when graphs or view mode changes
  useEffect(() => {
    if (graphs.length === 0) {
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const params = new URLSearchParams();
    graphs.forEach((graph, index) => {
      params.set(`g${index + 1}`, `${graph.wcaId}:${graph.event}:${graph.resultType}`);
    });

    // Add view mode to URL
    if (showImprovementMode) {
      if (showPercentChange) {
        params.set('view', 'percent');
      } else if (showUnitChange) {
        params.set('view', 'unit');
      }
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [graphs, showImprovementMode, showUnitChange, showPercentChange]);

  // Search for WCA persons by name or ID
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        // First, try direct person lookup if it looks like a WCA ID
        if (/^\d{4}[A-Z]{4}\d{2}$/.test(searchQuery)) {
          try {
            const response = await fetch(`${API_BASE}/api/persons/${searchQuery.toUpperCase()}.json`);
            if (response.ok) {
              const person = await response.json();
              setSearchSuggestions([{ wcaId: person.wcaId || searchQuery.toUpperCase(), name: person.name }]);
              setShowSuggestions(true);
              return;
            }
          } catch (e) {
            // Continue to name search
          }
        }

        // Use official WCA search API
        const response = await fetch(`https://www.worldcubeassociation.org/api/v0/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();

          if (data.result && Array.isArray(data.result)) {
            // Filter for only persons (exclude competitions)
            const persons = data.result.filter((item: any) => item.class === 'person');

            if (persons.length > 0) {
              // Sort by relevance - prioritize exact matches, then starts with, then contains
              const queryLower = searchQuery.toLowerCase();
              const sortedPersons = persons.sort((a: any, b: any) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aId = (a.wca_id || '').toLowerCase();
                const bId = (b.wca_id || '').toLowerCase();

                // Exact matches first
                const aExact = aName === queryLower || aId === queryLower;
                const bExact = bName === queryLower || bId === queryLower;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                // Starts with query
                const aStarts = aName.startsWith(queryLower) || aId.startsWith(queryLower);
                const bStarts = bName.startsWith(queryLower) || bId.startsWith(queryLower);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                // Name contains query
                const aContains = aName.includes(queryLower);
                const bContains = bName.includes(queryLower);
                if (aContains && !bContains) return -1;
                if (!aContains && bContains) return 1;

                // WCA ID contains query
                const aIdContains = aId.includes(queryLower);
                const bIdContains = bId.includes(queryLower);
                if (aIdContains && !bIdContains) return -1;
                if (!aIdContains && bIdContains) return 1;

                return 0;
              });

              // Limit to 10 results and normalize format
              const limitedResults = sortedPersons.slice(0, 10).map((p: any) => ({
                wcaId: p.wca_id,
                name: p.name
              }));
              setSearchSuggestions(limitedResults);
              setShowSuggestions(true);
            } else {
              setSearchSuggestions([]);
              setShowSuggestions(false);
            }
          } else {
            setSearchSuggestions([]);
            setShowSuggestions(false);
          }
        } else {
          setSearchSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (e) {
        console.error('Search error:', e);
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // Auto-uppercase if it looks like a WCA ID pattern (starts with digit)
    if (/^\d/.test(value)) {
      setWcaId(value.toUpperCase());
    } else {
      setWcaId(value);
    }
  };

  const selectSuggestion = (wcaId: string) => {
    setWcaId(wcaId);
    setSearchQuery(wcaId);
    setShowSuggestions(false);
  };

  // Get next available color (defined before handleAddGraph)
  const getNextColor = () => {
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#eab308'];
    const usedColors = new Set(graphs.map(g => g.color));
    for (const color of colors) {
      if (!usedColors.has(color)) {
        return color;
      }
    }
    // If all colors used, generate a random one
    return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
  };

  const handleAddGraph = async () => {
    if (!wcaId) return;

    // Use the next available color that's not currently in use
    const color = getNextColor();

    const newGraph: Graph = {
      id: Date.now(),
      wcaId: wcaId.toUpperCase(),
      event: selectedEvent,
      resultType: selectedResultType,
      color,
      loading: true,
      dataPoints: [],
    };

    setGraphs([...graphs, newGraph]);
    setWcaId('');
    setSearchQuery('');

    try {
      const data = await fetchGraphData(newGraph.wcaId, newGraph.event, newGraph.resultType);
      setGraphs(prev => prev.map(g =>
        g.id === newGraph.id
          ? { ...g, loading: false, personName: data.personName, dataPoints: data.dataPoints }
          : g
      ));
    } catch (error) {
      console.error('Failed to load graph data:', error);
      setGraphs(prev => prev.map(g =>
        g.id === newGraph.id
          ? { ...g, loading: false, error: `Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}` }
          : g
      ));
    }
  };

  const handleRemoveGraph = (id: number) => {
    setGraphs(graphs.filter(g => g.id !== id));
  };

  const handleStartEdit = (graph: Graph) => {
    setEditingGraphId(graph.id);
    setEditedWcaId(graph.wcaId);
    setEditedEvent(graph.event);
    setEditedResultType(graph.resultType);
  };

  const handleSaveEdit = async (id: number) => {
    const graph = graphs.find(g => g.id === id);
    if (!graph) return;

    // Update the graph with loading state
    setGraphs(prev => prev.map(g =>
      g.id === id
        ? { ...g, wcaId: editedWcaId.toUpperCase(), event: editedEvent, resultType: editedResultType, loading: true, error: undefined, dataPoints: [] }
        : g
    ));

    try {
      const data = await fetchGraphData(editedWcaId.toUpperCase(), editedEvent, editedResultType);
      setGraphs(prev => prev.map(g =>
        g.id === id
          ? { ...g, loading: false, personName: data.personName, dataPoints: data.dataPoints }
          : g
      ));
    } catch (error) {
      console.error('Failed to update graph data:', error);
      setGraphs(prev => prev.map(g =>
        g.id === id
          ? { ...g, loading: false, error: `Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}` }
          : g
      ));
    }

    setEditingGraphId(null);
    setEditedWcaId('');
    setEditedEvent('');
    setEditedResultType('');
  };

  // Create per-graph data arrays for proper line rendering
  const graphDataArrays = useMemo(() => {
    const result: Map<number, any[]> = new Map();

    for (const graph of graphs) {
      if (graph.loading || graph.error || !graph.personName) continue;
      if (!graph.dataPoints || graph.dataPoints.length === 0) continue;

      // Track used timestamps to add unique offsets
      const usedTimestamps = new Set<number>();

      const dataPoints = graph.dataPoints.map((point, index) => {
        let dateStr = '';
        let displayDate = '';

        try {
          dateStr = point.date.toISOString().split('T')[0];
          // Use more precise date display for data points
          displayDate = point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
          console.error('Date formatting error:', e);
          dateStr = 'Unknown';
          displayDate = 'Unknown';
        }

        // Create a unique date by adding small offset for duplicates
        let uniqueDate = new Date(point.date);
        let timestamp = uniqueDate.getTime();
        let offset = 0;

        // Add millisecond offsets to ensure uniqueness
        while (usedTimestamps.has(timestamp + offset)) {
          offset += 1; // Add 1ms offset
        }
        usedTimestamps.add(timestamp + offset);

        if (offset > 0) {
          uniqueDate = new Date(timestamp + offset);
        }

        // Determine the value to plot (raw or improvement)
        let plotValue = point.isDNF ? null : point.value;
        let improvementValue = null;
        let changeFromPrev = null;

        // Always calculate improvement/change values for all points (not just in improvement mode)
        // Only calculate change if there's an immediate valid previous point (not searching back through DNFs)
        if (index > 0 && !point.isDNF) {
          const prevPoint = graph.dataPoints[index - 1];
          // Only calculate change if the previous point is not DNF
          if (prevPoint && !prevPoint.isDNF) {
            changeFromPrev = point.value - prevPoint.value;

            // Calculate percent improvement
            // Positive = improvement (time decreased, rank improved)
            // Negative = got worse (time increased, rank worsened)
            if (prevPoint.value !== 0) {
              improvementValue = ((prevPoint.value - point.value) / Math.abs(prevPoint.value)) * 100;
              // Cap extreme values to avoid display issues
              if (improvementValue > 500) improvementValue = 500;
              if (improvementValue < -500) improvementValue = -500;
            }
          }
          // If previous point is DNF, changeFromPrev and improvementValue remain null
        }

        // For improvement mode, plot the appropriate value
        // If no valid change value exists (due to DNF before it), set to null to exclude from graph
        if (showImprovementMode) {
          if (showPercentChange) {
            // Plot percentage change, or null if not available
            plotValue = improvementValue !== null ? improvementValue : null;
          } else if (showUnitChange) {
            // Plot unit change, or null if not available
            plotValue = changeFromPrev !== null ? changeFromPrev : null;
          }
        }

        return {
          date: uniqueDate, // Use the unique date with offset
          originalDate: point.date, // Keep original for display
          dateStr,
          displayDate,
          competitionName: point.competitionName || 'Unknown',
          value: plotValue, // Use the plot value (raw or improvement)
          originalValue: point.value, // Keep original value for display
          changeFromPrev, // Store the change for reference
          improvementValue, // Store percent improvement
          round: point.round || '',
          graphId: graph.id,
          pointIndex: index, // Add unique index per point
          wcaId: graph.wcaId,
          event: graph.event,
          resultType: graph.resultType,
          personName: graph.personName || graph.wcaId,
          color: graph.color,
          isDNF: point.isDNF || false,
          // Unique key for React
          uniqueKey: `${graph.id}-${index}-${point.date.getTime()}`,
        };
      });

      result.set(graph.id, dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime()));
    }

    return result;
  }, [graphs, showImprovementMode, showPercentChange, showUnitChange]);

  // Create separate data arrays for DNF points (for Scatter chart)
  const dnfDataArrays = useMemo(() => {
    const result: Map<number, any[]> = new Map();

    for (const graph of graphs) {
      if (graph.loading || graph.error || !graph.personName) continue;
      if (!graph.dataPoints || graph.dataPoints.length === 0) continue;

      // Track used timestamps to add unique offsets for DNF points
      const usedTimestamps = new Set<number>();

      const dnfPoints = graph.dataPoints
        .filter((point) => point.isDNF)
        .map((point, index) => {
          let uniqueDate = new Date(point.date);
          let timestamp = uniqueDate.getTime();
          let offset = 0;

          // Add millisecond offsets to ensure uniqueness
          while (usedTimestamps.has(timestamp + offset)) {
            offset += 1;
          }
          usedTimestamps.add(timestamp + offset);

          if (offset > 0) {
            timestamp = timestamp + offset;
            uniqueDate = new Date(timestamp);
          }

          // For Scatter to work with tooltip in a time-based LineChart, we need to use the same data structure
          // The XAxis uses dataKey="date" with Date objects, so we must match that
          const scatterPoint = {
            date: uniqueDate, // Date object for X-axis (must match Line's dataKey)
            originalDate: point.date,
            dateStr: uniqueDate.toISOString().split('T')[0],
            displayDate: uniqueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            competitionName: point.competitionName || 'Unknown',
            value: point.value, // Y-axis value
            estimatedValue: point.value,
            originalValue: point.value,
            round: point.round || '',
            graphId: graph.id,
            pointIndex: index,
            wcaId: graph.wcaId,
            event: graph.event,
            resultType: graph.resultType,
            personName: graph.personName || graph.wcaId,
            color: graph.color,
            isDNF: true,
            uniqueKey: `${graph.id}-dnf-${index}-${point.date.getTime()}`,
          };
          return scatterPoint;
        });

      if (dnfPoints.length > 0) {
        result.set(graph.id, dnfPoints);
      }
    }

    return result;
  }, [graphs, showImprovementMode, showPercentChange, showUnitChange]);

  // Combined data for table view and tooltip
  const allChartData = useMemo(() => {
    const result: any[] = [];
    const usedTimestamps = new Set<number>();

    // Include regular graph data (with DNF points having null value)
    for (const [, data] of graphDataArrays) {
      for (const point of data) {
        // Create a unique copy of the point with a unique timestamp
        let uniqueDate = new Date(point.date);
        let timestamp = uniqueDate.getTime();
        let offset = 0;

        while (usedTimestamps.has(timestamp + offset)) {
          offset += 1;
        }
        usedTimestamps.add(timestamp + offset);

        if (offset > 0) {
          uniqueDate = new Date(timestamp + offset);
        }

        result.push({
          ...point,
          date: uniqueDate,
        });
      }
    }

    // Also include DNF points with their original value for tooltip display
    for (const [, dnfData] of dnfDataArrays) {
      for (const point of dnfData) {
        // Find unique timestamp for DNF points
        let uniqueDate = new Date(point.date);
        let timestamp = uniqueDate.getTime();
        let offset = 0;

        while (usedTimestamps.has(timestamp + offset)) {
          offset += 1;
        }
        usedTimestamps.add(timestamp + offset);

        if (offset > 0) {
          uniqueDate = new Date(timestamp + offset);
        }

        result.push({
          ...point,
          date: uniqueDate,
        });
      }
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [graphDataArrays, dnfDataArrays]);

  // Calculate Y-axis domain that includes both regular and DNF values
  const yAxisDomain = useMemo(() => {
    const allValues: number[] = [];

    // Collect all non-null values from graph data (in percentage mode, these are already percentages)
    for (const [, data] of graphDataArrays) {
      for (const point of data) {
        if (point.value !== null && point.value !== undefined && !point.isDNF) {
          allValues.push(point.value);
        }
      }
    }

    if (allValues.length === 0) {
      return [0, 1000];
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    // For percentage mode, ensure zero is visible
    if (showImprovementMode && showPercentChange) {
      // Ensure we include 0 in the range
      const rangeMin = Math.min(min, 0);
      const rangeMax = Math.max(max, 0);
      // Add small padding (2%) to prevent points from being on the edge
      const padding = Math.max(Math.abs(rangeMax - rangeMin) * 0.02, 1);
      return [rangeMin - padding, rangeMax + padding];
    }

    // Add minimal padding (1%) just to prevent points from being on the edge
    const padding = (max - min) * 0.01;
    return [min - padding, max + padding];
  }, [graphDataArrays, showImprovementMode, showPercentChange, showUnitChange]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo" onClick={resetToHomepage} style={{ cursor: 'pointer' }}>
            <BarChart3 size={20} />
            <h1>Graphisizer</h1>
          </div>
        </div>
      </header>

      <main className="app-main">
        <form className="form-bar" onSubmit={(e) => { e.preventDefault(); handleAddGraph(); }}>
          <div className="form-bar-row">
            <div className="form-group" style={{ position: 'relative' }}>
              <label>WCA ID or Name</label>
              <input
                type="text"
                placeholder="Search by ID or name..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="form-input"
                autoComplete="off"
              />
              {showSuggestions && searchSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0 0 8px 8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                }}>
                  {searchSuggestions.map((person) => (
                    <div
                      key={person.wcaId}
                      onClick={() => selectSuggestion(person.wcaId)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #334155',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 'bold', color: '#f1f5f9' }}>{person.name}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{person.wcaId}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Event</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="form-input"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Result Type</label>
              <select
                value={selectedResultType}
                onChange={(e) => setSelectedResultType(e.target.value)}
                className="form-input"
              >
                {resultTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn-primary">
              + Add Graph
            </button>
          </div>
        </form>

        {/* Graph controls list - no cards, just horizontal rows */}
        {graphs.length > 0 && (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '8px',
            marginBottom: 'var(--spacing-md)',
            boxShadow: 'var(--shadow)',
          }}>
            {graphs.map((graph) => (
              <div
                key={graph.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px',
                  borderBottom: graph.id !== graphs[graphs.length - 1].id ? '1px solid var(--border-color)' : 'none',
                  flexWrap: 'wrap',
                }}
              >
                {/* Color indicator and name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
                  <div style={{ width: '4px', height: '32px', backgroundColor: graph.color, borderRadius: '2px' }} />
                  <div>
                    <div style={{ color: graph.color, fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {graph.personName || graph.wcaId}
                    </div>
                    {graph.loading && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading...</div>
                    )}
                    {graph.error && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-error)' }}>{graph.error}</div>
                    )}
                  </div>
                </div>

                {/* Editable controls */}
                <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '200px', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>WCA ID</label>
                    <input
                      type="text"
                      value={editingGraphId === graph.id ? editedWcaId : graph.wcaId}
                      onChange={(e) => {
                        if (editingGraphId === graph.id) {
                          setEditedWcaId(e.target.value.toUpperCase());
                        } else {
                          handleStartEdit(graph);
                          setEditedWcaId(e.target.value.toUpperCase());
                        }
                      }}
                      onBlur={() => {
                        if (editingGraphId === graph.id) {
                          handleSaveEdit(graph.id);
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        background: 'var(--bg-tertiary)',
                        border: editingGraphId === graph.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        minWidth: '100px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Event</label>
                    <select
                      value={editingGraphId === graph.id ? editedEvent : graph.event}
                      onChange={(e) => {
                        if (editingGraphId === graph.id) {
                          setEditedEvent(e.target.value);
                        } else {
                          handleStartEdit(graph);
                          setEditedEvent(e.target.value);
                        }
                      }}
                      onBlur={() => {
                        if (editingGraphId === graph.id) {
                          handleSaveEdit(graph.id);
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        background: 'var(--bg-tertiary)',
                        border: editingGraphId === graph.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                    >
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Type</label>
                    <select
                      value={editingGraphId === graph.id ? editedResultType : graph.resultType}
                      onChange={(e) => {
                        if (editingGraphId === graph.id) {
                          setEditedResultType(e.target.value);
                        } else {
                          handleStartEdit(graph);
                          setEditedResultType(e.target.value);
                        }
                      }}
                      onBlur={() => {
                        if (editingGraphId === graph.id) {
                          handleSaveEdit(graph.id);
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        background: 'var(--bg-tertiary)',
                        border: editingGraphId === graph.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                    >
                      {resultTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stats info */}
                {!graph.loading && !graph.error && graph.dataPoints.length > 0 && (() => {
                  const validPoints = graph.dataPoints.filter(p => !p.isDNF);
                  if (validPoints.length === 0) return null;

                  const isFmc = graph.event === '333fm';
                  const isMultiBlind = graph.event === '333mbf';

                  // For multi-blind, don't calculate statistics since values are encoded
                  if (isMultiBlind) {
                    return (
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>Results: <strong style={{ color: 'var(--text-primary)' }}>{validPoints.length}</strong></span>
                        <span>Statistics not available for Multi-Blind</span>
                      </div>
                    );
                  }

                  const best = Math.min(...validPoints.map(p => p.value));
                  const worst = Math.max(...validPoints.map(p => p.value));
                  const mean = validPoints.reduce((sum, p) => sum + p.value, 0) / validPoints.length;

                  // Calculate median and quartiles
                  const sorted = [...validPoints].sort((a, b) => a.value - b.value);
                  const mid = Math.floor(sorted.length / 2);
                  const median = sorted.length % 2 !== 0 ? sorted[mid].value : (sorted[mid - 1].value + sorted[mid].value) / 2;
                  const q1Index = Math.floor(sorted.length * 0.25);
                  const q3Index = Math.floor(sorted.length * 0.75);
                  const q1 = sorted[q1Index]?.value;
                  const q3 = sorted[q3Index]?.value;
                  const iqr = q1 !== undefined && q3 !== undefined ? q3 - q1 : null;

                  // Calculate std dev and consistency
                  const variance = validPoints.reduce((sum, p) => sum + Math.pow(p.value - mean, 2), 0) / validPoints.length;
                  const stdDev = Math.sqrt(variance);
                  const consistency = mean > 0 ? (stdDev / mean) * 100 : 0;

                  // Format value helper
                  const formatStatValue = (val: number) => {
                    if (isFmc) return val.toFixed(1);
                    return formatWcaTime(val);
                  };

                  // Info icon with tooltip
                  const InfoIcon = ({ title }: { title: string }) => (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '1px solid #64748b',
                        color: '#64748b',
                        fontSize: '10px',
                        lineHeight: '12px',
                        textAlign: 'center',
                        marginLeft: '4px',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        const tooltip = (e.currentTarget as HTMLElement).querySelector(':scope > span:last-child');
                        if (tooltip) {
                          (tooltip as HTMLElement).style.opacity = '1';
                          (tooltip as HTMLElement).style.visibility = 'visible';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const tooltip = (e.currentTarget as HTMLElement).querySelector(':scope > span:last-child');
                        if (tooltip) {
                          (tooltip as HTMLElement).style.opacity = '0';
                          (tooltip as HTMLElement).style.visibility = 'hidden';
                        }
                      }}
                    >
                      i
                      <span style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 4px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '4px 8px',
                        background: '#1e293b',
                        color: '#f1f5f9',
                        fontSize: '11px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        opacity: '0',
                        visibility: 'hidden',
                        transition: 'opacity 0.2s, visibility 0.2s',
                        pointerEvents: 'none',
                        zIndex: 1000,
                      }}>
                        {title}
                      </span>
                    </span>
                  );

                  return (
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>Avg: <strong style={{ color: 'var(--text-primary)' }}>{formatStatValue(mean)}</strong><InfoIcon title="Arithmetic mean of all results" /></span>
                      <span>Med: <strong style={{ color: 'var(--text-primary)' }}>{formatStatValue(median)}</strong><InfoIcon title="Middle value (50th percentile)" /></span>
                      <span>Q1: <strong style={{ color: 'var(--text-primary)' }}>{q1 !== undefined ? formatStatValue(q1) : 'N/A'}</strong><InfoIcon title="25th percentile (25% of results are below this)" /></span>
                      <span>Q3: <strong style={{ color: 'var(--text-primary)' }}>{q3 !== undefined ? formatStatValue(q3) : 'N/A'}</strong><InfoIcon title="75th percentile (75% of results are below this)" /></span>
                      <span>IQR: <strong style={{ color: 'var(--text-primary)' }}>{iqr !== null ? formatStatValue(iqr) : 'N/A'}</strong><InfoIcon title="Interquartile range (Q3 - Q1), measures spread of middle 50%" /></span>
                      <span>Std: <strong style={{ color: 'var(--text-primary)' }}>{formatStatValue(stdDev)}</strong><InfoIcon title="Standard deviation, measures how spread out results are" /></span>
                      <span>Cons: <strong style={{ color: 'var(--text-primary)' }}>{consistency.toFixed(1)}%</strong><InfoIcon title="Coefficient of variation (lower = more consistent)" /></span>
                      <span title={`Best: ${formatStatValue(best)} | Worst: ${formatStatValue(worst)}`}>Results: <strong style={{ color: 'var(--text-primary)' }}>{graph.dataPoints.length}</strong></span>
                    </div>
                  );
                })()}

                {/* Delete button */}
                <button
                  onClick={() => handleRemoveGraph(graph.id)}
                  className="icon-btn"
                  title="Remove"
                  style={{ color: '#ef4444', flex: '0 0 auto' }}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {graphs.length === 0 && (
          <motion.div
            className="global-stats-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              style={{ marginBottom: '24px' }}
            >
              <BarChart3 size={48} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Graphisizer
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{ fontSize: '1.1rem', marginBottom: '40px', color: '#94a3b8' }}
            >
              Visualize WCA competitor progression and compare performances
            </motion.p>

            {/* Usage Guide */}
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '24px',
                  marginBottom: '32px'
                }}
              >
                {/* Step 1 */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '24px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      borderRadius: '10px',
                      padding: '10px',
                      marginRight: '12px'
                    }}>
                      <Search size={24} color="white" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>1. Search Competitors</h3>
                  </div>
                  <p style={{ margin: 0, color: '#94a3b8', lineHeight: '1.6' }}>
                    Enter a WCA ID or name to find competitors
                  </p>
                </motion.div>

                {/* Step 2 */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '24px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #22c55e, #10b981)',
                      borderRadius: '10px',
                      padding: '10px',
                      marginRight: '12px'
                    }}>
                      <TrendingUp size={24} color="white" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>2. Select Event & Type</h3>
                  </div>
                  <p style={{ margin: 0, color: '#94a3b8', lineHeight: '1.6' }}>
                    Choose an event (3x3x3, 2x2x2, etc.) and result type (Single, Average, All Solves)
                  </p>
                </motion.div>

                {/* Step 3 */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '24px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                      borderRadius: '10px',
                      padding: '10px',
                      marginRight: '12px'
                    }}>
                      <Users size={24} color="white" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>3. Compare Multiple</h3>
                  </div>
                  <p style={{ margin: 0, color: '#94a3b8', lineHeight: '1.6' }}>
                    Add up to 10 competitors to their graphs and compare their progression side by side
                  </p>
                </motion.div>

                {/* Step 4 */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '24px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                      borderRadius: '10px',
                      padding: '10px',
                      marginRight: '12px'
                    }}>
                      <Share2 size={24} color="white" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>4. Share URL</h3>
                  </div>
                  <p style={{ margin: 0, color: '#94a3b8', lineHeight: '1.6' }}>
                    The URL automatically updates! Share it with others to show the same comparison
                  </p>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {allChartData.length > 0 && (
          <>
            <div className="chart-container">
              <div className="chart-header-row">
                <h3 className="chart-title">
                  {showImprovementMode ? 'Change' : 'Progression'}
                </h3>
                {(() => {
                  // Determine which view modes are available
                  const hasFmc = graphs.some(g => g.event === '333fm');
                  const hasMultiBlind = graphs.some(g => g.event === '333mbf');
                  const hasRank = graphs.some(g => g.resultType === 'rank');

                  // % change is not available for FMC, multi-blind, or rank
                  const percentChangeDisabled = hasFmc || hasMultiBlind || hasRank;

                  return (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          console.log('Raw button clicked');
                          setShowImprovementMode(false);
                          setShowUnitChange(false);
                          setShowPercentChange(false);
                        }}
                        className={`improvement-toggle ${!showImprovementMode ? 'active' : ''}`}
                        disabled={false}
                      >
                        Raw
                      </button>
                      <button
                        onClick={() => {
                          console.log('Unit button clicked - setting improvement mode');
                          setShowImprovementMode(true);
                          setShowUnitChange(true);
                          setShowPercentChange(false);
                        }}
                        className={`improvement-toggle ${showImprovementMode && showUnitChange ? 'active' : ''}`}
                        disabled={false}
                      >
                        Unit
                      </button>
                      <button
                        onClick={() => {
                          if (!percentChangeDisabled) {
                            console.log('Percent button clicked - setting improvement mode');
                            setShowImprovementMode(true);
                            setShowPercentChange(true);
                            setShowUnitChange(false);
                          }
                        }}
                        className={`improvement-toggle ${showImprovementMode && showPercentChange ? 'active' : ''} ${percentChangeDisabled ? 'disabled' : ''}`}
                        disabled={percentChangeDisabled}
                        style={percentChangeDisabled ? {
                          opacity: 0.4,
                          cursor: 'not-allowed',
                          filter: 'grayscale(100%)'
                        } : {}}
                        title={percentChangeDisabled ? 'Percent change is not available for FMC, multi-blind, or rank results' : ''}
                      >
                        %
                      </button>
                    </div>
                  );
                })()}
              </div>

              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={allChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    onMouseMove={(state: any) => {
                      if (!state || !state.activePayload || state.activePayload.length === 0) return;

                      const payload = state.activePayload[0];
                      const hoveredPoint = payload.payload;
                      const hoveredOriginalDate = hoveredPoint?.originalDate;

                      // Find ALL data points for each graph with the same originalDate
                      // This catches all solves from the same competition in "all solves" mode
                      const uniqueDataMap = new Map<string, any>();
                      const hoveredTimestamp = hoveredOriginalDate instanceof Date ? hoveredOriginalDate.getTime() : hoveredOriginalDate;

                      console.log('=== HOVER DEBUG ===');
                      console.log('Hovered point:', {
                        displayDate: hoveredPoint?.displayDate,
                        originalDate: hoveredOriginalDate,
                        timestamp: hoveredTimestamp,
                        pointIndex: hoveredPoint?.pointIndex,
                        value: hoveredPoint?.value
                      });

                      for (const graph of graphs) {
                        if (graph.loading || graph.error || !graph.personName) continue;

                        const graphData = graphDataArrays.get(graph.id);
                        if (!graphData || graphData.length === 0) continue;

                        console.log(`Checking graph "${graph.personName}" with ${graphData.length} points`);

                        // Find all points with the same originalDate (same competition/day)
                        const closePoints = graphData.filter(point => {
                          const pointTimestamp = point.originalDate instanceof Date ? point.originalDate.getTime() : point.originalDate;
                          const diff = Math.abs(pointTimestamp - hoveredTimestamp);
                          // Use 12 hours (43200000 ms) tolerance to catch all solves from same round
                          const isMatch = diff < 12 * 60 * 60 * 1000;
                          if (isMatch) {
                            console.log(`  → Match found: timestamp=${pointTimestamp}, diff=${diff}ms, pointIndex=${point.pointIndex}, value=${point.value}`);
                          }
                          return isMatch;
                        });

                        console.log(`  Found ${closePoints.length} matching points in this graph`);

                        for (const point of closePoints) {
                          const dedupeKey = `${graph.id}-${point.originalDate.getTime()}-${point.pointIndex}`;
                          uniqueDataMap.set(dedupeKey, point);
                        }

                        // Also check DNF points
                        const dnfData = dnfDataArrays.get(graph.id);
                        if (dnfData && dnfData.length > 0) {
                          const closeDNFPoints = dnfData.filter(point => {
                            const pointTimestamp = point.originalDate instanceof Date ? point.originalDate.getTime() : point.originalDate;
                            const diff = Math.abs(pointTimestamp - hoveredTimestamp);
                            return diff < 12 * 60 * 60 * 1000;
                          });
                          console.log(`  Found ${closeDNFPoints.length} matching DNF points`);
                          for (const point of closeDNFPoints) {
                            const dedupeKey = `${graph.id}-${point.originalDate.getTime()}-${point.pointIndex}`;
                            uniqueDataMap.set(dedupeKey, { ...point, isDNF: true, originalValue: point.value });
                          }
                        }
                      }

                      const allGraphsData = Array.from(uniqueDataMap.values());

                      console.log('TOTAL:', allGraphsData.length, 'points found');
                      console.log('==================');
                      setHoveredData(hoveredPoint);
                      setHoveredDataArray(allGraphsData);
                    }}
                  >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                        tickFormatter={(date) => {
                          if (!(date instanceof Date)) return '';
                          return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        }}
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                        tickFormatter={(value) => {
                          // Get the first graph's result type to determine formatting
                          const firstGraph = graphs.find(g => !g.loading && !g.error);
                          const resultType = firstGraph?.resultType || 'single';
                          const eventId = firstGraph?.event || '333';
                          const isTimeBased = !['rank', 'cr', 'nr', 'wr'].includes(resultType);

                          if (showImprovementMode && showPercentChange) {
                            // Show percentage format - round to whole numbers
                            const roundedValue = Math.round(value);
                            return `${roundedValue}%`;
                          } else if (showImprovementMode && showUnitChange) {
                            // Show unit change - for time-based, round to nearest centisecond; for rank, use integers
                            if (isTimeBased) {
                              return formatWcaTime(Math.abs(value));
                            } else {
                              return (value > 0 ? '+' : '') + Math.round(value);
                            }
                          } else {
                            // Raw mode - for time-based, round to reasonable precision; for rank, use integers
                            if (isTimeBased) {
                              // For time values, round to nearest centisecond (divisible by 10)
                              const roundedValue = Math.round(value / 10) * 10;
                              return formatValue(roundedValue, resultType, eventId);
                            } else {
                              // For rank, always use whole numbers
                              return Math.round(value).toString();
                            }
                          }
                        }}
                        domain={yAxisDomain}
                      />
                      {(showImprovementMode || showPercentChange) && (
                        <ReferenceLine
                          y={0}
                          stroke="#64748b"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                      )}
                      <Tooltip
                        content={(props: any) => {
                          if (props.active && props.payload && props.payload.length > 0) {
                            // Show ALL graphs' data when hovering - for "all solves" this shows multiple points
                            const hoveredPayload = props.payload[0].payload;
                            const hoveredOriginalDate = hoveredPayload?.originalDate;
                            const hoveredTimestamp = hoveredOriginalDate instanceof Date ? hoveredOriginalDate.getTime() : hoveredOriginalDate;

                            // Find ALL data points for each graph with the same originalDate
                            const uniqueDataMap = new Map<string, any>();

                            for (const graph of graphs) {
                              if (graph.loading || graph.error || !graph.personName) continue;

                              const graphData = graphDataArrays.get(graph.id);
                              if (!graphData || graphData.length === 0) continue;

                              // Find all points with the same originalDate (within 12 hours)
                              const closePoints = graphData.filter(point => {
                                const pointTimestamp = point.originalDate instanceof Date ? point.originalDate.getTime() : point.originalDate;
                                const diff = Math.abs(pointTimestamp - hoveredTimestamp);
                                return diff < 12 * 60 * 60 * 1000;
                              });

                              for (const point of closePoints) {
                                const dedupeKey = `${graph.id}-${point.originalDate.getTime()}-${point.pointIndex}`;
                                uniqueDataMap.set(dedupeKey, point);
                              }

                              // Also check DNF points
                              const dnfData = dnfDataArrays.get(graph.id);
                              if (dnfData && dnfData.length > 0) {
                                const closeDNFPoints = dnfData.filter(point => {
                                  const pointTimestamp = point.originalDate instanceof Date ? point.originalDate.getTime() : point.originalDate;
                                  const diff = Math.abs(pointTimestamp - hoveredTimestamp);
                                  return diff < 12 * 60 * 60 * 1000;
                                });
                                for (const point of closeDNFPoints) {
                                  const dedupeKey = `${graph.id}-${point.originalDate.getTime()}-${point.pointIndex}`;
                                  uniqueDataMap.set(dedupeKey, { ...point, isDNF: true, originalValue: point.value });
                                }
                              }
                            }

                            const allGraphsData = Array.from(uniqueDataMap.values());

                            requestAnimationFrame(() => {
                              setHoveredData(hoveredPayload);
                              setHoveredDataArray(allGraphsData);
                            });
                          } else {
                            // Keep the last selected data visible - don't clear on mouse leave
                          }
                          return null;
                        }}
                        cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                        isAnimationActive={false}
                      />
                      <Legend
                        wrapperStyle={{ color: '#f1f5f9' }}
                        iconType="line"
                        content={(props: any) => {
                          const { payload } = props;
                          return (
                            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px' }}>
                              {payload.map((entry: any, index: number) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <svg width="20" height="10" viewBox="0 0 20 10">
                                    <line
                                      x1="0"
                                      y1="5"
                                      x2="20"
                                      y2="5"
                                      stroke={entry.color}
                                      strokeWidth={2}
                                    />
                                  </svg>
                                  <span style={{ color: '#f1f5f9', fontSize: '14px' }}>
                                    {entry.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      {graphs
                        .filter((g) => !g.loading && !g.error && g.dataPoints.length > 0)
                        .map((graph) => {
                          const graphData = graphDataArrays.get(graph.id) || [];
                          return (
                            <Line
                              key={graph.id}
                              data={graphData}
                              type="monotone"
                              dataKey="value"
                              stroke={graph.color}
                              strokeWidth={2}
                              dot={<CustomDot />}
                              activeDot={<CustomActiveDot />}
                              name={`${graph.personName} (${graph.wcaId})`}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          );
                        })}
                      {/* Render DNF points as gray dots using Scatter - only in raw mode */}
                      {!showImprovementMode && graphs
                        .filter((g) => !g.loading && !g.error && g.dataPoints.length > 0)
                        .map((graph) => {
                          const dnfData = dnfDataArrays.get(graph.id);
                          if (!dnfData || dnfData.length === 0) return null;
                          return (
                            <Scatter
                              key={`dnf-${graph.id}`}
                              data={dnfData}
                              dataKey="value"
                              shape={<DNFDot />}
                              legendType="none"
                              isAnimationActive={false}
                              cursor="pointer"
                              onMouseEnter={(point: any) => {
                                console.log('DNF point hovered:', point);
                                setHoveredData(point);
                                setHoveredDataArray([point]);
                              }}
                              onClick={(point: any) => {
                                console.log('DNF point clicked:', point);
                                setHoveredData(point);
                                setHoveredDataArray([{ ...point, isDNF: true, originalValue: point.value }]);
                              }}
                            />
                          );
                        })}
                      {/* Render highlighted dots for all hovered points - shows multiple bubbles when hovering stacked dots */}
                      {hoveredDataArray.length > 0 && (() => {
                        // Filter out DNF points - they're already rendered separately and have special positioning
                        // Only highlight regular data points
                        const scatterData = hoveredDataArray
                          .filter(p => !p.isDNF)
                          .map(p => ({
                            ...p,
                            date: p.date instanceof Date ? p.date.getTime() : p.date
                          }));

                        if (scatterData.length === 0) return null;

                        return (
                          <Scatter
                            data={scatterData}
                            dataKey="value"
                            shape={(props: any) => {
                              const { cx, cy, payload } = props;
                              const graph = graphs.find(g => g.id === payload.graphId);
                              const color = graph?.color || '#3b82f6';
                              return (
                                <g>
                                  {/* Outer glow */}
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={12}
                                    fill={color}
                                    fillOpacity={0.2}
                                    stroke={color}
                                    strokeWidth={1}
                                  />
                                  {/* Inner solid dot */}
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={6}
                                    fill={color}
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                  />
                                </g>
                              );
                            }}
                            legendType="none"
                            isAnimationActive={false}
                          />
                        );
                      })()}
                    </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

                {/* Comparison Panel - always shown when there are graphs */}
                {graphs.length > 0 && (
                  <div className="info-panel">
                    <div className="comparison-list">
                      {(() => {
                        // Calculate all comparison-wide stats first (independent of selection)
                        const firstGraph = graphs.find((g: any) => g.id);
                        const resultType = firstGraph?.resultType || 'single';
                        const eventId = firstGraph?.event || '333';
                        const isTimeBased = ['single', 'average', 'solves', 'worst'].includes(resultType);
                        const isFmc = eventId === '333fm';
                        const isMultiBlind = eventId === '333mbf';

                        // Check for incompatible unit types across graphs
                        const hasFmc = graphs.some(g => g.event === '333fm');
                        const hasMultiBlind = graphs.some(g => g.event === '333mbf');
                        const hasTimeBased = graphs.some(g => !['333fm', '333mbf'].includes(g.event || '') && !['rank'].includes(g.resultType || ''));
                        const hasRank = graphs.some(g => g.resultType === 'rank');

                        // Determine if we have incompatible types
                        const incompatibleTypes = (hasFmc && (hasMultiBlind || hasTimeBased || hasRank)) ||
                                                  (hasMultiBlind && (hasFmc || hasTimeBased || hasRank)) ||
                                                  (hasRank && (hasFmc || hasMultiBlind)) ||
                                                  (hasTimeBased && (hasFmc || hasMultiBlind));

                        const unitTypes = [];
                        if (hasFmc) unitTypes.push('FMC (moves)');
                        if (hasMultiBlind) unitTypes.push('Multi-Blind');
                        if (hasTimeBased) unitTypes.push('Time-based');
                        if (hasRank) unitTypes.push('Rank');

                        // Calculate global/comparison-wide stats from ALL data points
                        const allValidPoints = allChartData.filter(p => !p.isDNF && p.value !== null && p.value !== undefined && p.value > 0);
                        const globalStats = allValidPoints.length > 0 ? {
                          mean: allValidPoints.reduce((sum, p) => sum + p.value, 0) / allValidPoints.length,
                          median: (() => {
                            const sorted = [...allValidPoints].sort((a, b) => a.value - b.value);
                            const mid = Math.floor(sorted.length / 2);
                            return sorted.length % 2 !== 0 ? sorted[mid].value : (sorted[mid - 1].value + sorted[mid].value) / 2;
                          })(),
                          min: Math.min(...allValidPoints.map(p => p.value)),
                          max: Math.max(...allValidPoints.map(p => p.value)),
                          stdDev: allValidPoints.length > 1 ? (() => {
                            const mean = allValidPoints.reduce((sum, p) => sum + p.value, 0) / allValidPoints.length;
                            const variance = allValidPoints.reduce((sum, p) => sum + Math.pow(p.value - mean, 2), 0) / allValidPoints.length;
                            return Math.sqrt(variance);
                          })() : null
                        } : null;

                        // Calculate head-to-head stats between graphs
                        const headToHeadStats: Map<string, {
                          personName: string;
                          graphId: string;
                          event: string;
                          wins: number;
                          meetings: number;
                          avgPosition: number;
                          improvements: number;
                          totalChanges: number;
                        }> = new Map();

                        let correlationStats = null;
                        if (graphs.length > 1) {
                          // Initialize stats for each graph
                          for (const graph of graphs) {
                            if (graph.loading || graph.error) continue;
                            const personName = graph.personName || graph.wcaId;
                            const uniqueKey = `${personName}__${graph.id}`;
                            headToHeadStats.set(uniqueKey, {
                              personName,
                              graphId: String(graph.id),
                              event: graph.event || 'Unknown',
                              wins: 0,
                              meetings: 0,
                              avgPosition: 0,
                              improvements: 0,
                              totalChanges: 0
                            });
                          }

                          // Group all chart data by original date to find head-to-head meetings
                          const dateGroups = new Map<number, any[]>();
                          for (const dataPoint of allChartData) {
                            if (dataPoint.isDNF || dataPoint.value === null || dataPoint.value === undefined) continue;
                            const timestamp = dataPoint.originalDate instanceof Date ? dataPoint.originalDate.getTime() : dataPoint.date.getTime();
                            if (!dateGroups.has(timestamp)) {
                              dateGroups.set(timestamp, []);
                            }
                            dateGroups.get(timestamp)!.push(dataPoint);
                          }

                          // Process each meeting
                          const positions: Map<string, number[]> = new Map();
                          for (const [uniqueKey] of headToHeadStats) {
                            positions.set(uniqueKey, []);
                          }

                          for (const [, dataPoints] of dateGroups) {
                            const participants = dataPoints.filter(dp =>
                              headToHeadStats.has(`${dp.personName}__${dp.graphId}`)
                            );

                            if (participants.length >= 2) {
                              const sorted = isTimeBased
                                ? [...participants].sort((a, b) => a.value - b.value)
                                : [...participants].sort((a, b) => b.value - a.value);

                              for (let position = 0; position < sorted.length; position++) {
                                const competitor = sorted[position];
                                const uniqueKey = `${competitor.personName}__${competitor.graphId}`;
                                const stats = headToHeadStats.get(uniqueKey);
                                if (stats) {
                                  stats.meetings++;
                                  if (position === 0) {
                                    stats.wins++;
                                  }
                                  positions.get(uniqueKey)!.push(position);
                                }
                              }
                            }
                          }

                          // Calculate average positions and track improvements
                          for (const [uniqueKey, stats] of headToHeadStats) {
                            const posArray = positions.get(uniqueKey) || [];
                            if (posArray.length > 0) {
                              stats.avgPosition = posArray.reduce((a, b) => a + b, 0) / posArray.length;
                            }
                          }

                          // Track improvements
                          for (const graph of graphs) {
                            if (graph.loading || graph.error) continue;
                            const personName = graph.personName || graph.wcaId;
                            const uniqueKey = `${personName}__${graph.id}`;
                            const stats = headToHeadStats.get(uniqueKey);

                            if (!stats) continue;

                            const graphData = graphDataArrays.get(graph.id) || [];
                            let improvements = 0;
                            let totalChanges = 0;

                            for (let i = 1; i < graphData.length; i++) {
                              const current = graphData[i];
                              const previous = graphData[i - 1];

                              if (!current.isDNF && !previous.isDNF) {
                                totalChanges++;
                                if (isTimeBased) {
                                  if (current.value < previous.value) improvements++;
                                } else {
                                  if (current.value > previous.value) improvements++;
                                }
                              }
                            }

                            stats.improvements = improvements;
                            stats.totalChanges = totalChanges;
                          }

                          // Calculate correlation between graphs
                          const validGraphs = graphs.filter((g: any) => !g.loading && !g.error);
                          if (validGraphs.length >= 2) {
                            const graphProcessedData = validGraphs.map((g: any) => {
                              const data = graphDataArrays.get(g.id) || [];
                              return data.filter((p: any) => !p.isDNF && p.value !== null && p.value !== undefined && p.value > 0);
                            });

                            const commonDates = new Set<number>();
                            const firstGraphData = graphProcessedData[0];

                            for (const point of firstGraphData) {
                              const timestamp = point.originalDate instanceof Date ? point.originalDate.getTime() : point.date.getTime();
                              const allHaveData = graphProcessedData.slice(1).every((graphData: any[]) => {
                                return graphData.some((p: any) => {
                                  const pt = p.originalDate instanceof Date ? p.originalDate.getTime() : p.date.getTime();
                                  const diff = Math.abs(pt - timestamp);
                                  return diff < 60 * 60 * 1000;
                                });
                              });
                              if (allHaveData) {
                                commonDates.add(timestamp);
                              }
                            }

                            if (commonDates.size >= 3) {
                              const pairedData: number[][] = [];
                              for (const timestamp of commonDates) {
                                const row = graphProcessedData.map((graphData: any[]) => {
                                  const closestPoint = graphData.find((p: any) => {
                                    const pt = p.originalDate instanceof Date ? p.originalDate.getTime() : p.date.getTime();
                                    const diff = Math.abs(pt - timestamp);
                                    return diff < 60 * 60 * 1000;
                                  });
                                  return closestPoint ? closestPoint.value : null;
                                });
                                if (row.every((v: number | null) => v !== null)) {
                                  pairedData.push(row as number[]);
                                }
                              }

                              if (pairedData.length >= 3) {
                                const calculateCorrelation = (data: number[][], idx1: number, idx2: number): number | null => {
                                  const n = data.length;
                                  if (n < 3) return null;

                                  const x = data.map(row => row[idx1]);
                                  const y = data.map(row => row[idx2]);

                                  const meanX = x.reduce((a, b) => a + b, 0) / n;
                                  const meanY = y.reduce((a, b) => a + b, 0) / n;

                                  let numerator = 0;
                                  let sumXSquared = 0;
                                  let sumYSquared = 0;

                                  for (let i = 0; i < n; i++) {
                                    const diffX = x[i] - meanX;
                                    const diffY = y[i] - meanY;
                                    numerator += diffX * diffY;
                                    sumXSquared += diffX * diffX;
                                    sumYSquared += diffY * diffY;
                                  }

                                  const denominator = Math.sqrt(sumXSquared * sumYSquared);
                                  if (denominator === 0) return null;

                                  return numerator / denominator;
                                };

                                const correlations: Array<{graph1: string; graph2: string; correlation: number | null; label1: string; label2: string}> = [];
                                for (let i = 0; i < validGraphs.length; i++) {
                                  for (let j = i + 1; j < validGraphs.length; j++) {
                                    const corr = calculateCorrelation(pairedData, i, j);
                                    const label1 = `${validGraphs[i].personName || validGraphs[i].wcaId} (${validGraphs[i].event || 'Unknown'})`;
                                    const label2 = `${validGraphs[j].personName || validGraphs[j].wcaId} (${validGraphs[j].event || 'Unknown'})`;
                                    correlations.push({
                                      graph1: String(validGraphs[i].id),
                                      graph2: String(validGraphs[j].id),
                                      correlation: corr,
                                      label1,
                                      label2
                                    });
                                  }
                                }

                                correlationStats = {
                                  correlations,
                                  dataPoints: pairedData.length
                                };
                              }
                            }
                          }
                        }

                        // Helper function for comparison info icons
                        const renderComparisonIcon = (title: string) => (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              border: '1px solid #64748b',
                              color: '#64748b',
                              fontSize: '8px',
                              lineHeight: '10px',
                              textAlign: 'center',
                              marginLeft: '2px',
                              position: 'relative',
                            }}
                            onMouseEnter={(e) => {
                              const tooltip = (e.currentTarget as HTMLElement).querySelector(':scope > span:last-child');
                              if (tooltip) {
                                (tooltip as HTMLElement).style.opacity = '1';
                                (tooltip as HTMLElement).style.visibility = 'visible';
                              }
                            }}
                            onMouseLeave={(e) => {
                              const tooltip = (e.currentTarget as HTMLElement).querySelector(':scope > span:last-child');
                              if (tooltip) {
                                (tooltip as HTMLElement).style.opacity = '0';
                                (tooltip as HTMLElement).style.visibility = 'hidden';
                              }
                            }}
                          >
                            i
                            <span style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 4px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              padding: '4px 8px',
                              background: '#1e293b',
                              color: '#f1f5f9',
                              fontSize: '10px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              opacity: '0',
                              visibility: 'hidden',
                              transition: 'opacity 0.2s, visibility 0.2s',
                              pointerEvents: 'none',
                              zIndex: 1000,
                            }}>
                              {title}
                            </span>
                          </span>
                        );

                        return (
                          <>
                            {/* SECTION 1: COMPARISON STATS (always shown) */}
                            <div style={{
                              padding: '16px',
                              background: 'rgba(30, 41, 59, 0.5)',
                              borderBottom: '1px solid #334155',
                              marginBottom: '16px',
                              borderRadius: '8px'
                            }}>
                              {/* Global Graph Stats */}
                              {incompatibleTypes && !showImprovementMode && (
                                <>
                                  <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '8px', fontWeight: 600 }}>
                                    ⚠️ INCOMPATIBLE UNIT TYPES
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '12px', lineHeight: '1.5' }}>
                                    Cannot compare {unitTypes.join(' vs ')} together. These use different measurement systems and cannot be meaningfully compared.
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                    Switch to <strong>Unit Change</strong> or <strong>% Change</strong> mode to see differences.
                                  </div>
                                </>
                              )}
                              {!incompatibleTypes && globalStats && !showImprovementMode && (
                                <>
                                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
                                    COMPARISON STATS ({graphs.length} {graphs.length === 1 ? 'graph' : 'graphs'}, {allValidPoints.length} results)
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#cbd5e1', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                                    <span>Avg: <strong style={{ color: '#f1f5f9' }}>{isMultiBlind ? 'N/A' : isFmc ? globalStats.mean.toFixed(1) : isTimeBased ? formatWcaTime(globalStats.mean) : globalStats.mean.toFixed(2)}</strong>{renderComparisonIcon("Average of all competitors")}</span>
                                    <span>Med: <strong style={{ color: '#f1f5f9' }}>{isMultiBlind ? 'N/A' : isFmc ? globalStats.median.toFixed(1) : isTimeBased ? formatWcaTime(globalStats.median) : globalStats.median.toFixed(2)}</strong>{renderComparisonIcon("Median value")}</span>
                                    <span>Best: <strong style={{ color: '#22c55e' }}>{formatValue(globalStats.min, resultType, eventId)}</strong>{renderComparisonIcon("Best result")}</span>
                                    <span>Worst: <strong style={{ color: '#ef4444' }}>{formatValue(globalStats.max, resultType, eventId)}</strong>{renderComparisonIcon("Worst result")}</span>
                                    {allValidPoints.length > 1 && (
                                      <span>Range: <strong style={{ color: '#f1f5f9' }}>{isMultiBlind ? 'N/A' : isFmc ? (globalStats.max - globalStats.min).toFixed(1) : isTimeBased ? formatWcaTime(globalStats.max - globalStats.min) : (globalStats.max - globalStats.min).toFixed(2)}</strong>{renderComparisonIcon("Range (max - min)")}</span>
                                    )}
                                    {globalStats.stdDev !== null && (
                                      <span>Std Dev: <strong style={{ color: '#f1f5f9' }}>{isMultiBlind ? 'N/A' : isFmc ? globalStats.stdDev.toFixed(1) : isTimeBased ? formatWcaTime(globalStats.stdDev) : globalStats.stdDev.toFixed(2)}</strong>{renderComparisonIcon("Standard deviation")}</span>
                                    )}
                                    <span>Results: <strong style={{ color: '#f1f5f9' }}>{allValidPoints.length}</strong>{renderComparisonIcon("Total valid results")}</span>
                                  </div>
                                </>
                              )}

                              {/* Head-to-Head Rankings */}
                              {!incompatibleTypes && graphs.length > 1 && headToHeadStats.size > 0 && (
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              border: '1px solid #64748b',
                              color: '#64748b',
                              fontSize: '8px',
                              lineHeight: '10px',
                              textAlign: 'center',
                              marginLeft: '2px',
                              position: 'relative',
                            }}
                            onMouseEnter={(e) => {
                              const tooltip = (e.currentTarget as HTMLElement).querySelector(':scope > span:last-child');
                              if (tooltip) {
                                (tooltip as HTMLElement).style.opacity = '1';
                                (tooltip as HTMLElement).style.visibility = 'visible';
                              }
                            }}
                            onMouseLeave={(e) => {
                              const tooltip = (e.currentTarget as HTMLElement).querySelector(':scope > span:last-child');
                              if (tooltip) {
                                (tooltip as HTMLElement).style.opacity = '0';
                                (tooltip as HTMLElement).style.visibility = 'hidden';
                              }
                            }}
                          >
                            i
                            <span style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 4px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              padding: '4px 8px',
                              background: '#1e293b',
                              color: '#f1f5f9',
                              fontSize: '10px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              opacity: '0',
                              visibility: 'hidden',
                              transition: 'opacity 0.2s, visibility 0.2s',
                              pointerEvents: 'none',
                              zIndex: 1000,
                            }}>
                              {title}
                            </span>
                          </span>
                        );

                        return (
                          <>
                            {/* SECTION 1: COMPARISON STATS (always shown) */}
                            <div style={{
                              padding: '16px',
                              background: 'rgba(30, 41, 59, 0.5)',
                              borderBottom: '1px solid #334155',
                              marginBottom: '16px',
                              borderRadius: '8px'
                            }>
                              {/* Global Graph Stats */}
                              {incompatibleTypes && !showImprovementMode && (
                                <>
                                  <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '8px', fontWeight: 600 }}>
                                    ⚠️ INCOMPATIBLE UNIT TYPES
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '12px', lineHeight: '1.5' }}>
                                    Cannot compare {unitTypes.join(' vs ')} together. These use different measurement systems and cannot be meaningfully compared.
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                    Switch to <strong>Unit Change</strong> or <strong>% Change</strong> mode to see differences.
                                  </div>
                                </>
                              )}
                              {!incompatibleTypes && globalStats && !showImprovementMode && (
                                <>
                                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
                                    COMPARISON STATS ({graphs.length} {graphs.length === 1 ? 'graph' : 'graphs'}, {allValidPoints.length} results)
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#cbd5e1', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                                    <span>Avg: <strong style={{ color: '#f1f5f9' }}>{isMultiBlind ? 'N/A' : isFmc ? globalStats.mean.toFixed(1) : isTimeBased ? formatWcaTime(globalStats.mean) : globalStats.mean.toFixed(2)}</strong>{renderComparisonIcon("Average of all competitors")}</span>
                                    <span>Med: <strong style={{ color: '#f1f5f9' }}>{isMultiBlind ? 'N/A' : isFmc ? globalStats.median.toFixed(1) : isTimeBased ? formatWcaTime(globalStats.median) : globalStats.median.toFixed(2)}</strong>{renderComparisonIcon("Median value")}</span>
                                    <span>Best: <strong style={{ color: '#22c55e' }}>{formatValue(globalStats.min, resultType, eventId)}</strong>{renderComparisonIcon("Best result")}</span>
                                    <span>Worst: <strong style={{ color: '#ef4444' }}>{formatValue(globalStats.max, resultType, eventId)}</strong>{renderComparisonIcon("Worst result")}</span>
                                    {allValidPoints.length > 1 && (
                                      <span>Range: <strong style={{ color: '#f1f5f9' }}>{isMultiBlind ? 'N/A' : isFmc ? (globalStats.max - globalStats.min).toFixed(1) : isTimeBased ? formatWcaTime(globalStats.max - globalStats.min) : (globalStats.max - globalStats.min).toFixed(2)}</strong>{renderComparisonIcon("Range (max - min)")}</span>
                                    )}
                                    {globalStats.stdDev !== null && (
                                      <span>Std Dev: <strong style={{ color: '#f1f5f9' }}>{isMultiBlind ? 'N/A' : isFmc ? globalStats.stdDev.toFixed(1) : isTimeBased ? formatWcaTime(globalStats.stdDev) : globalStats.stdDev.toFixed(2)}</strong>{renderComparisonIcon("Standard deviation")}</span>
                                    )}
                                    <span>Results: <strong style={{ color: '#f1f5f9' }}>{allValidPoints.length}</strong>{renderComparisonIcon("Total valid results")}</span>
                                  </div>
                                </>
                              )}

                              {/* Head-to-Head Rankings */}
                              {!incompatibleTypes && graphs.length > 1 && headToHeadStats.size > 0 && (
                                <>
                                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600, marginTop: globalStats ? '12px' : 0 }}>
                                    HEAD-TO-HEAD RANKINGS
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {Array.from(headToHeadStats.entries()).sort(([, a], [, b]) => {
                                      if (a.wins !== b.wins) return b.wins - a.wins;
                                      return a.avgPosition - b.avgPosition;
                                    }).map(([uniqueKey, stats]) => {
                                      if (stats.meetings === 0) return null;
                                      const winRate = stats.meetings > 0 ? (stats.wins / stats.meetings) * 100 : 0;
                                      const improvementRate = stats.totalChanges > 0 ? (stats.improvements / stats.totalChanges) * 100 : 0;
                                      const personPoint = allChartData.find(p => p.personName === stats.personName && p.graphId === stats.graphId);
                                      const personColor = personPoint?.color || '#f1f5f9';
                                      const hasMultipleEventsForSamePerson = headToHeadStats.size > 1 &&
                                        Array.from(headToHeadStats.values()).some(s => s.personName === stats.personName && s.graphId !== stats.graphId);
                                      const label = hasMultipleEventsForSamePerson
                                        ? `${stats.personName} (${stats.event})`
                                        : stats.personName;
                                      return (
                                        <div key={uniqueKey} style={{
                                          display: 'flex',
                                          gap: '12px',
                                          fontSize: '0.75rem',
                                          color: '#cbd5e1',
                                          alignItems: 'center',
                                          padding: '6px 8px',
                                          background: 'rgba(15, 23, 42, 0.5)',
                                          borderRadius: '6px'
                                        }}>
                                          <strong style={{ color: personColor, minWidth: '120px' }}>{label}</strong>
                                          <span>Wins: <strong style={{ color: '#f1f5f9' }}>{stats.wins}/{stats.meetings}</strong>{renderComparisonIcon("Head-to-head wins")}</span>
                                          <span>Avg pos: <strong style={{ color: '#f1f5f9' }}>{stats.avgPosition.toFixed(1)}</strong>{renderComparisonIcon("Average position in head-to-head meetings")}</span>
                                          <span>Win rate: <strong style={{ color: winRate >= 50 ? '#22c55e' : '#ef4444' }}>{winRate.toFixed(0)}%</strong>{renderComparisonIcon("Percentage of meetings won")}</span>
                                          <span>Improving: <strong style={{ color: '#f1f5f9' }}>{improvementRate.toFixed(0)}%</strong>{renderComparisonIcon("Percentage of results showing improvement")}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}

                              {/* Correlation Stats */}
                              {!incompatibleTypes && correlationStats && correlationStats.correlations.length > 0 && (
                                <>
                                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600, marginTop: '12px' }}>
                                    CORRELATION ({correlationStats.dataPoints} {correlationStats.dataPoints === 1 ? 'pair' : 'pairs'})
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: '#cbd5e1' }}>
                                    {correlationStats.correlations.map((corr, idx) => {
                                      if (corr.correlation === null) return null;
                                      const corrColor = corr.correlation > 0.5 ? '#22c55e' : corr.correlation < -0.5 ? '#ef4444' : '#94a3b8';
                                      const corrLabel = corr.correlation > 0.5 ? 'Strong positive' : corr.correlation > 0 ? 'Moderate positive' : corr.correlation < -0.5 ? 'Strong negative' : corr.correlation < 0 ? 'Moderate negative' : 'No correlation';
                                      return (
                                        <div key={idx} style={{
                                          display: 'flex',
                                          gap: '8px',
                                          alignItems: 'center',
                                          padding: '4px 8px',
                                          background: 'rgba(15, 23, 42, 0.3)',
                                          borderRadius: '4px'
                                        }}>
                                          <span style={{ minWidth: '150px' }}>{corr.label1} ↔ {corr.label2}</span>
                                          <span>r = <strong style={{ color: corrColor }}>{corr.correlation.toFixed(2)}</strong></span>
                                          <span style={{ color: '#64748b', fontSize: '0.7em' }}>({corrLabel})</span>
                                          {renderComparisonIcon("Pearson correlation coefficient (-1 to 1). Values closer to 1 indicate strong positive correlation (both improve/worsen together), values closer to -1 indicate strong negative correlation (one improves as other worsens).")}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* SECTION 2: SELECTED POINTS (only shown when hovering) */}
                            {hoveredDataArray.length > 0 && (() => {
                              const sortedPoints = [...hoveredDataArray]
                                .sort((a, b) => {
                                  if (a.isDNF && !b.isDNF) return 1;
                                  if (!a.isDNF && b.isDNF) return -1;
                                  if (a.isDNF && b.isDNF) return 0;
                                  return a.value - b.value;
                                })
                                .map((point, index) => ({ ...point, rank: index + 1 }));

                              return (
                                <>
                                  <div style={{
                                    marginTop: '16px',
                                    marginBottom: '12px',
                                    paddingTop: '12px',
                                    borderTop: '1px solid #334155'
                                  }}>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                                      SELECTED POINTS at {hoveredData?.displayDate || 'Date'}
                                      <button
                                        onClick={() => {
                                          setHoveredData(null);
                                          setHoveredDataArray([]);
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#94a3b8',
                                          cursor: 'pointer',
                                          padding: '2px 6px',
                                          marginLeft: '8px',
                                          fontSize: '0.7rem'
                                        }}
                                        title="Clear selection"
                                      >
                                        [X]
                                      </button>
                                      <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '8px' }}>
                                        ({sortedPoints.length} {sortedPoints.length === 1 ? 'point' : 'points'} from {hoveredData?.competitionName || 'competition'})
                                      </span>
                                    </div>
                                  </div>

                                  {sortedPoints.map((point: any, idx: number) => {
                                    let margin = null;
                                    if (!point.isDNF && point.rank > 1 && !sortedPoints[0]?.isDNF) {
                                      margin = point.value - sortedPoints[0].value;
                                    }

                                    let displayValue: string;
                                    let showAsDNF = false;

                                    if (point.isDNF) {
                                      displayValue = 'DNF';
                                      showAsDNF = true;
                                    } else if (showPercentChange) {
                                      if (point.improvementValue !== null && point.improvementValue !== undefined) {
                                        displayValue = `${point.improvementValue >= 0 ? '+' : ''}${point.improvementValue.toFixed(2)}%`;
                                      } else {
                                        displayValue = 'N/A';
                                      }
                                    } else if (showUnitChange) {
                                      if (point.changeFromPrev !== null && point.changeFromPrev !== undefined) {
                                        const changeVal = point.changeFromPrev;
                                        if (isTimeBased) {
                                          displayValue = `${changeVal >= 0 ? '+' : ''}${formatWcaTime(Math.abs(changeVal))}`;
                                        } else {
                                          displayValue = `${changeVal >= 0 ? '+' : ''}${changeVal}`;
                                        }
                                      } else {
                                        displayValue = 'N/A';
                                      }
                                    } else {
                                      displayValue = formatValue(point.originalValue, resultType, point.event);
                                    }

                                    let trendArrow = null;
                                    let trendColor = '#94a3b8';
                                    if (sortedPoints.length === 1 && !showAsDNF) {
                                      if (point.changeFromPrev !== null && point.changeFromPrev !== undefined) {
                                        if (point.changeFromPrev < 0) {
                                          trendArrow = '↑';
                                          trendColor = '#22c55e';
                                        } else if (point.changeFromPrev > 0) {
                                          trendArrow = '↓';
                                          trendColor = '#ef4444';
                                        } else {
                                          trendArrow = '→';
                                          trendColor = '#94a3b8';
                                        }
                                      } else {
                                        trendArrow = '—';
                                        trendColor = '#94a3b8';
                                      }
                                    }

                                    let bgColor = 'transparent';
                                    let bgOpacity = 0;
                                    let textColor = '#f1f5f9';

                                    if (!point.isDNF && point.changeFromPrev !== null && point.changeFromPrev !== undefined && point.changeFromPrev !== 0) {
                                      if (isTimeBased) {
                                        bgColor = point.changeFromPrev < 0 ? '22, 163, 74' : '239, 68, 68';
                                        textColor = point.changeFromPrev < 0 ? '#22c55e' : '#ef4444';
                                      } else {
                                        bgColor = point.changeFromPrev < 0 ? '22, 163, 74' : '239, 68, 68';
                                        textColor = point.changeFromPrev < 0 ? '#22c55e' : '#ef4444';
                                      }
                                      bgOpacity = 0.15;
                                    }

                                    let comparisonStats = null;
                                    if (sortedPoints.length === 1) {
                                      const graph = graphs.find((g: any) => g.id === point.graphId);
                                      if (graph) {
                                        const graphData = graph.dataPoints || [];
                                        const validPoints = graphData.filter((p: any) => !p.isDNF);

                                        if (validPoints.length > 0) {
                                          const mean = validPoints.reduce((sum: number, p: any) => sum + p.value, 0) / validPoints.length;
                                          const sortedVals = [...validPoints].sort((a: any, b: any) => a.value - b.value);
                                          const mid = Math.floor(sortedVals.length / 2);
                                          const median = sortedVals.length % 2 !== 0 ? sortedVals[mid].value : (sortedVals[mid - 1].value + sortedVals[mid].value) / 2;
                                          const variance = validPoints.reduce((sum: number, p: any) => sum + Math.pow(p.value - mean, 2), 0) / validPoints.length;
                                          const stdDev = Math.sqrt(variance);

                                          const currentValue = point.isDNF ? null : point.originalValue;

                                          const getCompColor = (current: number | null, reference: number): string => {
                                            if (current === null) return '#94a3b8';
                                            return isTimeBased
                                              ? (current < reference ? '#22c55e' : current > reference ? '#ef4444' : '#94a3b8')
                                              : (current > reference ? '#22c55e' : current < reference ? '#ef4444' : '#94a3b8');
                                          };

                                          const meanColor = currentValue !== null ? getCompColor(currentValue, mean) : '#94a3b8';
                                          const medianColor = currentValue !== null ? getCompColor(currentValue, median) : '#94a3b8';

                                          let percentile = null;
                                          if (currentValue !== null) {
                                            const worseCount = sortedVals.filter((p: any) => p.value > currentValue).length;
                                            percentile = ((worseCount / sortedVals.length) * 100);
                                          }
                                          const percentileColor = percentile !== null ? (percentile >= 50 ? '#22c55e' : '#ef4444') : '#94a3b8';

                                          const zScore = currentValue !== null && stdDev > 0 ? (currentValue - mean) / stdDev : null;
                                          const zScoreColor = zScore !== null ? (zScore < 0 ? '#22c55e' : zScore > 0 ? '#ef4444' : '#94a3b8') : '#94a3b8';

                                          comparisonStats = {
                                            mean,
                                            median,
                                            meanColor,
                                            medianColor,
                                            percentile,
                                            percentileColor,
                                            zScore,
                                            zScoreColor,
                                          };
                                        }
                                      }
                                    }

                                    return (
                                      <div
                                        key={idx}
                                        className={`comparison-item ${point.rank === 1 && !showAsDNF && sortedPoints.length > 1 ? 'winner' : ''}`}
                                        style={{
                                          borderLeftColor: point.color,
                                          backgroundColor: bgOpacity > 0 ? `rgba(${bgColor}, ${bgOpacity})` : 'transparent'
                                        }}
                                      >
                                        <div className="comparison-rank">
                                          {showAsDNF ? '-' : sortedPoints.length > 1 ? (
                                            point.rank === 1 ? (
                                              <Trophy size={20} color="#fbbf24" strokeWidth={2.5} />
                                            ) : point.rank === 2 ? (
                                              <Trophy size={18} color="#94a3b8" strokeWidth={2} />
                                            ) : point.rank === 3 ? (
                                              <Trophy size={16} color="#cd7f32" strokeWidth={2} />
                                            ) : `#${point.rank}`
                                          ) : <span style={{ color: trendColor, fontSize: '1.2em' }}>{trendArrow || ''}</span>}
                                        </div>
                                        <div className="comparison-info">
                                          <div className="comparison-name" style={{ color: point.color }}>
                                            {point.personName}
                                          </div>
                                          <div className="competition-name">
                                            {point.competitionName}
                                            {sortedPoints.length === 1 && (
                                              <>
                                                {point.round && (
                                                  <span style={{ color: '#94a3b8', marginLeft: '8px', fontSize: '0.9em' }}>
                                                    {point.round}
                                                  </span>
                                                )}
                                                {point.position !== undefined && point.position !== null && (
                                                  <span style={{ color: '#94a3b8', marginLeft: '8px', fontSize: '0.9em' }}>
                                                    #{point.position}
                                                  </span>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        <div className="comparison-result">
                                          <div className="result-value" style={{ color: !point.isDNF && point.changeFromPrev !== null && point.changeFromPrev !== 0 ? textColor : '#f1f5f9' }}>{displayValue}</div>
                                          {comparisonStats && !point.isDNF && (
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85em' }}>
                                              <span style={{ color: comparisonStats.meanColor, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                μ{isTimeBased ? formatWcaTime(Math.abs(point.originalValue - comparisonStats.mean)) : Math.abs(point.originalValue - comparisonStats.mean).toFixed(1)}
                                                {renderComparisonIcon("Deviation from mean")}
                                              </span>
                                              <span style={{ color: comparisonStats.medianColor, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                m{isTimeBased ? formatWcaTime(Math.abs(point.originalValue - comparisonStats.median)) : Math.abs(point.originalValue - comparisonStats.median).toFixed(1)}
                                                {renderComparisonIcon("Deviation from median")}
                                              </span>
                                              <span style={{ color: comparisonStats.percentileColor, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                {comparisonStats.percentile !== null ? `${comparisonStats.percentile.toFixed(0)}%` : 'N/A'}
                                                {renderComparisonIcon("Percentile rank (0-100%)")}
                                              </span>
                                              <span style={{ color: comparisonStats.zScoreColor, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                z{comparisonStats.zScore !== null ? (comparisonStats.zScore > 0 ? '+' : '') + comparisonStats.zScore.toFixed(1) : 'N/A'}
                                                {renderComparisonIcon("Standard score (Z-Score)")}
                                              </span>
                                            </div>
                                          )}
                                          {!showAsDNF && sortedPoints.length > 1 && margin !== null && margin !== undefined && (
                                            <div className="result-margin">
                                              +{isTimeBased ? formatWcaTime(Math.abs(margin)) : Math.abs(margin)}{!isTimeBased ? ' places' : ''}
                                            </div>
                                          )}
                                          {point.rank === 1 && !showAsDNF && sortedPoints.length > 1 && (
                                            <div className="result-label winner-label">First</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Table Section */}
                <div className="table-section">
                  <div className="table-header">
                    <h4>Detailed Results</h4>
                  </div>
                  <div className="table-content" style={{ maxHeight: 'none', overflow: 'visible' }}>
                    <div className="table-wrapper">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #334155' }}>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8' }}>Competitor</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8' }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8' }}>Competition</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8' }}>Round</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8' }}>Result</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8' }}>Change</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8' }}>Improvement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allChartData.map((d: any, idx: number) => {
                        // Get the result type for this graph to format value correctly
                        const graph = graphs.find((g: any) => g.id === d.graphId);
                        const resultType = graph?.resultType || 'single';
                        const isTimeBased = !['rank', 'comprank', 'cr', 'nr', 'wr', 'worst'].includes(resultType);

                        // Calculate change from previous result
                        let changeFromPrev = null;
                        let percentChange = null;
                        let trend = null;

                        // Find previous data point for this graph
                        const graphData = graphDataArrays.get(d.graphId) || [];
                        const pointIndex = graphData.findIndex((p: any) => p.uniqueKey === d.uniqueKey);

                        if (pointIndex > 0) {
                          const prevPoint = graphData[pointIndex - 1];
                          if (prevPoint && !prevPoint.isDNF && !d.isDNF) {
                            changeFromPrev = d.value - prevPoint.value;

                            // Calculate percent change for time-based results
                            if (isTimeBased && prevPoint.value > 0) {
                              percentChange = ((prevPoint.value - d.value) / prevPoint.value) * 100; // Positive = improvement
                            }

                            // Determine trend
                            if (isTimeBased) {
                              trend = changeFromPrev < 0 ? 'improving' : changeFromPrev > 0 ? 'declining' : 'stable';
                            } else {
                              trend = changeFromPrev < 0 ? 'improving' : changeFromPrev > 0 ? 'declining' : 'stable';
                            }
                          }
                        }

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                            <td style={{ padding: '12px', color: d.color }}>
                              <strong>{d.personName}</strong> ({d.wcaId})
                            </td>
                            <td style={{ padding: '12px', color: '#cbd5e1' }}>{d.displayDate}</td>
                            <td style={{ padding: '12px', color: '#cbd5e1' }}>{d.competitionName}</td>
                            <td style={{ padding: '12px', color: '#cbd5e1' }}>{d.round}</td>
                            <td style={{ padding: '12px', textAlign: 'right', color: d.isDNF ? '#94a3b8' : '#f1f5f9', fontWeight: 'bold' }}>
                              {d.isDNF ? 'DNF' : formatValue(d.value, resultType, graph?.event)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#cbd5e1', fontWeight: 'bold' }}>
                              {changeFromPrev !== null ? (
                                <span style={{ color: trend === 'improving' ? '#22c55e' : trend === 'declining' ? '#ef4444' : '#94a3b8' }}>
                                  {isTimeBased
                                    ? (changeFromPrev > 0 ? '+' : '') + formatWcaTime(Math.abs(changeFromPrev))
                                    : (changeFromPrev > 0 ? '+' : '') + Math.round(changeFromPrev)
                                  }
                                </span>
                              ) : '-'}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#cbd5e1', fontWeight: 'bold' }}>
                              {percentChange !== null ? (
                                <span style={{ color: percentChange > 0 ? '#22c55e' : percentChange < 0 ? '#ef4444' : '#94a3b8' }}>
                                  {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
