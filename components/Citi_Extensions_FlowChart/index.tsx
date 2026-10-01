import { useState, useEffect, useRef } from 'react';
import { withConfiguration } from '@pega/cosmos-react-core';
import type { PConnFieldProps } from './PConnProps';
import './create-nonce';
import StyledCitiExtensionsFlowChartWrapper from './styles';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface TreeNode {
  id: string;
  label: string;
  color?: string;
  children?: TreeNode[];
}

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
  depth: number;
}

interface CitiExtensionsFlowChartProps extends PConnFieldProps {
  title?: string;
  /** Data page name, e.g. "D_OrgChart" */
  dataPageName?: string;
  /** Field in DP response used as node ID */
  idField?: string;
  /** Field in DP response used as node label */
  labelField?: string;
  /** Field in DP response used as parent ID */
  parentField?: string;
  /** Field in DP response used as node color (optional) */
  colorField?: string;
  /** JSON string of a TreeNode — used when dataPageName is blank */
  treeData?: string;

  // ── Filter 1 (optional) ───────────────────────────────────────────────────
  filter1Label?: string;
  filter1Field?: string;
  /** text | date | select */
  filter1Type?: string;
  /** Comma-separated options when filter1Type = "select" */
  filter1Options?: string;

  // ── Filter 2 (optional) ───────────────────────────────────────────────────
  filter2Label?: string;
  filter2Field?: string;
  filter2Type?: string;
  filter2Options?: string;

  // ── Filter 3 (optional) ───────────────────────────────────────────────────
  filter3Label?: string;
  filter3Field?: string;
  filter3Type?: string;
  filter3Options?: string;

  // ── Elastic / keyword search ──────────────────────────────────────────────
  /** Label for the search box */
  searchLabel?: string;
  /** Data page parameter name for the search term */
  searchField?: string;
  /** Placeholder text inside the search box */
  searchPlaceholder?: string;
}

// ── Layout constants ───────────────────────────────────────────────────────────
const NODE_W = 200;
const NODE_H = 44;
const H_GAP  = 72;
const V_GAP  = 18;

// ── Default static tree ───────────────────────────────────────────────────────
const DEFAULT_TREE: TreeNode = {
  id: 'root', label: 'Root',
  children: [
    { id: 'a', label: 'Branch A', children: [
      { id: 'a1', label: 'Leaf A-1' },
      { id: 'a2', label: 'Leaf A-2' },
      { id: 'a3', label: 'Leaf A-3' },
    ]},
    { id: 'b', label: 'Branch B', children: [
      { id: 'b1', label: 'Sub B-1', children: [
        { id: 'b1a', label: 'Leaf B-1a' },
        { id: 'b1b', label: 'Leaf B-1b' },
      ]},
      { id: 'b2', label: 'Leaf B-2' },
    ]},
    { id: 'c', label: 'Branch C' },
  ],
};

// ── Palettes ──────────────────────────────────────────────────────────────────
const PALETTE = ['#1565c0','#1976d2','#0288d1','#0097a7','#00796b','#388e3c'];
function depthColor(depth: number, userColor?: string): string {
  return userColor ?? PALETTE[Math.min(depth, PALETTE.length - 1)];
}

const BADGE_COLORS = [
  '#e53935','#d81b60','#8e24aa','#5e35b1',
  '#1e88e5','#00897b','#43a047','#fb8c00',
  '#f4511e','#6d4c41','#00acc1','#3949ab',
];
function badgeColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length];
}

// ── Layout helpers ────────────────────────────────────────────────────────────
function subtreeRows(node: TreeNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + subtreeRows(c), 0);
}

