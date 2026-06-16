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
  calculateNPSStats,
  countBy,
  countRespondentsBy,
  filterRows,
  getComparablePeriod,
  loadSurveyData,
  npsDistribution,
  roughSentiment,
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
const RESPONDER_COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#9333ea', '#ef4444'];
const FOUNDATION_COLORS = ['#ec4899', '#7e22ce', '#f97316', '#1d4ed8', '#38bdf8'];

const tabs = [
  { name: 'Overall', icon: Users },
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

const defaultDemoFilters = Object.fromEntries(demographicFilterConfig.map((f) => [f.key, ['All']]));

function formatDelta(delta) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return '--';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
}

function MetricCard({ title, current, previous, compareEnabled, tone = 'neutral' }) {
  const hasComparison = compareEnabled && previous !== null && previous !== undefined && current !== null && current !== undefined;
  const delta = hasComparison ? current - previous : null;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const DirectionIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <div className={`metric-card metric-card-${tone}`}>
      <div className="metric-value-row">
        <span className="metric-status-dot" aria-hidden="true" />
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

function normalizeSelection(value) {
  if (Array.isArray(value)) return value;
  if (!value || value === 'All') return ['All'];
  return [value];
}

function isAllSelection(selection) {
  const values = normalizeSelection(selection);
  return values.length === 0 || values.includes('All') || values.includes('All Groups');
}

function toggleSelection(current, option, allLabel = 'All') {
  const values = normalizeSelection(current);
  if (option === allLabel) return [allLabel];
  const withoutAll = values.filter((value) => value !== allLabel && value !== 'All Groups');
  const next = withoutAll.includes(option)
    ? withoutAll.filter((value) => value !== option)
    : [...withoutAll, option];
  return next.length ? next : [allLabel];
}

function MultiSelect({ label, value, options, onChange, allLabel = 'All' }) {
  const selected = normalizeSelection(value);
  const selectedOptions = selected.filter((item) => item !== allLabel && item !== 'All Groups');
  const summary = isAllSelection(selected)
    ? allLabel
    : selectedOptions.length <= 2
      ? selectedOptions.join(', ')
      : `${selectedOptions.length} selected`;

  return (
    <label className="multi-select-label">
      {label}
      <details className="multi-select">
        <summary>{summary}</summary>
        <div className="multi-select-menu">
          <button type="button" className="multi-select-option" onClick={() => onChange([allLabel])}>
            <input type="checkbox" readOnly checked={isAllSelection(selected)} />
            <span>{allLabel}</span>
          </button>
          {options.map((option) => (
            <button key={option} type="button" className="multi-select-option" onClick={() => onChange(toggleSelection(selected, option, allLabel))}>
              <input type="checkbox" readOnly checked={!isAllSelection(selected) && selected.includes(option)} />
              <span>{option}</span>
            </button>
          ))}
        </div>
      </details>
    </label>
  );
}

function rowPeriodMatches(row, selectedPeriods) {
  return isAllSelection(selectedPeriods) || normalizeSelection(selectedPeriods).includes(row._period);
}

function rowGroupMatches(row, selectedGroups) {
  if (isAllSelection(selectedGroups)) return true;
  const groups = normalizeSelection(selectedGroups);
  return groups.some((group) => {
    if (group === 'Staff') return row._group === 'Staff' || row._group === 'Teaching Faculty';
    return row._group === group;
  });
}

function getSelectedGroups(selectedGroups, allGroups) {
  return isAllSelection(selectedGroups) ? ['All Groups'] : normalizeSelection(selectedGroups).filter((g) => allGroups.includes(g));
}

function matchesSelectedValue(rawValue, selectedValue) {
  if (isAllSelection(selectedValue)) return true;
  const selectedValues = normalizeSelection(selectedValue);
  const rawValues = splitValues(rawValue);
  const rawTrimmed = String(rawValue || '').trim();
  return selectedValues.some((value) => rawValues.includes(value) || rawTrimmed === value);
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

function getActiveDemoFilters(selectedGroups) {
  if (isAllSelection(selectedGroups)) return [];
  const groups = normalizeSelection(selectedGroups);
  return demographicFilterConfig.filter((f) => groups.some((group) => f.groups.includes(group)));
}

function rowMatchesDemoFilters(row, demoFilters, activeFilters) {
  return activeFilters.every((filter) => {
    if (!filter.groups.includes(row._group)) return true;
    return matchesSelectedValue(row[filter.column], demoFilters[filter.key]);
  });
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
  const delta = cell.previous === null || cell.previous === undefined ? null : Number((cell.current - cell.previous).toFixed(1));
  const deltaDirection = delta === null ? 'muted' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <div className="summary-cell">
      <div className="summary-primary"><StatusDot tone={npsTone(cell.current)} /><strong>{formatScore(cell.current, true)}</strong></div>
      <div className={`summary-delta ${deltaDirection}`}>{delta === null ? 'No prior' : `${formatScore(delta, true)} YoY`}</div>
      <div className="summary-count">n={cell.currentStats?.total ?? 0}</div>
    </div>
  );
}

function averageScore(rows) {
  const scored = rows.filter((row) => row._positiveScore !== null && row._positiveScore !== undefined);
  if (!scored.length) return null;
  return Number((scored.reduce((sum, row) => sum + Number(row._positiveScore), 0) / scored.length).toFixed(3));
}

function averageTone(value) {
  if (value === null || value === undefined) return 'muted';
  if (value >= 4.0) return 'green';
  if (value >= 3.0) return 'yellow';
  return 'red';
}

function AverageSummaryCell({ cell }) {
  if (!cell || cell.current === null || cell.current === undefined) {
    return <span className="summary-cell empty">N/A</span>;
  }
  const delta = cell.previous === null || cell.previous === undefined ? null : Number((cell.current - cell.previous).toFixed(1));
  // Higher average scores are better for Experience / Foundations after QA remapping: 5 = strongest positive, 1 = weakest.
  const improved = delta !== null ? delta > 0 : null;
  const deltaClass = delta === null ? 'muted' : improved ? 'up' : delta < 0 ? 'down' : 'flat';
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

function NpsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => {
        const stats = item.payload?.[`${item.dataKey}Stats`];
        if (!stats) return null;
        return (
          <div className="tooltip-period" key={item.dataKey}>
            <div className="tooltip-period-title" style={{ color: item.color }}>{item.name}</div>
            <div>NPS: <strong>{formatScore(stats.nps, true)}</strong></div>
            <div>Respondents: <strong>{stats.total}</strong></div>
            <div>Promoters: <strong>{stats.promoters}</strong> ({stats.promoterPct}%)</div>
            <div>Passives: <strong>{stats.passives}</strong> ({stats.passivePct}%)</div>
            <div>Detractors: <strong>{stats.detractors}</strong> ({stats.detractorPct}%)</div>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState('NPS');
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(['All Groups']);
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [demoFilters, setDemoFilters] = useState(defaultDemoFilters);
  const [npsDetailGroup, setNpsDetailGroup] = useState('Overall');
  const [npsMixIntent, setNpsMixIntent] = useState('All NPS questions');
  const [sentimentFilter, setSentimentFilter] = useState('All');

  useEffect(() => {
    loadSurveyData()
      .then((loaded) => {
        setData(loaded);
        setSelectedPeriods([loaded.periods.at(-1) || ''].filter(Boolean));
      })
      .catch((error) => {
        console.error(error);
        setLoadError(error.message || 'Unable to load CSV files');
      });
  }, []);

  useEffect(() => {
    setDemoFilters(defaultDemoFilters);
    const selected = normalizeSelection(selectedGroups).filter((g) => g !== 'All Groups');
    if (selected.length === 1) setNpsDetailGroup(selected[0]);
    else setNpsDetailGroup('Overall');
  }, [selectedGroups]);

  const filterOptions = useMemo(() => {
    if (!data) return {};
    const baseRows = data.responses.filter((row) => rowPeriodMatches(row, selectedPeriods) && rowGroupMatches(row, selectedGroups));
    return Object.fromEntries(
      demographicFilterConfig.map((filter) => {
        const rows = baseRows.filter((row) => filter.groups.includes(row._group));
        return [filter.key, optionValues(rows, filter.column, filter.split)];
      })
    );
  }, [data, selectedPeriods, selectedGroups]);

  const derived = useMemo(() => {
    if (!data || !selectedPeriods.length) return null;

    const primaryPeriod = normalizeSelection(selectedPeriods).filter((p) => p !== 'All').at(-1) || data.periods.at(-1) || '';
    const selectedPeriodLabel = isAllSelection(selectedPeriods) || normalizeSelection(selectedPeriods).length > 1 ? 'Selected periods' : primaryPeriod;
    const canCompare = normalizeSelection(selectedPeriods).filter((p) => p !== 'All').length === 1;
    const previousPeriod = canCompare ? getComparablePeriod(data.periods, primaryPeriod) : null;
    const activeDemoFilters = getActiveDemoFilters(selectedGroups);
    const selectedGroupList = getSelectedGroups(selectedGroups, data.groups);

    const filterResponseSet = (periodSelection) => data.responses
      .filter((row) => periodSelection ? row._period === periodSelection : rowPeriodMatches(row, selectedPeriods))
      .filter((row) => rowGroupMatches(row, selectedGroups))
      .filter((row) => rowMatchesDemoFilters(row, demoFilters, activeDemoFilters));

    const currentResponses = filterResponseSet(null);
    const previousResponses = previousPeriod ? filterResponseSet(previousPeriod) : [];
    const currentRespIds = new Set(currentResponses.map((row) => row._respId).filter(Boolean));
    const previousRespIds = new Set(previousResponses.map((row) => row._respId).filter(Boolean));

    const currentNps = data.nps
      .filter((row) => rowPeriodMatches(row, selectedPeriods) && rowGroupMatches(row, selectedGroups))
      .filter((row) => activeDemoFilters.length === 0 || currentRespIds.has(row._respId));
    const previousNps = previousPeriod
      ? data.nps
        .filter((row) => row._period === previousPeriod && rowGroupMatches(row, selectedGroups))
        .filter((row) => activeDemoFilters.length === 0 || previousRespIds.has(row._respId))
      : [];

    const intents = Array.from(new Set(data.nps.map((d) => d._intent).filter(Boolean)));
    const allSummaryGroups = ['Alumni', 'Parent', 'Staff', 'Teaching Faculty', 'Student'].filter((group) => data.groups.includes(group) || group === 'Staff');
    const groupsForSummary = isAllSelection(selectedGroups) ? allSummaryGroups : selectedGroupList;
    const summaryGroupsWithOverall = groupsForSummary.includes('Overall') ? groupsForSummary : [...groupsForSummary, 'Overall'];

    const npsRowsFor = (period, group, intent, respIds = null) => data.nps.filter((row) => {
      if (row._period !== period) return false;
      if (group !== 'Overall') {
        if (group === 'Staff') {
          if (row._group !== 'Staff' && row._group !== 'Teaching Faculty') return false;
        } else if (row._group !== group) return false;
      }
      if (intent && intent !== 'All NPS questions' && row._intent !== intent) return false;
      if (respIds && !respIds.has(row._respId)) return false;
      return true;
    });

    const npsStatsFor = (period, group, intent, respIds = null) => calculateNPSStats(npsRowsFor(period, group, intent, respIds));

    const npsFor = (period, group, intent, respIds = null) => npsStatsFor(period, group, intent, respIds).nps;

    const detailGroup = selectedGroupList.length === 1 && selectedGroupList[0] !== 'All Groups' ? selectedGroupList[0] : npsDetailGroup;
    const detailCurrentRows = detailGroup === 'Overall'
      ? currentNps
      : currentNps.filter((row) => row._group === detailGroup);
    const detailPreviousRows = detailGroup === 'Overall'
      ? previousNps
      : previousNps.filter((row) => row._group === detailGroup);

    const mixRows = detailCurrentRows.filter((row) => npsMixIntent === 'All NPS questions' || row._intent === npsMixIntent);

    const topMetrics = intents.map((intent) => ({
      intent,
      current: calculateNPS(currentNps.filter((d) => d._intent === intent)),
      previous: calculateNPS(previousNps.filter((d) => d._intent === intent))
    }));

    const overallNpsByIntent = intents.map((intent) => {
      const currentStats = calculateNPSStats(currentNps.filter((d) => d._intent === intent));
      const previousStats = calculateNPSStats(previousNps.filter((d) => d._intent === intent));
      const current = currentStats.nps;
      const previous = previousStats.nps;
      return {
        intent,
        [selectedPeriodLabel]: current ?? 0,
        [`${selectedPeriodLabel}Stats`]: currentStats,
        [previousPeriod || 'Comparison']: previous ?? 0,
        [`${previousPeriod || 'Comparison'}Stats`]: previousStats,
        delta: current !== null && current !== undefined && previous !== null && previous !== undefined ? Number((current - previous).toFixed(1)) : null
      };
    });

    const detailNpsByIntent = intents.map((intent) => {
      const currentStats = calculateNPSStats(detailCurrentRows.filter((d) => d._intent === intent));
      const previousStats = calculateNPSStats(detailPreviousRows.filter((d) => d._intent === intent));
      const current = currentStats.nps;
      const previous = previousStats.nps;
      return {
        intent,
        [selectedPeriodLabel]: current ?? 0,
        [`${selectedPeriodLabel}Stats`]: currentStats,
        [previousPeriod || 'Comparison']: previous ?? 0,
        [`${previousPeriod || 'Comparison'}Stats`]: previousStats,
        delta: current !== null && current !== undefined && previous !== null && previous !== undefined ? Number((current - previous).toFixed(1)) : null
      };
    });

    const npsRadar = overallNpsByIntent.map((metric) => ({
      intent: metric.intent,
      [selectedPeriodLabel]: metric[selectedPeriodLabel] ?? 0,
      [previousPeriod || 'Comparison']: metric[previousPeriod || 'Comparison'] ?? 0
    }));

    const respFilterFor = (period, group) => {
      if (!activeDemoFilters.length) return null;
      if (isAllSelection(selectedGroups)) return null;
      if (group !== 'Overall' && !selectedGroupList.includes(group)) return new Set();
      return period === primaryPeriod ? currentRespIds : previousRespIds;
    };

    const buildNpsCell = (group, intent) => {
      const sourceRows = group === 'Overall'
        ? currentNps
        : currentNps.filter((row) => group === 'Staff' ? row._group === 'Staff' || row._group === 'Teaching Faculty' : row._group === group);
      const currentStats = calculateNPSStats(sourceRows.filter((row) => row._intent === intent));
      const previousStats = previousPeriod ? npsStatsFor(previousPeriod, group, intent, respFilterFor(previousPeriod, group)) : null;
      return { current: currentStats.nps, previous: previousStats?.nps ?? null, currentStats, previousStats };
    };

    const npsSummaryRows = intents.map((intent) => {
      const row = { intent };
      summaryGroupsWithOverall.forEach((group) => { row[group] = buildNpsCell(group, intent); });
      return row;
    });

    const studentRows = currentResponses.filter((d) => d._group === 'Student' && d[COLS.studentGrade]);
    const previousStudentRows = previousResponses.filter((d) => d._group === 'Student' && d[COLS.studentGrade]);
    const gradeCurrent = uniqueRespondentsByDemographic(studentRows, (d) => d[COLS.studentGrade]);
    const gradePrevious = uniqueRespondentsByDemographic(previousStudentRows, (d) => d[COLS.studentGrade]);
    const gradeMap = new Map();
    gradeCurrent.forEach((d) => gradeMap.set(d.name, { name: d.name, [selectedPeriodLabel]: d.count, [previousPeriod || 'Comparison']: 0 }));
    gradePrevious.forEach((d) => {
      const row = gradeMap.get(d.name) || { name: d.name, [selectedPeriodLabel]: 0, [previousPeriod || 'Comparison']: 0 };
      row[previousPeriod || 'Comparison'] = d.count;
      gradeMap.set(d.name, row);
    });

    const tenureCounts = uniqueRespondentsByDemographic(currentResponses, tenureValue).sort((a, b) => b.count - a.count);
    const respondentGroups = ['Student', 'Parent', 'Staff', 'Teaching Faculty', 'Alumni'];
    const respondentMix = respondentGroups.map((group) => ({
      name: group === 'Parent' ? 'Parents' : group === 'Student' ? 'Students' : group,
      count: uniqueCount(currentResponses.filter((d) => d._group === group))
    })).filter((d) => d.count > 0);
    const respondentPeriodComparison = [previousPeriod, primaryPeriod].filter(Boolean).map((period) => {
      const rows = filterResponseSet(period);
      return {
        period,
        Students: uniqueCount(rows.filter((d) => d._group === 'Student')),
        Parents: uniqueCount(rows.filter((d) => d._group === 'Parent')),
        Staff: uniqueCount(rows.filter((d) => d._group === 'Staff' || d._group === 'Teaching Faculty')),
        Alumni: uniqueCount(rows.filter((d) => d._group === 'Alumni'))
      };
    });
    const buildComparisonCounts = (currentRows, previousRows, getter) => {
      const current = countRespondentsBy(currentRows, getter);
      const previous = countRespondentsBy(previousRows, getter);
      const keys = Array.from(new Set([...current.map((d) => d.name), ...previous.map((d) => d.name)])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      return keys.map((name) => ({
        name,
        [selectedPeriodLabel]: current.find((d) => d.name === name)?.count || 0,
        [previousPeriod || 'Comparison']: previous.find((d) => d.name === name)?.count || 0
      }));
    };
    const involvementCounts = buildComparisonCounts(
      currentResponses.filter((d) => d._group === 'Parent'),
      previousResponses.filter((d) => d._group === 'Parent'),
      (d) => d[COLS.parentInvolvement]
    );
    const extracurricularCounts = buildComparisonCounts(
      currentResponses.filter((d) => d._group === 'Student'),
      previousResponses.filter((d) => d._group === 'Student'),
      (d) => d[COLS.studentExtra]
    );

    const buildDistributions = (category) => {
      const currentRows = currentResponses.filter((d) => d._category === category && d._score !== null);
      const prevRows = previousResponses.filter((d) => d._category === category && d._score !== null);
      const intentsForCategory = Array.from(new Set([...currentRows, ...prevRows].map((d) => d._intent).filter(Boolean)));
      const choices = answerSets[category];
      return intentsForCategory.map((intent) => {
        const periodRows = [
          { period: selectedPeriodLabel, rows: currentRows.filter((d) => d._intent === intent) }
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

    const feedbackRowsAll = currentResponses
      .filter((d) => d._category === 'Feedback' && String(d[COLS.value] || '').trim())
      .map((row) => ({ ...row, _sentiment: roughSentiment(row[COLS.value]) }));
    const feedbackRows = feedbackRowsAll.filter((row) => sentimentFilter === 'All' || row._sentiment.label === sentimentFilter).slice(0, 500);
    const sentimentCounts = ['Positive', 'Neutral', 'Negative'].map((label) => ({
      name: label,
      count: feedbackRowsAll.filter((row) => row._sentiment.label === label).length
    }));

    return {
      previousPeriod,
      selectedPeriodLabel,
      primaryPeriod,
      currentNps,
      previousNps,
      currentResponses,
      previousResponses,
      totalCurrent: uniqueCount(currentNps),
      totalPrevious: uniqueCount(previousNps),
      overallNps: calculateNPS(currentNps),
      previousOverallNps: calculateNPS(previousNps),
      npsDistribution: npsDistribution(mixRows),
      topMetrics,
      npsRadar,
      overallNpsByIntent,
      detailNpsByIntent,
      npsSummaryRows,
      groupsForSummary: summaryGroupsWithOverall,
      respondentMix,
      respondentPeriodComparison,
      detailGroup,
      demoGrades: Array.from(gradeMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      demoTenure: tenureCounts,
      involvementCounts,
      extracurricularCounts,
      experienceSummaryRows: buildAverageSummary('Experience'),
      foundationSummaryRows: buildAverageSummary('Foundations'),
      experienceDistributions: buildDistributions('Experience'),
      foundationDistributions: buildDistributions('Foundations'),
      feedbackRows,
      sentimentCounts
    };
  }, [data, selectedPeriods, selectedGroups, demoFilters, npsDetailGroup, compareEnabled, sentimentFilter, npsMixIntent]);

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
    link.download = `dls-${activeTab.toLowerCase()}-${selectedPeriods.join('-') || 'all-periods'}-${selectedGroups.join('-') || 'all-groups'}.csv`;
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
  const activeDemoFilters = getActiveDemoFilters(selectedGroups);

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
          <MultiSelect
            label="Survey period"
            value={selectedPeriods}
            options={data.periods}
            allLabel="All"
            onChange={setSelectedPeriods}
          />
          <MultiSelect
            label="Target group"
            value={selectedGroups}
            options={data.groups}
            allLabel="All Groups"
            onChange={setSelectedGroups}
          />

          {activeDemoFilters.length > 0 && (
            <div className="persona-filters">
              <div className="filter-section-label">Persona filters</div>
              {activeDemoFilters.map((filter) => (
                <MultiSelect
                  key={filter.key}
                  label={filter.label}
                  value={demoFilters[filter.key] || ['All']}
                  options={filterOptions[filter.key] || []}
                  allLabel="All"
                  onChange={(value) => setDemoFilters((prev) => ({ ...prev, [filter.key]: value }))}
                />
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
            <MetricCard title="Respondents" current={derived.totalCurrent} previous={derived.totalPrevious} compareEnabled={compareEnabled} tone="neutral" />
            <MetricCard title="Overall NPS" current={derived.overallNps} previous={derived.previousOverallNps} compareEnabled={compareEnabled} tone={npsTone(derived.overallNps)} />
            {derived.topMetrics.map((metric) => (
              <MetricCard key={metric.intent} title={metric.intent} current={metric.current} previous={metric.previous} compareEnabled={compareEnabled} tone={npsTone(metric.current)} />
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
                      </tr>
                    </thead>
                    <tbody>
                      {derived.npsSummaryRows.map((row) => (
                        <tr key={row.intent}>
                          <td>{row.intent}</td>
                          {derived.groupsForSummary.map((group) => <td key={group}><NpsSummaryCell cell={row[group]} /></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>


              <section className="card full-width">
                <div className="chart-title-row">
                  <div>
                    <h2>NPS detail</h2>
                    <p className="card-subtitle">Select one group for a larger, easier-to-read YoY comparison.</p>
                  </div>
                  <select className="inline-select" value={derived.detailGroup} onChange={(event) => setNpsDetailGroup(event.target.value)} disabled={!isAllSelection(selectedGroups)}>
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
                      <Tooltip content={<NpsTooltip />} />
                      {compareEnabled && derived.previousPeriod && <Bar dataKey={comparisonKey} name={derived.previousPeriod} fill={PRIOR_COLOR} barSize={18} />}
                      <Bar dataKey={derived.selectedPeriodLabel} name={derived.selectedPeriodLabel} fill={CURRENT_COLOR} barSize={20}>
                        <LabelList content={(props) => <CurrentNpsLabel {...props} data={derived.detailNpsByIntent} />} />
                      </Bar>
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card full-width">
                <div className="chart-title-row">
                  <div>
                    <h2>NPS response mix</h2>
                    <p className="card-subtitle">Counts and percentages for the selected NPS detail group. Use the question filter for QA.</p>
                  </div>
                  <select className="inline-select" value={npsMixIntent} onChange={(event) => setNpsMixIntent(event.target.value)}>
                    <option>All NPS questions</option>
                    {data.intents.map((intent) => <option key={intent}>{intent}</option>)}
                  </select>
                </div>
                <div className="mix-grid">
                  <div><strong>{derived.npsDistribution.promoters}</strong><span>Promoters · {derived.npsDistribution.promoterPct}%</span></div>
                  <div><strong>{derived.npsDistribution.passives}</strong><span>Passives · {derived.npsDistribution.passivePct}%</span></div>
                  <div><strong>{derived.npsDistribution.detractors}</strong><span>Detractors · {derived.npsDistribution.detractorPct}%</span></div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Overall' && (
            <div className="grid two-col">
              <section className="card">
                <h2>Responder mix</h2>
                <p className="card-subtitle">Current period unique respondents by stakeholder.</p>
                <div className="chart-height">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={derived.respondentMix} dataKey="count" nameKey="name" innerRadius={70} outerRadius={112} paddingAngle={2}>
                        {derived.respondentMix.map((_, index) => (
                          <Cell key={index} fill={RESPONDER_COLORS[index % RESPONDER_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend layout="vertical" align="right" verticalAlign="middle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card">
                <h2>Responder comparison by period</h2>
                <p className="card-subtitle">Stacked unique respondent counts for Fall vs Spring.</p>
                <div className="chart-height">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={derived.respondentPeriodComparison}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Students" stackId="period" fill={RESPONDER_COLORS[0]} />
                      <Bar dataKey="Parents" stackId="period" fill={RESPONDER_COLORS[1]} />
                      <Bar dataKey="Staff" stackId="period" fill={RESPONDER_COLORS[2]} />
                      <Bar dataKey="Alumni" stackId="period" fill={RESPONDER_COLORS[3]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

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
                      <Bar dataKey={derived.selectedPeriodLabel} name={derived.selectedPeriodLabel} fill={CURRENT_COLOR} barSize={14} />
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
                      {compareEnabled && derived.previousPeriod && <Bar dataKey={comparisonKey} name={derived.previousPeriod} fill={PRIOR_COLOR} />}
                      <Bar dataKey={derived.selectedPeriodLabel} name={derived.selectedPeriodLabel} fill={CURRENT_COLOR} />
                      <Legend />
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
                      {compareEnabled && derived.previousPeriod && <Bar dataKey={comparisonKey} name={derived.previousPeriod} fill={PRIOR_COLOR} />}
                      <Bar dataKey={derived.selectedPeriodLabel} name={derived.selectedPeriodLabel} fill={CURRENT_COLOR} />
                      <Legend />
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
                <p className="card-subtitle">Summary tables show the QA average score and YoY variance. The scale is remapped so 5 is strongest positive and 1 is weakest.</p>
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
              <div className="chart-title-row">
                <div>
                  <h2>Open-ended feedback</h2>
                  <p className="card-subtitle">Directional sentiment is scored in the browser using a simple keyword heuristic. Use it as a rough filter, not a final coded sentiment model.</p>
                </div>
                <select className="inline-select" value={sentimentFilter} onChange={(event) => setSentimentFilter(event.target.value)}>
                  <option>All</option>
                  <option>Positive</option>
                  <option>Neutral</option>
                  <option>Negative</option>
                </select>
              </div>
              <div className="mix-grid sentiment-grid">
                {derived.sentimentCounts.map((item) => (
                  <div key={item.name}><strong>{item.count}</strong><span>{item.name}</span></div>
                ))}
              </div>
              <div className="feedback-table">
                <table>
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Sentiment</th>
                      <th>Score</th>
                      <th>Question</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.feedbackRows.slice(0, 250).map((row, index) => (
                      <tr key={`${row._respId}-${index}`}>
                        <td>{row._group}</td>
                        <td><span className={`sentiment-pill ${row._sentiment.label.toLowerCase()}`}>{row._sentiment.label}</span></td>
                        <td>{row._sentiment.score}</td>
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
