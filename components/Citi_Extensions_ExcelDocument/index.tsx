import { useState, useCallback, useRef, useEffect } from 'react';
import { Text, Button, Input, withConfiguration } from '@pega/cosmos-react-core';
import type { PConnFieldProps } from './PConnProps';
import StyledCitiExtensionsExcelDocumentWrapper from './styles';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_COLS = 10;
const DEFAULT_ROWS = 20;
const COL_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// ─── Types ────────────────────────────────────────────────────────────────────
type NumFmt = 'general' | 'number' | 'currency' | 'percent' | 'date';

interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bg?: string;
  fontSize?: number;
  numFmt?: NumFmt;
}

interface CellData {
  raw: string;
  fmt?: CellFormat;
}

type SheetData = CellData[][];

interface Sheet {
  id: string;
  name: string;
  data: SheetData;
  colWidths: number[];
  frozenHeader: boolean;
  filters: Record<number, string>;
  sortCol: number | null;
  sortDir: 'asc' | 'desc';
}

interface WorkbookMeta {
  title: string;
  author: string;
  createdAt: string;
}

interface CitiExtensionsExcelDocumentProps extends PConnFieldProps {
  workbookTitle?: string;
  authorName?: string;
  initialRows?: number;
  initialCols?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeSheet(name: string, rows = DEFAULT_ROWS, cols = DEFAULT_COLS): Sheet {
  return {
    id: Date.now().toString() + Math.random(),
    name,
    data: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ raw: '' }))
    ),
    colWidths: Array.from({ length: cols }, () => 100),
    frozenHeader: true,
    filters: {},
    sortCol: null,
    sortDir: 'asc'
  };
}

function colLabel(i: number): string {
  if (i < 26) return COL_LETTERS[i];
  return COL_LETTERS[Math.floor(i / 26) - 1] + COL_LETTERS[i % 26];
}

