import Papa from 'papaparse';
import { COLS, cleanGroup, cleanIntent, periodSort } from './schema.js';

const DATA_PATHS = {
  nps: '/data/DLS_NPS_06102026.csv',
  responses: '/data/DLS_Responses_06102026.csv'
};

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseScaleValue(row, type) {
  // NPS has a real numeric Response field. The broader response file has
  // ResponseNumeric populated for NPS/Screener, but Experience and Foundations
  // store the scale in Display_Value, e.g. "1. Very Satisfied / Extremely Well".
  const directValue = type === 'nps' ? row[COLS.response] : row[COLS.responseNumeric];
  const directNumber = parseNumber(directValue);
  if (directNumber !== null) return directNumber;

  const displayValue = String(row[COLS.displayValue] || '').trim();
  const match = displayValue.match(/^(\d+(?:\.\d+)?)\s*[.)-]?/);
  if (!match) return null;
  return parseNumber(match[1]);
}

function normalizeRows(rows, type) {
  return rows
    .filter((row) => row && Object.keys(row).length > 1)
    .map((row) => ({
      ...row,
      _id: row[COLS.id],
      _respId: row[COLS.respId],
      _period: row[COLS.period],
      _group: cleanGroup(row[COLS.group]),
      _category: row[COLS.category],
      _intentRaw: row[COLS.intent],
      _intent: cleanIntent(row[COLS.intent]),
      _order: parseNumber(row[COLS.order]),
      _score: parseScaleValue(row, type)
    }));
}

function parseCsv(url, type) {
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
        resolve(normalizeRows(result.data, type));
      },
      error: reject
    });
  });
}

export async function loadSurveyData() {
  const [nps, responses] = await Promise.all([
    parseCsv(DATA_PATHS.nps, 'nps'),
    parseCsv(DATA_PATHS.responses, 'responses')
  ]);

  const periods = Array.from(new Set([...nps, ...responses].map((d) => d._period).filter(Boolean))).sort(periodSort);
  const groups = Array.from(new Set([...nps, ...responses].map((d) => d._group).filter(Boolean))).sort();
  const intents = Array.from(new Set(nps.map((d) => d._intent).filter(Boolean)));

  return { nps, responses, periods, groups, intents };
}

export function filterRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.period && row._period !== filters.period) return false;
    if (filters.group && filters.group !== 'All Groups' && row._group !== filters.group) return false;
    return true;
  });
}

export function uniqueCount(rows, key = '_respId') {
  return new Set(rows.map((d) => d[key]).filter(Boolean)).size;
}

export function calculateNPS(rows) {
  const scored = rows.filter((d) => d._score !== null && d._score !== undefined);
  const total = scored.length;
  if (!total) return null;
  const promoters = scored.filter((d) => d._score >= 9).length;
  const detractors = scored.filter((d) => d._score <= 6).length;
  return Number((((promoters / total) * 100) - ((detractors / total) * 100)).toFixed(1));
}

export function npsDistribution(rows) {
  const scored = rows.filter((d) => d._score !== null && d._score !== undefined);
  const total = scored.length || 1;
  const promoters = scored.filter((d) => d._score >= 9).length;
  const passives = scored.filter((d) => d._score >= 7 && d._score <= 8).length;
  const detractors = scored.filter((d) => d._score <= 6).length;
  return {
    promoters,
    passives,
    detractors,
    promoterPct: Number(((promoters / total) * 100).toFixed(1)),
    passivePct: Number(((passives / total) * 100).toFixed(1)),
    detractorPct: Number(((detractors / total) * 100).toFixed(1))
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