function buildLayout(node: TreeNode, depth: number, yOffset: number, result: LayoutNode[]): void {
  const rows  = subtreeRows(node);
  const slotH = rows * (NODE_H + V_GAP) - V_GAP;
  result.push({ node, x: depth * (NODE_W + H_GAP), y: yOffset + (slotH - NODE_H) / 2, depth });
  let childY = yOffset;
  for (const child of node.children ?? []) {
    buildLayout(child, depth + 1, childY, result);
    childY += subtreeRows(child) * (NODE_H + V_GAP);
  }
}

function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`;
}

function truncate(text: string, max = 22): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function buildTreeFromFlat(
  rows: Record<string, string>[],
  idField: string, labelField: string, parentField: string, colorField?: string
): TreeNode {
  const nodeMap = new Map<string, TreeNode>();
  rows.forEach(row => nodeMap.set(row[idField], {
    id: row[idField],
    label: row[labelField] ?? row[idField],
    color: colorField ? row[colorField] : undefined,
    children: [],
  }));

  let root: TreeNode = { id: '__root__', label: 'Root', children: [] };
  nodeMap.forEach((node, id) => {
    const parentId = rows.find(r => r[idField] === id)?.[parentField];
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children!.push(node);
    } else {
      root.children!.push(node);
    }
  });
  if (root.children!.length === 1) root = root.children![0];
  return root;
}

// ── Helper: render one filter input ──────────────────────────────────────────
function FilterInput({
  label, value, type, options, onChange,
}: {
  label: string; value: string; type: string;
  options?: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 600 }}>{label}</label>
      {type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value=''>— All —</option>
          {(options ?? '').split(',').map(o => o.trim()).filter(Boolean).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
function CitiExtensionsFlowChart(props: CitiExtensionsFlowChartProps) {
  const {
    title = 'Mind Map',
    dataPageName, idField = 'id', labelField = 'label',
    parentField = 'parentId', colorField, treeData,
    filter1Label, filter1Field, filter1Type = 'text', filter1Options,
    filter2Label, filter2Field, filter2Type = 'text', filter2Options,
    filter3Label, filter3Field, filter3Type = 'text', filter3Options,
    searchLabel = 'Search', searchField, searchPlaceholder = 'Type to search…',
    getPConnect,
  } = props;

  const PConnect = getPConnect();
  const context  = PConnect.getContextName();

  // ── Filter state (stable — never recreated) ───────────────────────────────
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [f3, setF3] = useState('');
  const [search, setSearch] = useState('');

  // Refs so the useEffect always reads the latest values without re-subscribing
  const f1Ref     = useRef(f1);     f1Ref.current     = f1;
  const f2Ref     = useRef(f2);     f2Ref.current     = f2;
  const f3Ref     = useRef(f3);     f3Ref.current     = f3;
  const searchRef = useRef(search); searchRef.current = search;

  const [tree, setTree]           = useState<TreeNode>(DEFAULT_TREE);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [applyTrigger, setApply]  = useState(0);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dataPageName) {
      if (treeData) {
        try { setTree(JSON.parse(treeData)); } catch { setTree(DEFAULT_TREE); }
      }
      return;
    }

    setLoading(true);
    setError('');

    const params: Record<string, string> = {};
    if (filter1Field && f1Ref.current.trim())     params[filter1Field] = f1Ref.current.trim();
    if (filter2Field && f2Ref.current.trim())     params[filter2Field] = f2Ref.current.trim();
    if (filter3Field && f3Ref.current.trim())     params[filter3Field] = f3Ref.current.trim();
    if (searchField  && searchRef.current.trim()) params[searchField]  = searchRef.current.trim();

    PCore.getDataApiUtils()
      .getData(dataPageName, params, context)
      .then((response: any) => {
        const rows: Record<string, string>[] = response?.data?.data ?? [];
        setTree(rows.length === 0
          ? { id: 'empty', label: 'No results', children: [] }
          : buildTreeFromFlat(rows, idField, labelField, parentField, colorField));
        setLoading(false);
      })
      .catch((err: any) => {
        setError('Failed to load data.');
        setLoading(false);
        console.error('[FlowChart]', err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyTrigger]);

  const handleApply = () => setApply(t => t + 1);
  const handleClear = () => {
    f1Ref.current = ''; f2Ref.current = ''; f3Ref.current = ''; searchRef.current = '';
    setF1(''); setF2(''); setF3(''); setSearch('');
    setApply(t => t + 1);
  };

  // Are any optional filters visible?
  const hasFilters = !!(filter1Field || filter2Field || filter3Field || searchField);

  // ── Collapse ──────────────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  function pruneTree(node: TreeNode): TreeNode {
    if (collapsed.has(node.id)) return { ...node, children: [] };
    return { ...node, children: (node.children ?? []).map(pruneTree) };
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  const visibleTree  = pruneTree(tree);
  const layoutNodes: LayoutNode[] = [];
  buildLayout(visibleTree, 0, 0, layoutNodes);
  const nodeMap = new Map<string, LayoutNode>();
  layoutNodes.forEach(ln => nodeMap.set(ln.node.id, ln));

  const PAD = 24;
  const maxDepth  = Math.max(...layoutNodes.map(ln => ln.depth));
  const totalRows = subtreeRows(visibleTree);
  const svgW = (maxDepth + 1) * (NODE_W + H_GAP) - H_GAP + PAD * 2;
  const svgH = totalRows * (NODE_H + V_GAP) - V_GAP + PAD * 2;

  const edges: Array<{ from: LayoutNode; to: LayoutNode }> = [];
  function collectEdges(node: TreeNode) {
    const fromLN = nodeMap.get(node.id);
    if (!fromLN) return;
    for (const child of node.children ?? []) {
      const toLN = nodeMap.get(child.id);
      if (toLN) edges.push({ from: fromLN, to: toLN });
      collectEdges(child);
    }
  }
  collectEdges(visibleTree);

  const origMap = new Map<string, TreeNode>();
  function buildOrigMap(n: TreeNode) {
    origMap.set(n.id, n);
    (n.children ?? []).forEach(buildOrigMap);
  }
  buildOrigMap(tree);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <StyledCitiExtensionsFlowChartWrapper>
      <div style={{ fontFamily: 'sans-serif', padding: '16px 20px', background: '#fff' }}>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: '1.2rem' }}>🗺</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#222' }}>{title}</span>
          <span style={{ fontSize: '0.78rem', color: '#aaa', marginLeft: 4 }}>
            Click a node with children to collapse / expand
          </span>
        </div>

        {/* Filter bar */}
        {hasFilters && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
            padding: '12px 16px', marginBottom: 14,
            background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 8,
          }}>
            {/* Elastic search — shown first, full-width feel */}
            {searchField && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px', maxWidth: 340 }}>
                <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 600 }}>
                  🔍 {searchLabel}
                </label>
                <input
                  type='text'
                  value={search}
                  placeholder={searchPlaceholder}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleApply()}
                  style={{ ...inputStyle, borderColor: '#1565c0' }}
                />
              </div>
            )}

            {/* Optional filter 1 */}
            {filter1Field && filter1Label && (
              <FilterInput label={filter1Label} value={f1} type={filter1Type}
                options={filter1Options} onChange={setF1} />
            )}

            {/* Optional filter 2 */}
            {filter2Field && filter2Label && (
              <FilterInput label={filter2Label} value={f2} type={filter2Type}
                options={filter2Options} onChange={setF2} />
            )}

            {/* Optional filter 3 */}
            {filter3Field && filter3Label && (
              <FilterInput label={filter3Label} value={f3} type={filter3Type}
                options={filter3Options} onChange={setF3} />
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button onClick={handleApply} style={applyBtnStyle} disabled={loading}>
                {loading ? '⏳' : '🔍'} Apply
              </button>
              <button onClick={handleClear} style={clearBtnStyle} disabled={loading}>
                ✕ Clear
              </button>
            </div>
          </div>
        )}

        {error && <div style={{ color: '#c62828', fontSize: '0.85rem', marginBottom: 10 }}>⚠ {error}</div>}

        {/* Diagram */}
        <div style={{
          overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh',
          border: '1px solid #e0e0e0', borderRadius: 8, background: '#fff', position: 'relative',
        }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.80)', zIndex: 10,
              fontSize: '0.9rem', color: '#888',
            }}>⏳ Loading chart…</div>
          )}

          <svg width={svgW} height={svgH} style={{ display: 'block' }}>
            <defs>
              <filter id='node-shadow' x='-20%' y='-40%' width='140%' height='180%'>
                <feDropShadow dx='0' dy='1' stdDeviation='2' floodColor='rgba(0,0,0,0.10)' />
              </filter>
            </defs>
            <g transform={`translate(${PAD}, ${PAD})`}>
              {edges.map(({ from, to }) => {
                const x1 = from.x + NODE_W, y1 = from.y + NODE_H / 2;
                const x2 = to.x,           y2 = to.y + NODE_H / 2;
                return (
                  <path key={`${from.node.id}→${to.node.id}`}
                    d={elbowPath(x1, y1, x2, y2)}
                    fill='none' stroke='#222' strokeWidth={1.5} strokeLinecap='round' />
                );
              })}

              {layoutNodes.map(ln => {
                const isRoot      = ln.depth === 0;
                const hasChildren = (origMap.get(ln.node.id)?.children?.length ?? 0) > 0;
                const isCollapsed = collapsed.has(ln.node.id);
                const rx          = isRoot ? 22 : 8;
                return (
                  <g key={ln.node.id} transform={`translate(${ln.x}, ${ln.y})`}
                    style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                    onClick={() => hasChildren && toggle(ln.node.id)}>
                    <rect width={NODE_W} height={NODE_H} rx={rx} ry={rx}
                      fill='#fff' stroke={depthColor(ln.depth, ln.node.color)}
                      strokeWidth={isRoot ? 2.5 : 1.5}
                      filter='url(#node-shadow)' opacity={isCollapsed ? 0.55 : 1} />
                    <text x={NODE_W / 2} y={NODE_H / 2}
                      textAnchor='middle' dominantBaseline='central'
                      fill='#111' fontSize={isRoot ? 13 : 12}
                      fontWeight={isRoot ? 700 : 400} fontFamily='sans-serif'
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      {truncate(ln.node.label)}
                    </text>
                    {hasChildren && (
                      <g transform={`translate(${NODE_W - 14}, ${NODE_H / 2 - 8})`}>
                        <circle cx={8} cy={8} r={8} fill={badgeColor(ln.node.id)} />
                        <text x={8} y={8} textAnchor='middle' dominantBaseline='central'
                          fontSize={11} fontWeight={700} fill='#fff' fontFamily='sans-serif'
                          style={{ userSelect: 'none', pointerEvents: 'none' }}>
                          {isCollapsed ? '+' : '−'}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#888', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {PALETTE.map((c, i) => (
            <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block' }} />
              {i === 0 ? 'Root' : `Depth ${i}`}
            </span>
          ))}
        </div>
      </div>
    </StyledCitiExtensionsFlowChartWrapper>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: '5px 8px', fontSize: '0.82rem',
  border: '1px solid #ccc', borderRadius: 5,
  outline: 'none', background: '#fff', color: '#222', minWidth: 140,
};
const applyBtnStyle: React.CSSProperties = {
  padding: '6px 18px', fontSize: '0.82rem', fontWeight: 600,
  background: '#1565c0', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer',
};
const clearBtnStyle: React.CSSProperties = {
  padding: '6px 14px', fontSize: '0.82rem',
  background: '#fff', color: '#555', border: '1px solid #ccc', borderRadius: 5, cursor: 'pointer',
};

export default withConfiguration(CitiExtensionsFlowChart);
