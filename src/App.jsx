import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Filter,
  LayoutDashboard,
  MessageSquare,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  calculateNPS,
  countBy,
  filterRows,
  getComparablePeriod,
  loadSurveyData,
  npsDistribution,
  tenureValue,
  uniqueCount,
  uniqueRespondentsByDemographic
} from './utils/data.js';
import { COLS } from './utils/schema.js';

const DLS_BLUE = '#002855';
const DLS_GOLD = '#C5B358';
const LIGHT_GOLD = '#e5dbb0';
const MUTED_BLUE = '#1a4b82';
const CURRENT_COLOR = '#0066ff';
const PRIOR_COLOR = '#ff9f1c';

const EXPERIENCE_COLORS = ['#22c55e', '#0f766e', '#e11d48', '#eab308', '#7c3aed'];
const FOUNDATION_COLORS = ['#ec4899', '#7e22ce', '#f97316', '#1d4ed8', '#38bdf8'];

const tabs = [
  { name: 'Demographics', icon: Users },
  { name: 'NPS', icon: BarChart3 },
  { name: 'Experience', icon: LayoutDashboard },
  { name: 'Feedback', icon: MessageSquare }
];

const answerSets = {
  Experience: [
    { score: 1, label: 'Very Satisfied / Extremely Well' },
    { score: 2, label: 'Satisfied / Well' },
    { score: 3, label: 'Somewhat Well' },
    { score: 4, label: 'Dissatisfied / Slightly Well' },
    { score: 5, label: 'Very Dissatisfied / Not Well At All' }
  ],
  Foundations: [
    { score: 1, label: 'Strongly Agree' },
    { score: 2, label: 'Agree' },
    { score: 3, label: 'Neither Agree nor Disagree' },
    { score: 4, label: 'Disagree' },
    { score: 5, label: 'Strongly Disagree' }
  ]
};

const demographicFilterConfig = [
  { key: 'studentGrade', label: 'Student grade', column: COLS.studentGrade, groups: ['Student'] },
  { key: 'studentTenure', label: 'Student tenure', column: COLS.studentTenure, groups: ['Student'] },
  { key: 'studentExtra', label: 'Student extracurriculars', column: COLS.studentExtra, groups: ['Student'] },
  { key: 'parentGrades', label: 'Child grade', column: COLS.parentGrades, groups: ['Parent'], split: true },
  { key: 'parentTenure', label: 'Child tenure', column: COLS.parentTenure, groups: ['Parent'] },
  { key: 'parentInvolvement', label: 'Parent involvement', column: COLS.parentInvolvement, groups: ['Parent'] },
  { key: 'staffGrades', label: 'Grade levels taught', column: COLS.staffGrades, groups: ['Staff', 'Teaching Faculty'], split: true },
  { key: 'staffTenure', label: 'Staff tenure', column: COLS.staffTenure, groups: ['Staff', 'Teaching Faculty'] },
  { key: 'alumniPeriod', label: 'Alumni period', column: COLS.alumniPeriod, groups: ['Alumni'] }
];

const defaultDemoFilters = Object.fromEntries(demographicFilterConfig.map((f) => [f.key, 'All']));

function formatDelta(delta) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return '--';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
}

function MetricCard({ title, current, previous, compareEnabled }) {
  const hasComparison = compareEnabled && previous !== null && previous !== undefined && current !== null && current !== undefined;
  const delta = hasComparison ? current - previous : null;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const DirectionIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <div className="metric-card">
      <div className="metric-value-row">
        <span className="metric-value">{current ?? '--'}</span>
        {hasComparison && (
          <span className={`delta delta-${direction}`}>
            <DirectionIcon size={14} /> {formatDelta(delta)}
          </span>
        )}
      </div>
      <span className="metric-label">{title}</span>
    </div>
  );
}

