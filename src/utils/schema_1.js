export const COLS = {
  id: 'ID',
  respId: 'RESP_ID',
  period: 'Survey_Period',
  group: 'Which group best describes you?',
  category: 'Category',
  intent: 'Question Intent',
  attribute: 'Attribute',
  response: 'Response',
  responseNumeric: 'ResponseNumeric',
  displayValue: 'Display_Value',
  value: 'Value',
  order: 'Order',
  studentGrade: 'Which grade are you currently in? (required)',
  studentTenure: 'How long have you attended De La Salle College?',
  studentExtra: 'Do you participate in any extracurricular activities?',
  parentGrades: 'Please select the grade(s) your child(ren) are in',
  parentTenure: 'How long has your child (or oldest child) attended De La Salle College?',
  parentInvolvement: 'How would you describe your involvement with the College community?',
  staffGrades: 'What grade levels do you currently teach?',
  staffTenure: 'How long have you been working at De La Salle College?',
  alumniPeriod: 'When did you attend or graduate from De La Salle College?'
};

export const REQUIRED_NPS_COLUMNS = [COLS.respId, COLS.period, COLS.group, COLS.intent, COLS.response];
export const REQUIRED_RESPONSE_COLUMNS = [COLS.respId, COLS.period, COLS.group, COLS.category, COLS.intent, COLS.displayValue];

export function cleanGroup(group) {
  if (group === 'Staff member') return 'Staff';
  if (group === 'Teaching Faculty') return 'Teaching Faculty';
  return group || 'Unknown';
}

export function cleanIntent(intent) {
  return String(intent || '').replace(/^\d+\.\s*/, '').replace(' of Education', '').trim();
}

export function periodSort(a, b) {
  const rank = { Fall: 1, Winter: 2, Spring: 3, Summer: 4 };
  const parse = (p) => {
    const [season, year] = String(p).split('_');
    return [Number(year) || 0, rank[season] || 0];
  };
  const [ay, as] = parse(a);
  const [by, bs] = parse(b);
  return ay === by ? as - bs : ay - by;
}
