import { useState, useMemo, useEffect } from 'react';
import React from 'react';
import { BarChart3, Edit3, X, Check, Save, TrendingUp } from 'lucide-react';
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
  isDNF?: boolean;
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
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#94a3b8"
      stroke="#64748b"
      strokeWidth={2}
      style={{ cursor: 'pointer' }}
    />
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

// Format value based on result type
function formatValue(value: number, resultType: string): string {
  if (resultType === 'rank') {
    return Math.round(value).toString();
  }
  if (resultType === 'cr' || resultType === 'nr' || resultType === 'wr') {
    return Math.round(value).toString();
  }
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
  const [isHoveringDNF, setIsHoveringDNF] = useState(false);

  const events = [
    { id: '333', name: '3x3x3' },
    { id: '222', name: '2x2x2' },
    { id: '444', name: '4x4x4' },
    { id: '555', name: '5x5x5' },
    { id: '666', name: '6x6x6' },
    { id: '777', name: '7x7x7' },
    { id: '333oh', name: '3x3 One-Handed' },
    { id: '222bf', name: '2x2 Blindfolded' },
    { id: '333bf', name: '3x3 Blindfolded' },
    { id: '444bf', name: '4x4 Blindfolded' },
    { id: '555bf', name: '5x5 Blindfolded' },
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

  const handleCancelEdit = () => {
    setEditingGraphId(null);
    setEditedWcaId('');
    setEditedEvent('');
    setEditedResultType('');
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

        if (showImprovementMode && index > 0 && !point.isDNF) {
          const prevPoint = graph.dataPoints[index - 1];
          if (prevPoint && !prevPoint.isDNF) {
            const resultType = graph.resultType;
            const isTimeBased = !['rank', 'comprank', 'cr', 'nr', 'wr', 'worst'].includes(resultType);

            changeFromPrev = point.value - prevPoint.value;

            // For improvement mode, plot the change from previous
            plotValue = changeFromPrev;

            // Calculate percent improvement
            if (isTimeBased && prevPoint.value > 0) {
              improvementValue = ((prevPoint.value - point.value) / prevPoint.value) * 100;
            }
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
  }, [graphs, showImprovementMode]);

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

          // Log DNF point for debugging
          console.log(`DNF Point for ${graph.wcaId}:`, {
            date: point.date,
            value: point.value,
            isDNF: point.isDNF
          });

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
        console.log(`Setting dnfDataArrays for ${graph.wcaId} with ${dnfPoints.length} DNF points`);
        console.log('DNF data structure sample:', dnfPoints[0]);
        result.set(graph.id, dnfPoints);
      }
    }

    return result;
  }, [graphs]);

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

    // Collect all non-null values from graph data
    for (const [, data] of graphDataArrays) {
      for (const point of data) {
        if (point.value !== null && point.value !== undefined && !point.isDNF) {
          allValues.push(point.value);
        }
      }
    }

    // Collect DNF estimated values from the 'value' property
    const dnfValues: number[] = [];
    for (const [, dnfData] of dnfDataArrays) {
      for (const point of dnfData) {
        if (point.value !== null && point.value !== undefined) {
          allValues.push(point.value);
          dnfValues.push(point.value);
        }
      }
    }

    console.log('=== Y-axis Domain Debug ===');
    console.log('Regular values:', allValues.filter(v => !dnfValues.includes(v)).length, 'points');
    console.log('DNF values:', dnfValues); // Should show array of actual numbers
    console.log('All values:', allValues);

    if (allValues.length === 0) {
      return [0, 1000];
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1; // 10% padding

    console.log('Y-axis domain:', [min - padding, max + padding]);
    console.log('========================');

    return [min - padding, max + padding];
  }, [graphDataArrays, dnfDataArrays]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <BarChart3 size={32} />
            <h1>WCA Progress Tracker</h1>
          </div>
          <p className="subtitle">Track and compare WCA competition progression over time</p>
        </div>
      </header>

      <main className="app-main">
        <form className="graph-form" onSubmit={(e) => { e.preventDefault(); handleAddGraph(); }}>
          <div className="form-row">
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

        {graphs.length > 0 && (
          <>
            <div className="graph-cards">
              {graphs.map((graph) => (
                <div key={graph.id} className="graph-card" style={{ minWidth: '280px', maxWidth: '400px', flex: '1 1 320px' }}>
                  <div className="card-header">
                    <div className="card-header-left">
                      <div
                        className="color-indicator"
                        style={{ backgroundColor: graph.color }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: '16px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {graph.personName || graph.wcaId}
                        </h3>
                        <span className="wca-id" style={{ fontSize: '12px' }}>{graph.wcaId}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleRemoveGraph(graph.id)}
                        className="icon-btn"
                        title="Remove"
                        style={{ color: '#ef4444' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Always-visible inline edit controls */}
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#1e293b', borderRadius: '8px', margin: '0 16px 16px' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 120px', minWidth: '120px' }}>
                        <label style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>WCA ID</label>
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
                            width: '100%',
                            padding: '8px 12px',
                            background: '#0f172a',
                            border: editingGraphId === graph.id ? '2px solid #3b82f6' : '1px solid #334155',
                            borderRadius: '6px',
                            color: '#f1f5f9',
                            fontSize: '13px',
                            transition: 'border-color 0.2s',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div style={{ flex: '1 1 120px', minWidth: '120px' }}>
                        <label style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Event</label>
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
                            width: '100%',
                            padding: '8px 12px',
                            background: '#0f172a',
                            border: editingGraphId === graph.id ? '2px solid #3b82f6' : '1px solid #334155',
                            borderRadius: '6px',
                            color: '#f1f5f9',
                            fontSize: '13px',
                            transition: 'border-color 0.2s',
                            boxSizing: 'border-box'
                          }}
                        >
                          {events.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: '1 1 120px', minWidth: '120px' }}>
                        <label style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Type</label>
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
                            width: '100%',
                            padding: '8px 12px',
                            background: '#0f172a',
                            border: editingGraphId === graph.id ? '2px solid #3b82f6' : '1px solid #334155',
                            borderRadius: '6px',
                            color: '#f1f5f9',
                            fontSize: '13px',
                            transition: 'border-color 0.2s',
                            boxSizing: 'border-box'
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
                  </div>

                  {graph.loading && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                      Loading data...
                    </div>
                  )}
                  {graph.error && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
                      {graph.error}
                    </div>
                  )}
                  {!graph.loading && !graph.error && graph.dataPoints.length > 0 && (
                    <div className="card-stats" style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div className="stat" style={{ textAlign: 'center' }}>
                        <span className="stat-label">Best</span>
                        <span className="stat-value">
                          {formatWcaTime(Math.min(...graph.dataPoints.filter(p => !p.isDNF).map(p => p.value)))}
                        </span>
                      </div>
                      <div className="stat" style={{ textAlign: 'center' }}>
                        <span className="stat-label">Latest</span>
                        <span className="stat-value">
                          {graph.dataPoints[graph.dataPoints.length - 1]?.isDNF
                            ? 'DNF'
                            : formatWcaTime(graph.dataPoints[graph.dataPoints.length - 1]?.value || 0)
                          }
                        </span>
                      </div>
                      <div className="stat" style={{ textAlign: 'center' }}>
                        <span className="stat-label">Results</span>
                        <span className="stat-value">{graph.dataPoints.length}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {allChartData.length > 0 && (
              <div className="chart-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: '#f1f5f9' }}>
                    {showImprovementMode ? 'Improvement Chart' : 'Progression Chart'}
                  </h3>
                  <button
                    onClick={() => setShowImprovementMode(!showImprovementMode)}
                    style={{
                      padding: '8px 16px',
                      background: showImprovementMode ? '#22c55e' : '#334155',
                      color: '#f1f5f9',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = showImprovementMode ? '#16a34a' : '#475569'}
                    onMouseLeave={(e) => e.currentTarget.style.background = showImprovementMode ? '#22c55e' : '#334155'}
                  >
                    {showImprovementMode ? '📈 Show Raw Values' : '📊 Show Improvement'}
                  </button>
                </div>

                {/* Line Chart */}
                <div style={{ marginBottom: '20px', background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={allChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                          if (showImprovementMode) {
                            // For improvement mode, show change values rounded to nearest tens
                            const firstGraph = graphs.find(g => !g.loading && !g.error);
                            const resultType = firstGraph?.resultType || 'single';
                            const isTimeBased = !['rank', 'comprank', 'cr', 'nr', 'wr', 'worst'].includes(resultType);

                            // Round to nearest tens
                            const roundedValue = Math.round(value / 10) * 10;

                            if (isTimeBased) {
                              return formatWcaTime(Math.abs(roundedValue));
                            } else {
                              return (roundedValue > 0 ? '+' : '') + roundedValue;
                            }
                          } else {
                            // Get the result type from the first graph to determine formatting
                            const firstGraph = graphs.find(g => !g.loading && !g.error);
                            const resultType = firstGraph?.resultType || 'single';
                            // For non-improvement mode, also round to tens
                            const roundedValue = Math.round(value / 10) * 10;
                            return formatValue(roundedValue, resultType);
                          }
                        }}
                        domain={yAxisDomain}
                      />
                      {showImprovementMode && (
                        <ReferenceLine
                          y={0}
                          stroke="#f1f5f9"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      )}
                      <Tooltip
                        content={(props: any) => {
                          if (props.active && props.payload && props.payload.length > 0) {
                            // Show ALL graphs' data when hovering - for "all solves" this shows multiple points
                            const hoveredPayload = props.payload[0].payload;
                            const activeDate = hoveredPayload?.date;

                            // Find ALL data points for each graph near the hovered x-position
                            // Use a Map to deduplicate by a consistent key (graphId + original date timestamp)
                            const uniqueDataMap = new Map<string, any>();

                            for (const graph of graphs) {
                              if (graph.loading || graph.error || !graph.personName) continue;

                              const graphData = graphDataArrays.get(graph.id);
                              if (!graphData || graphData.length === 0) continue;

                              // Find all points close to the hovered date (within 2 days)
                              const closePoints = graphData.filter(point => {
                                const diff = Math.abs(point.date.getTime() - (activeDate?.getTime() || 0));
                                return diff < 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
                              });

                              for (const point of closePoints) {
                                // Use originalDate timestamp + graphId as the deduplication key
                                const dedupeKey = `${graph.id}-${point.originalDate.getTime()}`;
                                uniqueDataMap.set(dedupeKey, point);
                              }

                              // Also check DNF points - use 'date' property (Date object)
                              const dnfData = dnfDataArrays.get(graph.id);
                              if (dnfData && dnfData.length > 0) {
                                const closeDNFPoints = dnfData.filter(point => {
                                  const pointTimestamp = point.date instanceof Date ? point.date.getTime() : 0;
                                  const diff = Math.abs(pointTimestamp - (activeDate?.getTime() || 0));
                                  return diff < 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
                                });
                                for (const point of closeDNFPoints) {
                                  // Use originalDate timestamp + graphId as the deduplication key
                                  const dedupeKey = `${graph.id}-${point.originalDate.getTime()}`;
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
                            // Don't clear state if we're hovering over a DNF point (Scatter)
                            if (!isHoveringDNF) {
                              requestAnimationFrame(() => {
                                setHoveredData(null);
                                setHoveredDataArray([]);
                              });
                            }
                          }
                          return null;
                        }}
                        cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                        isAnimationActive={false}
                      />
                      <Legend
                        wrapperStyle={{ color: '#f1f5f9' }}
                        iconType="line"
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
                      {/* Render DNF points as gray dots using Scatter */}
                      {graphs
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
                                setIsHoveringDNF(true);
                                setHoveredData(point);
                                setHoveredDataArray([point]);
                              }}
                              onMouseLeave={() => {
                                console.log('DNF point left');
                                setIsHoveringDNF(false);
                                setHoveredData(null);
                                setHoveredDataArray([]);
                              }}
                              onClick={(point: any) => {
                                console.log('DNF point clicked:', point);
                                setIsHoveringDNF(true);
                                setHoveredData(point);
                                setHoveredDataArray([point]);
                              }}
                            />
                          );
                        })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Data Point Info Panel */}
                {hoveredDataArray.length > 0 && (
                  <div style={{
                    marginBottom: '30px',
                    background: '#1e293b',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #334155',
                  }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#f1f5f9' }}>
                      {hoveredDataArray.length > 1
                        ? `All Graphs Data (Hovering: ${hoveredData?.displayDate || 'Date'})`
                        : 'Selected Data Point'
                      }
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {hoveredDataArray.map((point: any, idx: number) => {
                        // Find previous data point for this graph to calculate change
                        const graphId = point.graphId;
                        const graphData = graphDataArrays.get(graphId) || [];
                        const pointIndex = graphData.findIndex((p: any) => p.uniqueKey === point.uniqueKey);

                        // Calculate statistics - skip for DNF points
                        let changeFromPrev = null;
                        let percentChange = null;
                        let trend = null;

                        if (!point.isDNF && pointIndex > 0) {
                          const prevPoint = graphData[pointIndex - 1];
                          if (prevPoint && !prevPoint.isDNF && !point.isDNF) {
                            changeFromPrev = point.value - prevPoint.value;

                            // Calculate percent change for time-based results
                            const resultType = graphs.find((g: any) => g.id === graphId)?.resultType || 'single';
                            const isTimeBased = !['rank', 'comprank', 'cr', 'nr', 'wr'].includes(resultType);

                            if (isTimeBased && prevPoint.value > 0) {
                              percentChange = ((prevPoint.value - point.value) / prevPoint.value) * 100; // Positive = improvement
                            }

                            // Determine trend
                            if (isTimeBased) {
                              trend = changeFromPrev < 0 ? 'improving' : changeFromPrev > 0 ? 'declining' : 'stable';
                            } else {
                              trend = changeFromPrev < 0 ? 'improving' : changeFromPrev > 0 ? 'declining' : 'stable';
                            }
                          }
                        }

                        const resultType = graphs.find((g: any) => g.id === graphId)?.resultType || 'single';
                        const isTimeBased = !['rank', 'comprank', 'cr', 'nr', 'wr', 'worst'].includes(resultType);
                        let formattedValue = point.isDNF ? 'DNF' : formatValue(point.value, resultType);

                        // For improvement mode, show the change/improvement value (but not for DNF)
                        if (showImprovementMode && !point.isDNF && point.changeFromPrev !== null) {
                          formattedValue = isTimeBased
                            ? (point.changeFromPrev > 0 ? '+' : '') + formatWcaTime(Math.abs(point.changeFromPrev))
                            : (point.changeFromPrev > 0 ? '+' : '') + Math.round(point.changeFromPrev);
                        }

                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '12px',
                              background: '#334155',
                              borderRadius: '8px',
                              borderLeft: `4px solid ${point.color}`,
                            }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                              <div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Competitor</div>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: point.color }}>
                                  {point.personName} ({point.wcaId})
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Date</div>
                                <div style={{ fontSize: '14px', color: '#cbd5e1' }}>{point.displayDate}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Competition</div>
                                <div style={{ fontSize: '14px', color: '#cbd5e1' }}>{point.competitionName}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Round</div>
                                <div style={{ fontSize: '14px', color: '#cbd5e1' }}>{point.round}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                                  {point.isDNF ? 'Status' : (showImprovementMode ? 'Change from Previous' : 'Result')}
                                </div>
                                <div style={{
                                  fontSize: '16px',
                                  fontWeight: 'bold',
                                  color: point.isDNF ? '#ef4444' : (showImprovementMode ? (point.changeFromPrev < 0 ? '#22c55e' : point.changeFromPrev > 0 ? '#ef4444' : '#94a3b8') : '#22c55e')
                                }}>
                                  {formattedValue}
                                </div>
                              </div>
                              {!showImprovementMode && changeFromPrev !== null && (
                                <>
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                                      Change {isTimeBased ? '(Time)' : '(Rank)'}
                                    </div>
                                    <div style={{
                                      fontSize: '14px',
                                      fontWeight: 'bold',
                                      color: trend === 'improving' ? '#22c55e' : trend === 'declining' ? '#ef4444' : '#94a3b8'
                                    }}>
                                      {isTimeBased
                                        ? (changeFromPrev > 0 ? '+' : '') + formatWcaTime(Math.abs(changeFromPrev))
                                        : (changeFromPrev > 0 ? '+' : '') + changeFromPrev
                                      }
                                      <span style={{ fontSize: '12px', marginLeft: '4px', color: '#94a3b8' }}>
                                        {trend === 'improving' ? '↓' : trend === 'declining' ? '↑' : '→'}
                                      </span>
                                    </div>
                                  </div>
                                  {percentChange !== null && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Improvement</div>
                                      <div style={{
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        color: percentChange > 0 ? '#22c55e' : percentChange < 0 ? '#ef4444' : '#94a3b8'
                                      }}>
                                        {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <h4 style={{ marginBottom: '16px', color: '#f1f5f9' }}>Detailed Results Table</h4>
                {/* Table view */}
                <div style={{ overflowX: 'auto' }}>
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
                              {d.isDNF ? 'DNF' : formatValue(d.value, resultType)}
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
            )}
          </>
        )}

        {graphs.length === 0 && (
          <div className="empty-state">
            <BarChart3 size={64} />
            <h2>Start Tracking Progress</h2>
            <p>
              Enter a competitor name or WCA ID to search, select an event,
              and click "Add Graph" to see progression over time.
            </p>
            <div className="example-text">
              <strong>Try searching for:</strong><br />
              Lewis He, Max Park, Yusheng Du, or any WCA competitor!
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Data from the Unofficial WCA Public API by Robin Ingelbrecht</p>
      </footer>
    </div>
  );
}

export default App;
