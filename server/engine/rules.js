function toObjects({ columns, rows }) {
  return rows.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

// A number, or a string that is a number ("7" from a form field). Anything else -> NaN.
function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return NaN;
}

// Compare as numbers when both sides are numbers, otherwise as text.
// Text works for ISO dates too: '2026-10-25' < '2026-11-05'.
function compare(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

const OPS = {
  '>': (c) => c > 0,
  '>=': (c) => c >= 0,
  '<': (c) => c < 0,
  '<=': (c) => c <= 0,
  '=': (c) => c === 0,
  '!=': (c) => c !== 0,
};

// true if the row passes every condition. A column missing from the row never matches.
function matches(row, conditions = []) {
  return conditions.every(({ column, op, value }) => {
    const test = OPS[op];
    if (!test) throw new Error(`Unknown rule operator "${op}"`);
    if (row[column] === undefined || row[column] === null) return false;
    return test(compare(row[column], value));
  });
}

module.exports = { toObjects, matches };