function evalFormula(raw: string, sheet: SheetData): string {
  if (!raw.startsWith('=')) return raw;
  const expr = raw.slice(1).trim().toUpperCase();

  // ── Range A1:B3 → flat numeric array ──
  const rangeValues = (ref: string): number[] => {
    const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) return [];
    const c1 = m[1].charCodeAt(0) - 65;
    const r1 = parseInt(m[2]) - 1;
    const c2 = m[3].charCodeAt(0) - 65;
    const r2 = parseInt(m[4]) - 1;
    const vals: number[] = [];
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++) {
        const v = parseFloat(sheet[r]?.[c]?.raw ?? '');
        if (!isNaN(v)) vals.push(v);
      }
    return vals;
  };

  // ── Single cell ref A1 → number ──
  const cellVal = (ref: string): number => {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m) return 0;
    const c = m[1].charCodeAt(0) - 65;
    const r = parseInt(m[2]) - 1;
    return parseFloat(sheet[r]?.[c]?.raw ?? '0') || 0;
  };

  // ── Parse comma-separated args (respects nested parens) ──
  const splitArgs = (s: string): string[] => {
    const args: string[] = [];
    let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') { depth++; cur += ch; }
      else if (ch === ')') { depth--; cur += ch; }
      else if (ch === ',' && depth === 0) { args.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) args.push(cur.trim());
    return args;
  };

  // ── Resolve arg → number (range → sum, cell ref, or literal) ──
  const resolveNum = (arg: string): number => {
    if (/^[A-Z]+\d+:[A-Z]+\d+$/.test(arg)) {
      const v = rangeValues(arg);
      return v.reduce((a, b) => a + b, 0);
    }
    if (/^[A-Z]+\d+$/.test(arg)) return cellVal(arg);
    return parseFloat(arg);
  };

  // ── Resolve arg → number[] ──
  const resolveNums = (arg: string): number[] => {
    if (/^[A-Z]+\d+:[A-Z]+\d+$/.test(arg)) return rangeValues(arg);
    if (/^[A-Z]+\d+$/.test(arg)) { const v = cellVal(arg); return isNaN(v) ? [] : [v]; }
    const n = parseFloat(arg);
    return isNaN(n) ? [] : [n];
  };

  try {
    // ── Match top-level FUNCNAME(args…) ──
    const fnMatch = expr.match(/^([A-Z_]+)\((.+)\)$/s);
    if (fnMatch) {
      const [, fn, argStr] = fnMatch;
      const args = splitArgs(argStr);
      const allVals = args.flatMap(a => resolveNums(a));
      const sum = allVals.reduce((a, b) => a + b, 0);

      switch (fn) {
        // ── Aggregates ────────────────────────────────────────────────────
        case 'SUM':     return String(sum);
        case 'AVERAGE': case 'AVG': return allVals.length ? String(sum / allVals.length) : '0';
        case 'MIN':     return allVals.length ? String(Math.min(...allVals)) : '0';
        case 'MAX':     return allVals.length ? String(Math.max(...allVals)) : '0';
        case 'COUNT':   return String(allVals.length);
        case 'COUNTA':  return String(args.filter(a => a !== '').length);
        case 'PRODUCT': return String(allVals.reduce((a, b) => a * b, 1));
        case 'MEDIAN': {
          if (!allVals.length) return '0';
          const s = [...allVals].sort((a, b) => a - b);
          const m = Math.floor(s.length / 2);
          return String(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
        }
        case 'STDEV': {
          if (allVals.length < 2) return '0';
          const mean = sum / allVals.length;
          return String(Math.sqrt(allVals.reduce((a, v) => a + (v - mean) ** 2, 0) / (allVals.length - 1)));
        }
        case 'VAR': {
          if (allVals.length < 2) return '0';
          const mean2 = sum / allVals.length;
          return String(allVals.reduce((a, v) => a + (v - mean2) ** 2, 0) / (allVals.length - 1));
        }
        case 'LARGE': {
          const sorted = resolveNums(args[0]).sort((a, b) => b - a);
          return String(sorted[resolveNum(args[1]) - 1] ?? '#N/A');
        }
        case 'SMALL': {
          const sorted2 = resolveNums(args[0]).sort((a, b) => a - b);
          return String(sorted2[resolveNum(args[1]) - 1] ?? '#N/A');
        }

        // ── Arithmetic ────────────────────────────────────────────────────
        case 'ADD':      { const [a1, a2] = args.map(resolveNum); return String(a1 + a2); }
        case 'SUBTRACT':
        case 'MINUS':    { const [a1, a2] = args.map(resolveNum); return String(a1 - a2); }
        case 'MULTIPLY': return String(allVals.reduce((a, b) => a * b, 1));
        case 'DIVIDE':   { const [d1, d2] = args.map(resolveNum); return d2 === 0 ? '#DIV/0!' : String(d1 / d2); }
        case 'MOD':      { const [m1, m2] = args.map(resolveNum); return m2 === 0 ? '#DIV/0!' : String(m1 % m2); }
        case 'POWER':    { const [base, exp] = args.map(resolveNum); return String(Math.pow(base, exp)); }
        case 'QUOTIENT': { const [q1, q2] = args.map(resolveNum); return q2 === 0 ? '#DIV/0!' : String(Math.trunc(q1 / q2)); }

        // ── Rounding ──────────────────────────────────────────────────────
        case 'ROUND': {
          const [rv, dp] = args.map(resolveNum);
          return String(parseFloat(rv.toFixed(dp)));
        }
        case 'ROUNDUP': {
          const [rv, dp] = args.map(resolveNum);
          const f = Math.pow(10, dp);
          return String(Math.ceil(rv * f) / f);
        }
        case 'ROUNDDOWN': {
          const [rv, dp] = args.map(resolveNum);
          const f = Math.pow(10, dp);
          return String(Math.floor(rv * f) / f);
        }
        case 'CEILING': {
          const [cv, sig] = args.map(resolveNum);
          return sig === 0 ? '0' : String(Math.ceil(cv / sig) * sig);
        }
        case 'FLOOR': {
          const [fv, sig] = args.map(resolveNum);
          return sig === 0 ? '0' : String(Math.floor(fv / sig) * sig);
        }
        case 'MROUND': {
          const [mrv, mrs] = args.map(resolveNum);
          return mrs === 0 ? '0' : String(Math.round(mrv / mrs) * mrs);
        }
        case 'INT':   return String(Math.floor(resolveNum(args[0])));
        case 'TRUNC': return String(Math.trunc(resolveNum(args[0])));
        case 'EVEN':  { const ev = Math.ceil(resolveNum(args[0])); return String(ev % 2 === 0 ? ev : ev + 1); }
        case 'ODD':   { const ov = Math.ceil(Math.abs(resolveNum(args[0]))); const or = ov % 2 === 0 ? ov + 1 : ov; return String(resolveNum(args[0]) < 0 ? -or : or); }

        // ── Math / Numeric ────────────────────────────────────────────────
        case 'ABS':     return String(Math.abs(resolveNum(args[0])));
        case 'SIGN':    return String(Math.sign(resolveNum(args[0])));
        case 'SQRT':    { const sv = resolveNum(args[0]); return sv < 0 ? '#NUM!' : String(Math.sqrt(sv)); }
        case 'SQRTPI':  { const sv = resolveNum(args[0]); return sv < 0 ? '#NUM!' : String(Math.sqrt(sv * Math.PI)); }
        case 'EXP':     return String(Math.exp(resolveNum(args[0])));
        case 'LN':      { const lv = resolveNum(args[0]); return lv <= 0 ? '#NUM!' : String(Math.log(lv)); }
        case 'LOG10':   { const lv = resolveNum(args[0]); return lv <= 0 ? '#NUM!' : String(Math.log10(lv)); }
        case 'LOG': {
          const [lv, lb = 10] = args.map(resolveNum);
          return lv <= 0 ? '#NUM!' : String(Math.log(lv) / Math.log(lb));
        }
        case 'PI':    return String(Math.PI);
        case 'E':     return String(Math.E);
        case 'RAND':  return String(Math.random());
        case 'RANDBETWEEN': {
          const [lo, hi] = args.map(resolveNum);
          return String(Math.floor(Math.random() * (hi - lo + 1)) + lo);
        }
        case 'FACT': {
          const n = Math.floor(Math.abs(resolveNum(args[0])));
          let f = 1; for (let i = 2; i <= n; i++) f *= i;
          return String(f);
        }
        case 'COMBIN': {
          const [n, k] = args.map(a => Math.floor(resolveNum(a)));
          if (k > n || k < 0) return '#NUM!';
          let num = 1, den = 1;
          for (let i = 0; i < k; i++) { num *= (n - i); den *= (i + 1); }
          return String(num / den);
        }
        case 'PERMUT': {
          const [pn, pk] = args.map(a => Math.floor(resolveNum(a)));
          let p = 1; for (let i = 0; i < pk; i++) p *= (pn - i);
          return String(p);
        }
        case 'GCD': {
          const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b);
          return String(allVals.map(Math.abs).reduce(gcd));
        }
        case 'LCM': {
          const gcd2 = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd2(b, a % b);
          return String(allVals.reduce((a, b) => Math.abs(a * b) / gcd2(a, b)));
        }

        // ── Trigonometry ──────────────────────────────────────────────────
        case 'DEGREES': return String(resolveNum(args[0]) * (180 / Math.PI));
        case 'RADIANS': return String(resolveNum(args[0]) * (Math.PI / 180));
        case 'SIN':     return String(Math.sin(resolveNum(args[0])));
        case 'COS':     return String(Math.cos(resolveNum(args[0])));
        case 'TAN':     return String(Math.tan(resolveNum(args[0])));
        case 'ASIN':    return String(Math.asin(resolveNum(args[0])));
        case 'ACOS':    return String(Math.acos(resolveNum(args[0])));
        case 'ATAN':    return String(Math.atan(resolveNum(args[0])));
        case 'ATAN2':   { const [ay, ax] = args.map(resolveNum); return String(Math.atan2(ay, ax)); }
        case 'SINH':    return String(Math.sinh(resolveNum(args[0])));
        case 'COSH':    return String(Math.cosh(resolveNum(args[0])));
        case 'TANH':    return String(Math.tanh(resolveNum(args[0])));

        // ── Logic ─────────────────────────────────────────────────────────
        case 'IF': {
          const [condArg, thenArg, elseArg = ''] = args;
          const condResolved = condArg.replace(/([A-Z]+\d+)/g, (ref: string) => String(cellVal(ref)));
          // eslint-disable-next-line no-new-func
          const condResult = Boolean(Function('"use strict"; return (' + condResolved + ')')());
          const pick = condResult ? thenArg : elseArg;
          return pick.replace(/^"|"$/g, '');
        }
        case 'IFERROR': {
          try { const v = resolveNum(args[0]); return isNaN(v) ? (args[1]?.replace(/^"|"$/g, '') ?? '') : String(v); }
          catch { return args[1]?.replace(/^"|"$/g, '') ?? ''; }
        }
        case 'NOT':  return String(resolveNum(args[0]) ? 0 : 1);
        case 'AND':  return String(allVals.every(Boolean) ? 1 : 0);
        case 'OR':   return String(allVals.some(Boolean) ? 1 : 0);

        // ── Text ──────────────────────────────────────────────────────────
        case 'CONCATENATE':
        case 'CONCAT':  return args.map(a => a.replace(/^"|"$/g, '')).join('');
        case 'LEN':     return String(args[0].replace(/^"|"$/g, '').length);
        case 'UPPER':   return args[0].replace(/^"|"$/g, '').toUpperCase();
        case 'LOWER':   return args[0].replace(/^"|"$/g, '').toLowerCase();
        case 'TRIM':    return args[0].replace(/^"|"$/g, '').trim();
        case 'REPT': {
          const [rStr, rTimes] = args;
          return rStr.replace(/^"|"$/g, '').repeat(Math.max(0, Math.floor(resolveNum(rTimes))));
        }
        case 'LEFT':  { const [ls, ln = '1'] = args; return ls.replace(/^"|"$/g, '').slice(0, resolveNum(ln)); }
        case 'RIGHT': { const [rs, rn = '1'] = args; const s2 = rs.replace(/^"|"$/g, ''); return s2.slice(Math.max(0, s2.length - resolveNum(rn))); }
        case 'MID':   { const [ms, mst, mln] = args; return ms.replace(/^"|"$/g, '').slice(resolveNum(mst) - 1, resolveNum(mst) - 1 + resolveNum(mln)); }
        case 'TEXT':  return String(resolveNum(args[0]));
        case 'VALUE': return String(parseFloat(args[0].replace(/^"|"$/g, '').replace(/[^0-9.-]/g, '')));

        // ── Finance ───────────────────────────────────────────────────────
        case 'PMT': {
          const [rate, nper, pv] = args.map(resolveNum);
          if (rate === 0) return String(-pv / nper);
          return String(-pv * (rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1));
        }
        case 'FV': {
          const [fvRate, fvNper, fvPmt, fvPv = 0] = args.map(resolveNum);
          if (fvRate === 0) return String(-fvPv - fvPmt * fvNper);
          const factor = Math.pow(1 + fvRate, fvNper);
          return String(-fvPv * factor - fvPmt * (factor - 1) / fvRate);
        }
        case 'PV': {
          const [pvRate, pvNper, pvPmt, pvFv = 0] = args.map(resolveNum);
          if (pvRate === 0) return String(-pvPmt * pvNper - pvFv);
          const f = Math.pow(1 + pvRate, pvNper);
          return String(-(pvPmt * (f - 1) / pvRate + pvFv) / f);
        }
        case 'NPER': {
          const [rate, pmt, pv, fv = 0] = args.map(resolveNum);
          if (rate === 0) return String(-(pv + fv) / pmt);
          return String(Math.log((pmt - fv * rate) / (pmt + pv * rate)) / Math.log(1 + rate));
        }
        case 'RATE': {
          // Simple approximation: RATE(nper, pmt, pv) → use Newton-Raphson
          const [nper, pmt, pv] = args.map(resolveNum);
          let r = 0.1;
          for (let i = 0; i < 100; i++) {
            const f = Math.pow(1 + r, nper);
            const res = pv * f + pmt * (f - 1) / r;
            const dres = pv * nper * Math.pow(1 + r, nper - 1) + pmt * (nper * Math.pow(1 + r, nper - 1) * r - (f - 1)) / (r * r);
            const rNew = r - res / dres;
            if (Math.abs(rNew - r) < 1e-10) { r = rNew; break; }
            r = rNew;
          }
          return String(r);
        }
      }
    }

    // ── Arithmetic fallback — replace cell refs then eval ──
    const arith = expr.replace(/([A-Z]+)(\d+)/g, (_m: string, col: string, row: string) => {
      const c = col.charCodeAt(0) - 65;
      const r = parseInt(row) - 1;
      return sheet[r]?.[c]?.raw || '0';
    });
    // eslint-disable-next-line no-new-func
    return String(Function('"use strict"; return (' + arith + ')')());
  } catch {
    return '#ERR';
  }
}