function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function splitValues(value) {
  return String(value || '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);
}

function matchesSelectedValue(rawValue, selectedValue) {
  if (!selectedValue || selectedValue === 'All') return true;
  return splitValues(rawValue).includes(selectedValue) || String(rawValue || '').trim() === selectedValue;
}

function optionValues(rows, column, split = false) {
  const values = new Set();
  rows.forEach((row) => {
    const raw = row[column];
    if (!raw) return;
    if (split) splitValues(raw).forEach((value) => values.add(value));
    else values.add(String(raw).trim());
  });
  return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function getActiveDemoFilters(selectedGroup) {
  if (selectedGroup === 'All Groups') return [];
  return demographicFilterConfig.filter((f) => f.groups.includes(selectedGroup));
}

function rowMatchesDemoFilters(row, demoFilters, activeFilters) {
  return activeFilters.every((filter) => matchesSelectedValue(row[filter.column], demoFilters[filter.key]));
}

function DistributionStack({ title, subtitle, rows, colors, compareEnabled, previousPeriod }) {
  return (
    <section className="card full-width distribution-card">
      <div className="chart-title-row">
        <div>
          <h2>{title}</h2>
          <p className="card-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="distribution-bars">
        {rows.map((row) => (
          <div className="distribution-row" key={row.period}>
            <div className="distribution-period-label">{row.period}</div>
            <div className="stacked-bar" aria-label={`${title} ${row.period}`}>
              {row.answers.map((answer, index) => (
                <div
                  key={answer.label}
                  className="stack-segment"
                  style={{ width: `${answer.pct}%`, backgroundColor: colors[index % colors.length] }}
                  title={`${answer.label}: ${answer.pct}% (${answer.count} responses)`}
                >
                  {answer.pct >= 8 ? <span>{answer.pct.toFixed(1)}%</span> : null}
                </div>
              ))}
            </div>
            <div className="distribution-total">n={row.total}</div>
          </div>
        ))}
      </div>
      <div className="distribution-legend">
        {rows[0]?.answers.map((answer, index) => (
          <span key={answer.label}><i style={{ backgroundColor: colors[index % colors.length] }} />{answer.label}</span>
        ))}
      </div>
    </section>
  );
}

function NpsBadge({ value }) {
  if (value === null || value === undefined) return <span className="nps-badge muted">N/A</span>;
  const tone = value >= 30 ? 'green' : value >= 0 ? 'yellow' : 'red';
  return <span className={`nps-badge ${tone}`}><i />{value > 0 ? '+' : ''}{value.toFixed(1)}</span>;
}

function StatusDot({ tone }) {
  return <span className={`status-dot ${tone || 'muted'}`} aria-hidden="true" />;
}

function npsTone(value) {
  if (value === null || value === undefined) return 'muted';
  if (value >= 30) return 'green';
  if (value >= 0) return 'yellow';
  return 'red';
}

function formatScore(value, prefixPositive = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${prefixPositive && value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

function NpsSummaryCell({ cell }) {
  if (!cell || cell.current === null || cell.current === undefined) {
    return <span className="summary-cell empty">N/A</span>;
  }
  const delta = cell.previous === null || cell.previous === undefined ? null : cell.current - cell.previous;
  const deltaDirection = delta === null ? 'muted' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <div className="summary-cell">
      <div className="summary-primary"><StatusDot tone={npsTone(cell.current)} /><strong>{formatScore(cell.current, true)}</strong></div>
      <div className={`summary-delta ${deltaDirection}`}>{delta === null ? 'No prior' : `${formatScore(delta, true)} YoY`}</div>
    </div>
  );
}

function averageScore(rows) {
  const scored = rows.filter((row) => row._score !== null && row._score !== undefined);
  if (!scored.length) return null;
  return Number((scored.reduce((sum, row) => sum + Number(row._score), 0) / scored.length).toFixed(1));
}

function averageTone(value) {
  if (value === null || value === undefined) return 'muted';
  if (value <= 1.9) return 'green';
  if (value <= 2.4) return 'lime';
  if (value <= 2.9) return 'yellow';
  return 'red';
}

function AverageSummaryCell({ cell }) {
  if (!cell || cell.current === null || cell.current === undefined) {
    return <span className="summary-cell empty">N/A</span>;
  }
  const delta = cell.previous === null || cell.previous === undefined ? null : Number((cell.current - cell.previous).toFixed(1));
  // Lower average scores are better for Experience / Foundations.
  const improved = delta !== null ? delta < 0 : null;
  const deltaClass = delta === null ? 'muted' : improved ? 'up' : delta > 0 ? 'down' : 'flat';
  return (
    <div className="summary-cell">
      <div className="summary-primary"><StatusDot tone={averageTone(cell.current)} /><strong>{formatScore(cell.current)}</strong></div>
      <div className={`summary-delta ${deltaClass}`}>{delta === null ? `n=${cell.currentCount}` : `${formatScore(delta, true)} YoY · n=${cell.currentCount}`}</div>
    </div>
  );
}

function CurrentNpsLabel({ x, y, width, height, value, index, data }) {
  const row = data?.[index];
  if (value === null || value === undefined || !row) return null;
  const labelX = value >= 0 ? x + width + 8 : x - 8;
  const anchor = value >= 0 ? 'start' : 'end';
  const deltaText = row.delta === null || row.delta === undefined ? '' : ` (${formatScore(row.delta, true)})`;
  return (
    <text x={labelX} y={y + height / 2 + 4} textAnchor={anchor} className={row.delta > 0 ? 'chart-label-positive' : row.delta < 0 ? 'chart-label-negative' : 'chart-label-flat'}>
      {formatScore(value, true)}{deltaText}
    </text>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState('NPS');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All Groups');
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [demoFilters, setDemoFilters] = useState(defaultDemoFilters);
  const [npsDetailGroup, setNpsDetailGroup] = useState('Overall');

  useEffect(() => {
    loadSurveyData()
      .then((loaded) => {
        setData(loaded);
        setSelectedPeriod(loaded.periods.at(-1) || '');
      })
      .catch((error) => {
        console.error(error);
        setLoadError(error.message || 'Unable to load CSV files');
      });
  }, []);

  useEffect(() => {
    setDemoFilters(defaultDemoFilters);
    if (selectedGroup !== 'All Groups') setNpsDetailGroup(selectedGroup);
  }, [selectedGroup]);

  const filterOptions = useMemo(() => {
    if (!data) return {};
    const baseRows = data.responses.filter((row) => !selectedPeriod || row._period === selectedPeriod);
    return Object.fromEntries(
      demographicFilterConfig.map((filter) => {
        const rows = baseRows.filter((row) => filter.groups.includes(row._group));
        return [filter.key, optionValues(rows, filter.column, filter.split)];
      })
    );
  }, [data, selectedPeriod]);

  const derived = useMemo(() => {
    if (!data || !selectedPeriod) return null;

    const previousPeriod = getComparablePeriod(data.periods, selectedPeriod);
    const activeDemoFilters = getActiveDemoFilters(selectedGroup);

    const filterResponseSet = (period) => filterRows(data.responses, { period, group: selectedGroup })
      .filter((row) => rowMatchesDemoFilters(row, demoFilters, activeDemoFilters));

    const currentResponses = filterResponseSet(selectedPeriod);
    const previousResponses = previousPeriod ? filterResponseSet(previousPeriod) : [];
    const currentRespIds = new Set(currentResponses.map((row) => row._respId).filter(Boolean));
    const previousRespIds = new Set(previousResponses.map((row) => row._respId).filter(Boolean));

    const currentNps = filterRows(data.nps, { period: selectedPeriod, group: selectedGroup })
      .filter((row) => activeDemoFilters.length === 0 || currentRespIds.has(row._respId));
    const previousNps = previousPeriod
      ? filterRows(data.nps, { period: previousPeriod, group: selectedGroup })
        .filter((row) => activeDemoFilters.length === 0 || previousRespIds.has(row._respId))
      : [];

    const intents = Array.from(new Set(data.nps.map((d) => d._intent).filter(Boolean)));
    const groupsForSummary = ['Alumni', 'Parent', 'Staff', 'Student'].filter((group) => data.groups.includes(group));

    const npsFor = (period, group, intent, respIds = null) => {
      const rows = data.nps.filter((row) => {
        if (row._period !== period) return false;
        if (group !== 'Overall' && row._group !== group) return false;
        if (intent && row._intent !== intent) return false;
        if (respIds && !respIds.has(row._respId)) return false;
        return true;
      });
      return calculateNPS(rows);
    };

    const detailGroup = selectedGroup !== 'All Groups' ? selectedGroup : npsDetailGroup;
    const detailCurrentRows = detailGroup === 'Overall'
      ? currentNps
      : currentNps.filter((row) => row._group === detailGroup);
    const detailPreviousRows = detailGroup === 'Overall'
      ? previousNps
      : previousNps.filter((row) => row._group === detailGroup);

    const topMetrics = intents.map((intent) => ({
      intent,
      current: calculateNPS(currentNps.filter((d) => d._intent === intent)),
      previous: calculateNPS(previousNps.filter((d) => d._intent === intent))
    }));

    const overallNpsByIntent = intents.map((intent) => {
      const current = calculateNPS(currentNps.filter((d) => d._intent === intent));
      const previous = calculateNPS(previousNps.filter((d) => d._intent === intent));
      return {
        intent,
        [selectedPeriod]: current ?? 0,
        [previousPeriod || 'Comparison']: previous ?? 0,
        delta: current !== null && current !== undefined && previous !== null && previous !== undefined ? Number((current - previous).toFixed(1)) : null
      };
    });

    const detailNpsByIntent = intents.map((intent) => {
      const current = calculateNPS(detailCurrentRows.filter((d) => d._intent === intent));
      const previous = calculateNPS(detailPreviousRows.filter((d) => d._intent === intent));
      return {
        intent,
        [selectedPeriod]: current ?? 0,
        [previousPeriod || 'Comparison']: previous ?? 0,
        delta: current !== null && current !== undefined && previous !== null && previous !== undefined ? Number((current - previous).toFixed(1)) : null
      };
    });

    const npsRadar = overallNpsByIntent.map((metric) => ({
      intent: metric.intent,
      [selectedPeriod]: metric[selectedPeriod] ?? 0,
      [previousPeriod || 'Comparison']: metric[previousPeriod || 'Comparison'] ?? 0
    }));

    const respFilterFor = (period, group) => {
      if (!activeDemoFilters.length) return null;
      if (selectedGroup === 'All Groups') return null;
      if (group !== 'Overall' && group !== selectedGroup) return new Set();
      return period === selectedPeriod ? currentRespIds : previousRespIds;
    };

    const buildNpsCell = (group, intent) => {
      const current = npsFor(selectedPeriod, group, intent, respFilterFor(selectedPeriod, group));
      const previous = previousPeriod ? npsFor(previousPeriod, group, intent, respFilterFor(previousPeriod, group)) : null;
      return { current, previous };
    };

    const npsSummaryRows = intents.map((intent) => {
      const row = { intent };
      groupsForSummary.forEach((group) => { row[group] = buildNpsCell(group, intent); });
      row.Overall = buildNpsCell('Overall', intent);
      return row;
    });

    const studentRows = currentResponses.filter((d) => d._group === 'Student' && d[COLS.studentGrade]);
    const previousStudentRows = previousResponses.filter((d) => d._group === 'Student' && d[COLS.studentGrade]);
    const gradeCurrent = uniqueRespondentsByDemographic(studentRows, (d) => d[COLS.studentGrade]);
    const gradePrevious = uniqueRespondentsByDemographic(previousStudentRows, (d) => d[COLS.studentGrade]);
    const gradeMap = new Map();
    gradeCurrent.forEach((d) => gradeMap.set(d.name, { name: d.name, [selectedPeriod]: d.count, [previousPeriod || 'Comparison']: 0 }));
    gradePrevious.forEach((d) => {
      const row = gradeMap.get(d.name) || { name: d.name, [selectedPeriod]: 0, [previousPeriod || 'Comparison']: 0 };
      row[previousPeriod || 'Comparison'] = d.count;
      gradeMap.set(d.name, row);
    });

    const tenureCounts = uniqueRespondentsByDemographic(currentResponses, tenureValue).sort((a, b) => b.count - a.count);
    const involvementCounts = countBy(currentResponses.filter((d) => d._group === 'Parent'), (d) => d[COLS.parentInvolvement], 'count');
    const extracurricularCounts = countBy(currentResponses.filter((d) => d._group === 'Student'), (d) => d[COLS.studentExtra], 'count');

    const buildDistributions = (category) => {
      const currentRows = currentResponses.filter((d) => d._category === category && d._score !== null);
      const prevRows = previousResponses.filter((d) => d._category === category && d._score !== null);
      const intentsForCategory = Array.from(new Set([...currentRows, ...prevRows].map((d) => d._intent).filter(Boolean)));
      const choices = answerSets[category];
      return intentsForCategory.map((intent) => {
        const periodRows = [
          { period: selectedPeriod, rows: currentRows.filter((d) => d._intent === intent) }
        ];
        if (compareEnabled && previousPeriod) {
          periodRows.unshift({ period: previousPeriod, rows: prevRows.filter((d) => d._intent === intent) });
        }
        return {
          intent,
          periods: periodRows.map((periodRow) => {
            const total = periodRow.rows.length;
            return {
              period: periodRow.period,
              total,
              answers: choices.map((choice) => {
                const count = periodRow.rows.filter((d) => d._score === choice.score).length;
                return {
                  label: choice.label,
                  count,
                  pct: total ? Number(((count / total) * 100).toFixed(1)) : 0
                };
              })
            };
          })
        };
      });
    };

    const buildAverageSummary = (category) => {
      const currentRows = currentResponses.filter((d) => d._category === category && d._score !== null);
      const prevRows = previousResponses.filter((d) => d._category === category && d._score !== null);
      const intentsForCategory = Array.from(new Set([...currentRows, ...prevRows].map((d) => d._intent).filter(Boolean)));
      return intentsForCategory.map((intent) => {
        const currentIntentRows = currentRows.filter((d) => d._intent === intent);
        const previousIntentRows = prevRows.filter((d) => d._intent === intent);
        return {
          intent,
          current: averageScore(currentIntentRows),
          previous: averageScore(previousIntentRows),
          currentCount: currentIntentRows.length,
          previousCount: previousIntentRows.length
        };
      });
    };

    const feedbackRows = currentResponses
      .filter((d) => d._category === 'Feedback' && String(d[COLS.value] || '').trim())
      .slice(0, 500);

    return {
      previousPeriod,
      currentNps,
      previousNps,
      currentResponses,
      previousResponses,
      totalCurrent: uniqueCount(currentNps),
      totalPrevious: uniqueCount(previousNps),
      overallNps: calculateNPS(currentNps),
      previousOverallNps: calculateNPS(previousNps),
      npsDistribution: npsDistribution(currentNps),
      topMetrics,
      npsRadar,
      overallNpsByIntent,
      detailNpsByIntent,
      npsSummaryRows,
      groupsForSummary,
      detailGroup,
      demoGrades: Array.from(gradeMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      demoTenure: tenureCounts,
      involvementCounts,
      extracurricularCounts,
      experienceSummaryRows: buildAverageSummary('Experience'),
      foundationSummaryRows: buildAverageSummary('Foundations'),
      experienceDistributions: buildDistributions('Experience'),
      foundationDistributions: buildDistributions('Foundations'),
      feedbackRows
    };
  }, [data, selectedPeriod, selectedGroup, demoFilters, npsDetailGroup, compareEnabled]);

  function downloadFilteredCsv() {
    if (!derived) return;
    const rows = activeTab === 'NPS' ? derived.currentNps : derived.currentResponses;
    const headers = Object.keys(rows[0] || {}).filter((h) => !h.startsWith('_'));
    const csv = [headers.join(',')]
      .concat(rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dls-${activeTab.toLowerCase()}-${selectedPeriod}-${selectedGroup}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (loadError) {
    return <EmptyState title="Data could not be loaded">{loadError}</EmptyState>;
  }

  if (!data || !derived) {
    return (
      <div className="loading-screen">
        <RefreshCw className="spin" />
        <p>Loading DLS survey files from public/data...</p>
      </div>
    );
  }

  const comparisonKey = derived.previousPeriod || 'Comparison';
  const activeDemoFilters = getActiveDemoFilters(selectedGroup);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">DLS</div>
          <div>
            <h1>Survey Analytics</h1>
            <p>CSV-backed prototype · public/data</p>
          </div>
        </div>
        <nav className="tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.name} className={activeTab === tab.name ? 'active' : ''} onClick={() => setActiveTab(tab.name)}>
                <Icon size={18} /> {tab.name}
              </button>
            );
          })}
        </nav>
        <button className="download-button" onClick={downloadFilteredCsv}>
          <Download size={16} /> Export filtered
        </button>
      </header>

      <div className="content-shell">
        <aside className="sidebar">
          <div className="filter-title"><Filter size={18} /> Filters</div>
          <label>
            Survey period
            <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>
              {data.periods.map((period) => <option key={period}>{period}</option>)}
            </select>
          </label>
          <label>
            Target group
            <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
              <option>All Groups</option>
              {data.groups.map((group) => <option key={group}>{group}</option>)}
            </select>
          </label>

          {activeDemoFilters.length > 0 && (
            <div className="persona-filters">
              <div className="filter-section-label">Persona filters</div>
              {activeDemoFilters.map((filter) => (
                <label key={filter.key}>
                  {filter.label}
                  <select
                    value={demoFilters[filter.key] || 'All'}
                    onChange={(event) => setDemoFilters((prev) => ({ ...prev, [filter.key]: event.target.value }))}
                  >
                    <option value="All">All</option>
                    {(filterOptions[filter.key] || []).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}

          <label className="checkbox-row">
            <input type="checkbox" checked={compareEnabled} onChange={(event) => setCompareEnabled(event.target.checked)} />
            Compare with {derived.previousPeriod || 'prior period'}
          </label>
          <div className="schema-note">
            <strong>Loaded files</strong>
            <span>{data.nps.length.toLocaleString()} NPS rows</span>
            <span>{data.responses.length.toLocaleString()} response rows</span>
          </div>
        </aside>

        <main className="main-content">
          <section className="metric-strip">
            <MetricCard title="Respondents" current={derived.totalCurrent} previous={derived.totalPrevious} compareEnabled={compareEnabled} />
            <MetricCard title="Overall NPS" current={derived.overallNps} previous={derived.previousOverallNps} compareEnabled={compareEnabled} />
            {derived.topMetrics.map((metric) => (
              <MetricCard key={metric.intent} title={metric.intent} current={metric.current} previous={metric.previous} compareEnabled={compareEnabled} />
            ))}
          </section>

          {activeTab === 'NPS' && (
            <div className="nps-stack">
              <section className="card full-width summary-card">
                <h2>NPS summary by stakeholder</h2>
                <p className="card-subtitle">Table first: each cell shows the current NPS and the increase/decrease versus {derived.previousPeriod || 'the prior period'}. A score of 0.0 is valid; only empty cells are shown as N/A.</p>
                <div className="nps-summary-table-wrap polished-table-wrap">
                  <table className="nps-summary-table polished-summary-table">
                    <thead>
                      <tr>
                        <th>NPS question</th>
                        {derived.groupsForSummary.map((group) => <th key={group}>{group === 'Parent' ? 'Parents' : group === 'Student' ? 'Students' : group}</th>)}
                        <th>Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derived.npsSummaryRows.map((row) => (
                        <tr key={row.intent}>
                          <td>{row.intent}</td>
                          {derived.groupsForSummary.map((group) => <td key={group}><NpsSummaryCell cell={row[group]} /></td>)}
                          <td><NpsSummaryCell cell={row.Overall} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card full-width">
                <h2>Overall NPS by question</h2>
                <p className="card-subtitle">Overall score chart with current/prior period bars. Labels show current score and YoY variance in brackets.</p>
                <div className="chart-height nps-overall-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={derived.overallNpsByIntent} margin={{ top: 10, right: 95, bottom: 10, left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <ReferenceLine x={0} stroke="#334155" />
                      <XAxis type="number" domain={[-100, 100]} />
                      <YAxis type="category" dataKey="intent" width={235} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      {compareEnabled && derived.previousPeriod && <Bar dataKey={comparisonKey} name={derived.previousPeriod} fill={PRIOR_COLOR} barSize={16} />}
                      <Bar dataKey={selectedPeriod} name={selectedPeriod} fill={CURRENT_COLOR} barSize={18}>
                        <LabelList content={(props) => <CurrentNpsLabel {...props} data={derived.overallNpsByIntent} />} />
                      </Bar>
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card full-width">
                <div className="chart-title-row">
                  <div>
                    <h2>NPS detail</h2>
                    <p className="card-subtitle">Select one group for a larger, easier-to-read YoY comparison.</p>
                  </div>
                  <select className="inline-select" value={derived.detailGroup} onChange={(event) => setNpsDetailGroup(event.target.value)} disabled={selectedGroup !== 'All Groups'}>
                    <option value="Overall">Overall</option>
                    {data.groups.map((group) => <option key={group} value={group}>{group}</option>)}
                  </select>
                </div>
                <div className="chart-height nps-detail-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={derived.detailNpsByIntent} margin={{ top: 10, right: 52, bottom: 10, left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <ReferenceLine x={0} stroke="#334155" />
                      <XAxis type="number" domain={[-100, 100]} />
                      <YAxis type="category" dataKey="intent" width={245} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      {compareEnabled && derived.previousPeriod && <Bar dataKey={comparisonKey} name={derived.previousPeriod} fill={PRIOR_COLOR} barSize={18} />}
                      <Bar dataKey={selectedPeriod} name={selectedPeriod} fill={CURRENT_COLOR} barSize={20}>
                        <LabelList content={(props) => <CurrentNpsLabel {...props} data={derived.detailNpsByIntent} />} />
                      </Bar>
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card full-width">
                <h2>NPS response mix</h2>
                <div className="mix-grid">
                  <div><strong>{derived.npsDistribution.promoterPct}%</strong><span>Promoters</span></div>
                  <div><strong>{derived.npsDistribution.passivePct}%</strong><span>Passives</span></div>
                  <div><strong>{derived.npsDistribution.detractorPct}%</strong><span>Detractors</span></div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Demographics' && (
            <div className="grid two-col">
              <section className="card">
                <h2>Student grade distribution</h2>
                <p className="card-subtitle">Unique student respondents by grade.</p>
                <div className="chart-height">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={derived.demoGrades} margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip />
                      {compareEnabled && derived.previousPeriod && <Bar dataKey={comparisonKey} name={derived.previousPeriod} fill={PRIOR_COLOR} barSize={12} />}
                      <Bar dataKey={selectedPeriod} name={selectedPeriod} fill={CURRENT_COLOR} barSize={14} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card">
                <h2>Tenure / affiliation</h2>
                <p className="card-subtitle">Uses the relevant tenure field for each group.</p>
                <div className="chart-height">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={derived.demoTenure} dataKey="count" nameKey="name" innerRadius={65} outerRadius={105} paddingAngle={2}>
                        {derived.demoTenure.map((_, index) => (
                          <Cell key={index} fill={[CURRENT_COLOR, PRIOR_COLOR, DLS_BLUE, DLS_GOLD, '#22c55e', '#ef4444', '#7c3aed'][index % 7]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend layout="vertical" align="right" verticalAlign="middle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card">
                <h2>Student extracurricular participation</h2>
                <div className="chart-height small">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={derived.extracurricularCounts}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill={CURRENT_COLOR} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card">
                <h2>Parent community involvement</h2>
                <div className="chart-height small">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={derived.involvementCounts} margin={{ left: 20, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill={PRIOR_COLOR} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Experience' && (
            <div className="experience-stack">
              <section className="card full-width">
                <h2>Experience and foundations</h2>
                <p className="card-subtitle">Summary tables show the average score and YoY variance. Lower scores are better because 1 is the most positive answer and 5 is the least positive answer.</p>
              </section>

              <section className="section-label-card">Tell us about your experience</section>
              <section className="card full-width summary-card">
                <h2>Experience summary</h2>
                <p className="card-subtitle">Average response score by question, with status circles and variance versus {derived.previousPeriod || 'the prior period'}.</p>
                <div className="experience-summary-grid">
                  {derived.experienceSummaryRows.map((row) => (
                    <div className="experience-summary-card" key={`experience-summary-${row.intent}`}>
                      <div className="experience-question">{row.intent}</div>
                      <AverageSummaryCell cell={row} />
                    </div>
                  ))}
                </div>
              </section>
              {derived.experienceDistributions.map((question) => (
                <DistributionStack
                  key={`experience-${question.intent}`}
                  title={question.intent}
                  subtitle="Count of each answer shown as a percentage of total responses."
                  rows={question.periods}
                  colors={EXPERIENCE_COLORS}
                  compareEnabled={compareEnabled}
                  previousPeriod={derived.previousPeriod}
                />
              ))}

              <section className="section-label-card">Foundations</section>
              <section className="card full-width summary-card">
                <h2>Foundations summary</h2>
                <p className="card-subtitle">Average agreement score by question, with status circles and variance versus {derived.previousPeriod || 'the prior period'}.</p>
                <div className="experience-summary-grid">
                  {derived.foundationSummaryRows.map((row) => (
                    <div className="experience-summary-card" key={`foundation-summary-${row.intent}`}>
                      <div className="experience-question">{row.intent}</div>
                      <AverageSummaryCell cell={row} />
                    </div>
                  ))}
                </div>
              </section>
              {derived.foundationDistributions.map((question) => (
                <DistributionStack
                  key={`foundation-${question.intent}`}
                  title={question.intent}
                  subtitle="Count of each agreement answer shown as a percentage of total responses."
                  rows={question.periods}
                  colors={FOUNDATION_COLORS}
                  compareEnabled={compareEnabled}
                  previousPeriod={derived.previousPeriod}
                />
              ))}
            </div>
          )}

          {activeTab === 'Feedback' && (
            <section className="card full-width">
              <h2>Open-ended feedback</h2>
              <p className="card-subtitle">The file includes verbatims but does not include sentiment labels or sentiment scores, so this tab shows searchable feedback-ready rows rather than a sentiment chart.</p>
              <div className="feedback-table">
                <table>
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Question</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.feedbackRows.slice(0, 100).map((row, index) => (
                      <tr key={`${row._respId}-${index}`}>
                        <td>{row._group}</td>
                        <td>{row._intent}</td>
                        <td>{row[COLS.value]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
