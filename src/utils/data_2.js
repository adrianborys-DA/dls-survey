import Papa from 'papaparse';
import { COLS, cleanGroup, cleanIntent, periodSort } from './schema.js';

const DATA_PATHS = {
  responses: '/data/DLS_Responses_06102026.csv'
};

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseDisplayScale(row) {
  const displayValue = String(row[COLS.displayValue] || '').trim();
  const match = displayValue.match(/^(\d+(?:\.\d+)?)\s*[.)-]?/);
  if (!match) return null;
  return parseNumber(match[1]);
}

function parseScaleValue(row) {
  const directNumber = parseNumber(row[COLS.responseNumeric]);
  if (directNumber !== null) return directNumber;
  return parseDisplayScale(row);
}

function positiveScore(row, rawScore) {
  if (rawScore === null || rawScore === undefined) return null;
  if (row[COLS.category] === 'Experience' || row[COLS.category] === 'Foundations') {
    // Display_Value is stored as 1 = strongest positive and 5 = weakest.
    // The dashboard summary score needs the QA convention: 5 = strongest positive, 1 = weakest.
    return 6 - Number(rawScore);
  }
  return Number(rawScore);
}

function normalizeRows(rows) {
  return rows
    .filter((row) => row && Object.keys(row).length > 1)
    .map((row) => {
      const rawScore = parseScaleValue(row);
      return {
        ...row,
        _id: row[COLS.id],
        _respId: row[COLS.respId],
        _period: row[COLS.period],
        _group: cleanGroup(row[COLS.group]),
        _category: row[COLS.category],
        _intentRaw: row[COLS.intent],
        _intent: cleanIntent(row[COLS.intent]),
        _order: parseNumber(row[COLS.order]),
        _score: rawScore,
        _positiveScore: positiveScore(row, rawScore)
      };
    });
}

function parseCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (result) => {
        if (result.errors?.length) {
          console.warn(`CSV parse warnings for ${url}`, result.errors);
        }
        resolve(normalizeRows(result.data));
      },
      error: reject
    });
  });
}

export async function loadSurveyData() {
  const responses = await parseCsv(DATA_PATHS.responses);
  const nps = responses.filter((d) => d._category === 'NPS');
  const periods = Array.from(new Set(responses.map((d) => d._period).filter(Boolean))).sort(periodSort);
  const groups = Array.from(new Set(responses.map((d) => d._group).filter(Boolean))).sort();
  const intents = Array.from(new Set(nps.map((d) => d._intent).filter(Boolean)));

  return { nps, responses, periods, groups, intents };
}

export function filterRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.period && row._period !== filters.period) return false;
    if (filters.group && filters.group !== 'All Groups') {
      if (filters.group === 'Staff') {
        if (row._group !== 'Staff' && row._group !== 'Teaching Faculty') return false;
      } else if (row._group !== filters.group) return false;
    }
    return true;
  });
}

export function uniqueCount(rows, key = '_respId') {
  return new Set(rows.map((d) => d[key]).filter(Boolean)).size;
}

export function calculateNPSStats(rows) {
  const scored = rows.filter((d) => d._positiveScore !== null && d._positiveScore !== undefined && Number.isFinite(Number(d._positiveScore)));
  const total = scored.length;
  if (!total) {
    return {
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
      nps: null
    };
  }

  const promoters = scored.filter((d) => Number(d._positiveScore) >= 9).length;
  const passives = scored.filter((d) => Number(d._positiveScore) >= 7 && Number(d._positiveScore) <= 8).length;
  const detractors = scored.filter((d) => Number(d._positiveScore) <= 6).length;
  const promoterPct = Number(((promoters / total) * 100).toFixed(1));
  const passivePct = Number(((passives / total) * 100).toFixed(1));
  const detractorPct = Number(((detractors / total) * 100).toFixed(1));
  const nps = Number((promoterPct - detractorPct).toFixed(1));

  return { total, promoters, passives, detractors, promoterPct, passivePct, detractorPct, nps };
}

export function calculateNPS(rows) {
  return calculateNPSStats(rows).nps;
}

export function npsDistribution(rows) {
  const stats = calculateNPSStats(rows);
  return {
    promoters: stats.promoters,
    passives: stats.passives,
    detractors: stats.detractors,
    promoterPct: stats.promoterPct,
    passivePct: stats.passivePct,
    detractorPct: stats.detractorPct,
    total: stats.total
  };
}

export function getComparablePeriod(periods, currentPeriod) {
  const index = periods.indexOf(currentPeriod);
  if (index > 0) return periods[index - 1];
  return periods.length > 1 ? periods[0] : null;
}

export function countBy(rows, getKey, valueName = 'count') {
  const map = new Map();
  rows.forEach((row) => {
    const rawKey = getKey(row);
    if (!rawKey) return;
    const keys = String(rawKey)
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean);
    keys.forEach((key) => map.set(key, (map.get(key) || 0) + 1));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, [valueName]: value }));
}

export function countRespondentsBy(rows, getKey) {
  const map = new Map();
  const seen = new Set();
  rows.forEach((row) => {
    const rawKey = getKey(row);
    if (!rawKey || !row._respId) return;
    const keys = String(rawKey)
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean);
    keys.forEach((key) => {
      const seenKey = `${row._respId}__${key}`;
      if (seen.has(seenKey)) return;
      seen.add(seenKey);
      map.set(key, (map.get(key) || 0) + 1);
    });
  });
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
}

export function tenureValue(row) {
  if (row._group === 'Student') return row[COLS.studentTenure];
  if (row._group === 'Parent') return row[COLS.parentTenure];
  if (row._group === 'Staff' || row._group === 'Teaching Faculty') return row[COLS.staffTenure];
  if (row._group === 'Alumni') return row[COLS.alumniPeriod];
  return null;
}

export function uniqueRespondentsByDemographic(rows, getKey) {
  const seen = new Set();
  const counts = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key || !row._respId) return;
    const pair = `${row._respId}__${key}`;
    if (seen.has(pair)) return;
    seen.add(pair);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
}

export function roughSentiment(text) {
  const value = String(text || '').toLowerCase();
  if (!value.trim()) return { score: 0, label: 'Neutral' };

  const positiveWords = new Set([
    'good', 'great', 'excellent', 'amazing', 'love', 'loved', 'positive', 'supportive', 'helpful', 'strong',
    'community', 'caring', 'safe', 'happy', 'proud', 'prepared', 'engaged', 'welcoming', 'balanced', 'improved'
  ]);
  const negativeWords = new Set([
    'bad', 'poor', 'weak', 'stress', 'stressed', 'stressful', 'overwhelming', 'overloaded', 'lack', 'lacking',
    'difficult', 'frustrating', 'concern', 'concerns', 'unsafe', 'unfair', 'limited', 'problem', 'issues', 'improve',
    'homework', 'workload', 'schedule', 'communication'
  ]);

  const tokens = value.split(/[^a-z]+/).filter(Boolean);
  let raw = 0;
  tokens.forEach((token) => {
    if (positiveWords.has(token)) raw += 1;
    if (negativeWords.has(token)) raw -= 1;
  });
  const normalized = tokens.length ? raw / Math.sqrt(tokens.length) : 0;
  let label = 'Neutral';
  if (normalized > 0.12) label = 'Positive';
  else if (normalized < -0.12) label = 'Negative';
  return { score: Number(normalized.toFixed(2)), label };
}