function formatValue(raw: string, sheet: SheetData, fmt?: NumFmt): string {
  const evaluated = evalFormula(raw, sheet);
  const num = parseFloat(evaluated);
  if (isNaN(num) || !fmt || fmt === 'general') return evaluated;
  switch (fmt) {
    case 'currency': return '$' + num.toFixed(2);
    case 'percent': return (num * 100).toFixed(1) + '%';
    case 'number': return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'date': {
      const d = new Date(evaluated);
      return isNaN(d.getTime()) ? evaluated : d.toLocaleDateString();
    }
    default: return evaluated;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ToolBtn({
  title, active, disabled, onClick, children
}: { title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '3px 7px', border: '1px solid', borderRadius: 3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderColor: active ? '#1b5e20' : '#ccc',
        background: active ? '#e8f5e9' : '#fff',
        color: active ? '#1b5e20' : '#333',
        fontWeight: active ? 700 : 400,
        fontSize: '0.8rem', lineHeight: 1.4, minWidth: 26
      }}
    >
      {children}
    </button>
  );
}

function TDiv() {
  return <span style={{ width: 1, background: '#ddd', alignSelf: 'stretch', margin: '0 3px' }} />;
}

function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  const chartH = 140;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: chartH + 40, padding: '8px 12px', background: '#f9fbe7', borderTop: '1px solid #dce775', overflowX: 'auto' }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: '0.7rem', color: '#555' }}>{v}</span>
          <div style={{ width: 28, background: '#43a047', borderRadius: '3px 3px 0 0', height: Math.max(4, (v / max) * chartH) }} />
          <span style={{ fontSize: '0.68rem', color: '#777', maxWidth: 34, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function CitiExtensionsExcelDocument(props: CitiExtensionsExcelDocumentProps) {
  const {
    getPConnect,
    workbookTitle = 'Untitled Workbook',
    authorName = '',
    initialRows = DEFAULT_ROWS,
    initialCols = DEFAULT_COLS
  } = props;

  const pConn = getPConnect();
  const actions = pConn.getActionsApi();
  const stateProps = pConn.getStateProps() as { value: string };
  const propName = stateProps.value;

  const [sheets, setSheets] = useState<Sheet[]>([makeSheet('Sheet1', initialRows, initialCols)]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [meta, setMeta] = useState<WorkbookMeta>({ title: workbookTitle, author: authorName, createdAt: new Date().toLocaleDateString() });

  const [selCell, setSelCell] = useState<[number, number] | null>(null);
  const [selRange, setSelRange] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  const [editingCell, setEditingCell] = useState<[number, number] | null>(null);
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'sheet' | 'chart' | 'metadata'>('sheet');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [chartCol, setChartCol] = useState(0);
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const sheet = sheets[activeSheetIdx];

  const updateSheet = useCallback((updater: (s: Sheet) => Sheet) => {
    setSheets(prev => prev.map((s, i) => i === activeSheetIdx ? updater(s) : s));
  }, [activeSheetIdx]);

  const cellRef = (r: number, c: number) => colLabel(c) + (r + 1);

  // ── Visible rows after filter + sort ──
  const visibleRows = useCallback((): number[] => {
    let rows = Array.from({ length: sheet.data.length }, (_, i) => i);
    Object.entries(sheet.filters).forEach(([colStr, filterVal]) => {
      if (!filterVal) return;
      const col = Number(colStr);
      rows = rows.filter(r => {
        const v = formatValue(sheet.data[r][col].raw, sheet.data, sheet.data[r][col].fmt?.numFmt);
        return v.toLowerCase().includes(filterVal.toLowerCase());
      });
    });
    if (sheet.sortCol !== null) {
      const col = sheet.sortCol;
      rows.sort((a, b) => {
        const va = sheet.data[a][col]?.raw ?? '';
        const vb = sheet.data[b][col]?.raw ?? '';
        const na = parseFloat(va), nb = parseFloat(vb);
        const cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : va.localeCompare(vb);
        return sheet.sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [sheet]);

  // ── Cell editing ──
  const startEdit = (r: number, c: number) => {
    setSelCell([r, c]);
    setSelRange(null);
    setEditingCell([r, c]);
    setEditVal(sheet.data[r][c].raw);
  };

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const [r, c] = editingCell;
    updateSheet(s => {
      const data = s.data.map(row => row.map(cell => ({ ...cell })));
      data[r][c] = { ...data[r][c], raw: editVal };
      return { ...s, data };
    });
    setEditingCell(null);
  }, [editingCell, editVal, updateSheet]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingCell(null);
      if (e.key === 'Enter' && editingCell) commitEdit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commitEdit, editingCell]);

  // ── Format selected range ──
  const applyFormat = (patch: Partial<CellFormat>) => {
    if (!selRange && !selCell) return;
    const { r1, c1, r2, c2 } = selRange ?? { r1: selCell![0], c1: selCell![1], r2: selCell![0], c2: selCell![1] };
    updateSheet(s => {
      const data = s.data.map(row => row.map(cell => ({ ...cell })));
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          data[r][c] = { ...data[r][c], fmt: { ...data[r][c].fmt, ...patch } };
      return { ...s, data };
    });
  };

  // ── Row / Col operations ──
  const insertRow = () => {
    const r = selCell?.[0] ?? sheet.data.length;
    updateSheet(s => {
      const data = [...s.data];
      data.splice(r, 0, Array.from({ length: s.data[0].length }, () => ({ raw: '' })));
      return { ...s, data };
    });
  };

  const deleteRow = () => {
    if (sheet.data.length <= 1) return;
    const r = selCell?.[0] ?? sheet.data.length - 1;
    updateSheet(s => ({ ...s, data: s.data.filter((_, i) => i !== r) }));
    setSelCell(null);
  };

  const insertCol = () => {
    const c = selCell?.[1] ?? sheet.data[0].length;
    updateSheet(s => {
      const data = s.data.map(row => { const nr = [...row]; nr.splice(c, 0, { raw: '' }); return nr; });
      const colWidths = [...s.colWidths]; colWidths.splice(c, 0, 100);
      return { ...s, data, colWidths };
    });
  };

  const deleteCol = () => {
    if (sheet.data[0].length <= 1) return;
    const c = selCell?.[1] ?? sheet.data[0].length - 1;
    updateSheet(s => ({
      ...s,
      data: s.data.map(row => row.filter((_, i) => i !== c)),
      colWidths: s.colWidths.filter((_, i) => i !== c)
    }));
    setSelCell(null);
  };

  // ── Sort ──
  const sortBy = (col: number) => {
    updateSheet(s => ({
      ...s,
      sortCol: col,
      sortDir: s.sortCol === col && s.sortDir === 'asc' ? 'desc' : 'asc'
    }));
  };

  // ── Find & Replace ──
  const handleFindReplace = () => {
    if (!findText) return;
    updateSheet(s => ({
      ...s,
      data: s.data.map(row =>
        row.map(cell => ({ ...cell, raw: cell.raw.replaceAll(findText, replaceText) }))
      )
    }));
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const csv = sheet.data.map(row =>
      row.map(c => {
        const v = formatValue(c.raw, sheet.data, c.fmt?.numFmt);
        return v.includes(',') ? '"' + v + '"' : v;
      }).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = sheet.name + '.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Save to Pega ──
  const handleSave = () => {
    actions.updateFieldValue(propName, JSON.stringify({ meta, sheets }));
  };

  // ── Sheet management ──
  const addSheet = () => {
    const name = 'Sheet' + (sheets.length + 1);
    setSheets(prev => [...prev, makeSheet(name, initialRows, initialCols)]);
    setActiveSheetIdx(sheets.length);
  };

  const deleteSheet = (idx: number) => {
    if (sheets.length === 1) return;
    setSheets(prev => prev.filter((_, i) => i !== idx));
    setActiveSheetIdx(Math.max(0, idx - 1));
  };

  const commitRename = (id: string) => {
    if (!renameVal.trim()) { setRenamingSheet(null); return; }
    setSheets(prev => prev.map(s => s.id === id ? { ...s, name: renameVal.trim() } : s));
    setRenamingSheet(null);
  };

  // ── Chart data ──
  const chartData = visibleRows()
    .map(r => ({
      val: parseFloat(formatValue(sheet.data[r][chartCol]?.raw ?? '', sheet.data, sheet.data[r][chartCol]?.fmt?.numFmt)),
      label: formatValue(sheet.data[r][0]?.raw ?? '', sheet.data) || ('R' + (r + 1))
    }))
    .filter(d => !isNaN(d.val));

  const selFmt: CellFormat = selCell ? (sheet.data[selCell[0]]?.[selCell[1]]?.fmt ?? {}) : {};
  const allValues = sheet.data.flat().map(c => parseFloat(c.raw)).filter(v => !isNaN(v));
  const nonEmpty = sheet.data.flat().filter(c => c.raw !== '').length;
  const rows = visibleRows();
  const numCols = sheet.data[0]?.length ?? initialCols;

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: '0.84rem',
    borderBottom: activeTab === t ? '2px solid #1b5e20' : '2px solid transparent',
    background: 'none', fontWeight: activeTab === t ? 700 : 400,
    color: activeTab === t ? '#1b5e20' : '#555'
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <StyledCitiExtensionsExcelDocumentWrapper>
      <div style={{ border: '1px solid #c8e6c9', borderRadius: 6, overflow: 'hidden', fontFamily: 'Calibri, sans-serif', fontSize: '0.85rem' }}>

        {/* ── Header ── */}
        <div style={{ background: '#1b5e20', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#fff', fontSize: '1.1rem' }}>🟩</span>
            <input
              value={meta.title}
              onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #81c784', color: '#fff', fontWeight: 700, fontSize: '1rem', outline: 'none', width: 260 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant='secondary' onClick={exportCSV}>⬇️ CSV</Button>
            <Button variant='primary' onClick={handleSave}>💾 Save</Button>
          </div>
        </div>

        {/* ── Top Tabs ── */}
        <div style={{ background: '#fafafa', borderBottom: '1px solid #ddd', display: 'flex' }}>
          {(['sheet', 'chart', 'metadata'] as const).map(t => (
            <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
              {t === 'sheet' ? '📊 Sheet' : t === 'chart' ? '📈 Chart' : '📋 Metadata'}
            </button>
          ))}
        </div>

        {/* ══════════════ SHEET TAB ══════════════ */}
        {activeTab === 'sheet' && (
          <>
            {/* ── Toolbar ── */}
            <div style={{ padding: '5px 10px', background: '#f1f8e9', borderBottom: '1px solid #dcedc8', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#fff', border: '1px solid #ccc', borderRadius: 3, padding: '2px 7px', minWidth: 52, color: '#555' }}>
                {selCell ? cellRef(selCell[0], selCell[1]) : '—'}
              </span>
              <TDiv />

              {/* Text formatting */}
              <ToolBtn title='Bold' active={!!selFmt.bold} onClick={() => applyFormat({ bold: !selFmt.bold })}><strong>B</strong></ToolBtn>
              <ToolBtn title='Italic' active={!!selFmt.italic} onClick={() => applyFormat({ italic: !selFmt.italic })}><em>I</em></ToolBtn>
              <ToolBtn title='Underline' active={!!selFmt.underline} onClick={() => applyFormat({ underline: !selFmt.underline })}><u>U</u></ToolBtn>

              {/* Font size */}
              <select title='Font size' value={selFmt.fontSize ?? 13}
                onChange={e => applyFormat({ fontSize: Number(e.target.value) })}
                style={{ padding: '2px 4px', border: '1px solid #ccc', borderRadius: 3, fontSize: '0.78rem', width: 52 }}>
                {[10, 11, 12, 13, 14, 16, 18, 20, 24].map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Text color */}
              <label title='Text color' style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                <span style={{ fontSize: '0.78rem' }}>A</span>
                <input type='color' value={selFmt.color ?? '#000000'}
                  onChange={e => applyFormat({ color: e.target.value })}
                  style={{ width: 22, height: 22, border: 'none', padding: 0, cursor: 'pointer' }} />
              </label>

              {/* Fill color */}
              <label title='Fill color' style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                <span style={{ fontSize: '0.78rem' }}>🪣</span>
                <input type='color' value={selFmt.bg ?? '#ffffff'}
                  onChange={e => applyFormat({ bg: e.target.value })}
                  style={{ width: 22, height: 22, border: 'none', padding: 0, cursor: 'pointer' }} />
              </label>

              <TDiv />

              {/* Number format */}
              <select title='Number format' value={selFmt.numFmt ?? 'general'}
                onChange={e => applyFormat({ numFmt: e.target.value as NumFmt })}
                style={{ padding: '2px 4px', border: '1px solid #ccc', borderRadius: 3, fontSize: '0.78rem' }}>
                <option value='general'>General</option>
                <option value='number'>Number</option>
                <option value='currency'>$ Currency</option>
                <option value='percent'>% Percent</option>
                <option value='date'>Date</option>
              </select>

              <TDiv />

              {/* Row / Col ops */}
              <ToolBtn title='Insert row above selection' onClick={insertRow}>+ Row</ToolBtn>
              <ToolBtn title='Delete selected row' onClick={deleteRow}>− Row</ToolBtn>
              <ToolBtn title='Insert column left of selection' onClick={insertCol}>+ Col</ToolBtn>
              <ToolBtn title='Delete selected column' onClick={deleteCol}>− Col</ToolBtn>

              <TDiv />

              {/* Freeze header */}
              <ToolBtn title='Freeze/unfreeze header row' active={sheet.frozenHeader}
                onClick={() => updateSheet(s => ({ ...s, frozenHeader: !s.frozenHeader }))}>
                🔒 Freeze
              </ToolBtn>

              {/* Find & Replace */}
              <ToolBtn title='Find & Replace' active={showFindReplace} onClick={() => setShowFindReplace(f => !f)}>🔍 Find</ToolBtn>

              {/* Filter row toggle */}
              <ToolBtn title='Show/hide column filters' active={showFilters} onClick={() => {
                if (showFilters) {
                  // clear all filters when hiding
                  updateSheet(s => ({ ...s, filters: {} }));
                }
                setShowFilters(f => !f);
              }}>🔽 Filter</ToolBtn>
            </div>

            {/* ── Find & Replace bar ── */}
            {showFindReplace && (
              <div style={{ padding: '6px 12px', background: '#e8f5e9', borderBottom: '1px solid #a5d6a7', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Input label='Find' value={findText} onChange={(e: any) => setFindText(e.target.value)} />
                <Input label='Replace with' value={replaceText} onChange={(e: any) => setReplaceText(e.target.value)} />
                <Button variant='primary' disabled={!findText} onClick={handleFindReplace}>Replace All</Button>
                <Button variant='secondary' onClick={() => { setShowFindReplace(false); setFindText(''); setReplaceText(''); }}>Close</Button>
              </div>
            )}

            {/* ── Formula bar ── */}
            {selCell && (
              <div style={{ padding: '3px 10px', background: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#888', fontFamily: 'monospace', fontSize: '0.8rem', minWidth: 36 }}>{cellRef(selCell[0], selCell[1])}</span>
                <span style={{ color: '#bbb' }}>fx</span>
                <input
                  ref={inputRef}
                  value={editingCell ? editVal : (selCell ? sheet.data[selCell[0]][selCell[1]].raw : '')}
                  onChange={e => {
                    if (!editingCell && selCell) startEdit(selCell[0], selCell[1]);
                    setEditVal(e.target.value);
                  }}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { commitEdit(); e.preventDefault(); }
                    if (e.key === 'Escape') setEditingCell(null);
                  }}
                  style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: '0.85rem', background: 'transparent' }}
                  placeholder='Enter value or =SUM(A1:A5)'
                />
              </div>
            )}

            {/* ── Grid ── */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 420 }}>
              <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
                <thead style={{ position: sheet.frozenHeader ? 'sticky' : 'static', top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ width: 36, background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '3px 4px' }} />
                    {Array.from({ length: numCols }, (_, c) => (
                      <th key={c}
                        style={{ width: sheet.colWidths[c], background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '3px 6px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => sortBy(c)}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          {colLabel(c)}
                          {sheet.sortCol === c && <span style={{ fontSize: '0.7rem' }}>{sheet.sortDir === 'asc' ? '▲' : '▼'}</span>}
                        </span>
                      </th>
                    ))}
                  </tr>
                  {showFilters && (
                  <tr>
                    <td style={{ background: '#f1f8e9', border: '1px solid #c8e6c9' }} />
                    {Array.from({ length: numCols }, (_, c) => (
                      <td key={c} style={{ background: '#f1f8e9', border: '1px solid #c8e6c9', padding: '1px 3px' }}>
                        <input
                          placeholder='filter…'
                          value={sheet.filters[c] ?? ''}
                          onChange={e => updateSheet(s => ({ ...s, filters: { ...s.filters, [c]: e.target.value } }))}
                          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.75rem', outline: 'none' }}
                        />
                      </td>
                    ))}
                  </tr>
                  )}
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r}>
                      <td style={{ background: '#f9fbe7', border: '1px solid #e0e0e0', padding: '2px 4px', textAlign: 'center', fontSize: '0.75rem', color: '#888', userSelect: 'none' }}>{r + 1}</td>
                      {Array.from({ length: numCols }, (_, c) => {
                        const cell = sheet.data[r]?.[c] ?? { raw: '' };
                        const isEditing = editingCell?.[0] === r && editingCell?.[1] === c;
                        const isSel = selCell?.[0] === r && selCell?.[1] === c;
                        const inRange = selRange && r >= selRange.r1 && r <= selRange.r2 && c >= selRange.c1 && c <= selRange.c2;
                        const display = formatValue(cell.raw, sheet.data, cell.fmt?.numFmt);
                        return (
                          <td key={c}
                            onClick={() => startEdit(r, c)}
                            style={{
                              border: isSel ? '2px solid #1b5e20' : '1px solid #e0e0e0',
                              padding: 0,
                              background: inRange ? '#c8e6c9' : (cell.fmt?.bg ?? '#fff'),
                              minWidth: sheet.colWidths[c],
                              maxWidth: sheet.colWidths[c],
                              cursor: 'cell'
                            }}>
                            {isEditing ? (
                              <input
                                autoFocus
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { commitEdit(); startEdit(Math.min(r + 1, sheet.data.length - 1), c); e.preventDefault(); }
                                  if (e.key === 'Tab') { commitEdit(); startEdit(r, Math.min(c + 1, numCols - 1)); e.preventDefault(); }
                                  if (e.key === 'Escape') { setEditingCell(null); }
                                  if (e.key === 'ArrowUp' && !editVal) { commitEdit(); startEdit(Math.max(r - 1, 0), c); e.preventDefault(); }
                                  if (e.key === 'ArrowDown' && !editVal) { commitEdit(); startEdit(Math.min(r + 1, sheet.data.length - 1), c); e.preventDefault(); }
                                  if (e.key === 'ArrowLeft' && !editVal) { commitEdit(); startEdit(r, Math.max(c - 1, 0)); e.preventDefault(); }
                                  if (e.key === 'ArrowRight' && !editVal) { commitEdit(); startEdit(r, Math.min(c + 1, numCols - 1)); e.preventDefault(); }
                                }}
                                style={{ width: '100%', border: 'none', outline: 'none', padding: '2px 5px', fontFamily: 'monospace', fontSize: '0.82rem', background: '#fffde7', boxSizing: 'border-box' }}
                              />
                            ) : (
                              <span style={{
                                display: 'block', padding: '2px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                fontWeight: cell.fmt?.bold ? 700 : 400,
                                fontStyle: cell.fmt?.italic ? 'italic' : 'normal',
                                textDecoration: cell.fmt?.underline ? 'underline' : 'none',
                                color: cell.fmt?.color ?? '#212121',
                                fontSize: cell.fmt?.fontSize ?? 13
                              }}>{display}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Sheet Tabs ── */}
            <div style={{ background: '#e8f5e9', borderTop: '1px solid #c8e6c9', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
              {sheets.map((s, idx) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
                  {renamingSheet === s.id ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={() => commitRename(s.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setRenamingSheet(null); }}
                      style={{ width: 80, fontSize: '0.8rem', border: '1px solid #81c784', borderRadius: 3, padding: '2px 5px' }}
                    />
                  ) : (
                    <button
                      onDoubleClick={() => { setRenamingSheet(s.id); setRenameVal(s.name); }}
                      onClick={() => setActiveSheetIdx(idx)}
                      style={{
                        padding: '3px 12px', border: '1px solid', borderRadius: '3px 3px 0 0', cursor: 'pointer', fontSize: '0.8rem',
                        borderColor: idx === activeSheetIdx ? '#1b5e20' : '#bbb',
                        background: idx === activeSheetIdx ? '#fff' : '#dcedc8',
                        fontWeight: idx === activeSheetIdx ? 700 : 400,
                        color: idx === activeSheetIdx ? '#1b5e20' : '#555'
                      }}
                    >{s.name}</button>
                  )}
                  {sheets.length > 1 && (
                    <button onClick={() => deleteSheet(idx)} title='Delete sheet'
                      style={{ marginLeft: 1, background: 'none', border: 'none', color: '#e53935', cursor: 'pointer', fontSize: '0.75rem', padding: '0 3px', lineHeight: 1 }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={addSheet} title='Add sheet'
                style={{ padding: '3px 10px', border: '1px dashed #81c784', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#1b5e20' }}>＋</button>
            </div>

            {/* ── Status Bar ── */}
            <div style={{ background: '#388e3c', padding: '3px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#fff' }}>
              <span>Cells used: {nonEmpty} / {sheet.data.length * numCols} · Rows shown: {rows.length}/{sheet.data.length}</span>
              <span>
                {allValues.length > 0 && 'Sum: ' + allValues.reduce((a, b) => a + b, 0).toFixed(2) + ' · Avg: ' + (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(2) + ' · Count: ' + allValues.length}
              </span>
            </div>
          </>
        )}

        {/* ══════════════ CHART TAB ══════════════ */}
        {activeTab === 'chart' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Text variant='h3'>Bar Chart</Text>
              <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                Data column:
                <select value={chartCol} onChange={e => setChartCol(Number(e.target.value))}
                  style={{ padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.82rem' }}>
                  {Array.from({ length: numCols }, (_, c) => (
                    <option key={c} value={c}>{colLabel(c)}</option>
                  ))}
                </select>
              </label>
            </div>
            {chartData.length === 0
              ? <Text style={{ color: '#aaa' }}>No numeric data in the selected column. Enter numbers in the sheet first.</Text>
              : <BarChart values={chartData.map(d => d.val)} labels={chartData.map(d => d.label)} />
            }
          </div>
        )}

        {/* ══════════════ METADATA TAB ══════════════ */}
        {activeTab === 'metadata' && (
          <div style={{ padding: 24, maxWidth: 500 }}>
            <Text variant='h3' style={{ marginBottom: 16 }}>Workbook Properties</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input label='Workbook Title' value={meta.title} onChange={(e: any) => setMeta(m => ({ ...m, title: e.target.value }))} />
              <Input label='Author' value={meta.author} onChange={(e: any) => setMeta(m => ({ ...m, author: e.target.value }))} />
              <Input label='Created On' value={meta.createdAt} readOnly />
              <div style={{ background: '#f1f8e9', borderRadius: 4, padding: '10px 14px', fontSize: '0.85rem', color: '#555' }}>
                <div><strong>Sheets:</strong> {sheets.length}</div>
                <div><strong>Active sheet rows:</strong> {sheet.data.length}</div>
                <div><strong>Active sheet columns:</strong> {numCols}</div>
                <div><strong>Non-empty cells:</strong> {nonEmpty}</div>
                <div><strong>Numeric cells:</strong> {allValues.length}</div>
                {allValues.length > 0 && (
                  <>
                    <div><strong>Sum:</strong> {allValues.reduce((a, b) => a + b, 0).toFixed(2)}</div>
                    <div><strong>Average:</strong> {(allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(2)}</div>
                    <div><strong>Min:</strong> {Math.min(...allValues)}</div>
                    <div><strong>Max:</strong> {Math.max(...allValues)}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </StyledCitiExtensionsExcelDocumentWrapper>
  );
}

export default withConfiguration(CitiExtensionsExcelDocument);
