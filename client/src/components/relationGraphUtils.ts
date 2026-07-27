import type { GraphEdge, GraphNode, RelationGraph } from './RelationGraphEditor';

export type LayoutType = 'free' | 'tree-v' | 'tree-h' | 'radial';
export type GraphThemeId = 'indigo' | 'ocean' | 'forest' | 'sunset' | 'mono';

export interface GraphTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphTheme {
  id: GraphThemeId;
  name: string;
  canvas: string;
  grid: string;
  edge: string;
  nodeColors: string[];
}

export const GRAPH_THEMES: GraphTheme[] = [
  {
    id: 'indigo',
    name: '靛蓝',
    canvas: '#f8fafc',
    grid: '#e2e8f0',
    edge: '#64748b',
    nodeColors: ['#4f46e5', '#0891b2', '#059669', '#d97706', '#7c3aed', '#db2777'],
  },
  {
    id: 'ocean',
    name: '海洋',
    canvas: '#f0f9ff',
    grid: '#bae6fd',
    edge: '#0284c7',
    nodeColors: ['#0369a1', '#0ea5e9', '#06b6d4', '#14b8a6', '#2563eb', '#0891b2'],
  },
  {
    id: 'forest',
    name: '森绿',
    canvas: '#f0fdf4',
    grid: '#bbf7d0',
    edge: '#059669',
    nodeColors: ['#047857', '#059669', '#16a34a', '#65a30d', '#0d9488', '#15803d'],
  },
  {
    id: 'sunset',
    name: '暮光',
    canvas: '#fff7ed',
    grid: '#fed7aa',
    edge: '#ea580c',
    nodeColors: ['#c2410c', '#ea580c', '#d97706', '#dc2626', '#db2777', '#9333ea'],
  },
  {
    id: 'mono',
    name: '简约',
    canvas: '#fafafa',
    grid: '#e5e5e5',
    edge: '#737373',
    nodeColors: ['#404040', '#525252', '#737373', '#171717', '#64748b', '#334155'],
  },
];

function tid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const GRAPH_TEMPLATES: GraphTemplate[] = [
  {
    id: 'blank',
    name: '空白画布',
    description: '从零开始自由绘制',
    icon: '⬜',
    nodes: [],
    edges: [],
  },
  {
    id: 'mindmap',
    name: '思维导图',
    description: '中心主题 + 分支结构',
    icon: '🧠',
    nodes: [
      { id: 'root', x: 520, y: 280, width: 160, height: 64, text: '核心主题', color: '#4f46e5', shape: 'rounded' },
      { id: 'b1', x: 280, y: 160, width: 130, height: 52, text: '分支一', color: '#0891b2', shape: 'rounded' },
      { id: 'b2', x: 280, y: 400, width: 130, height: 52, text: '分支二', color: '#059669', shape: 'rounded' },
      { id: 'b3', x: 820, y: 160, width: 130, height: 52, text: '分支三', color: '#d97706', shape: 'rounded' },
      { id: 'b4', x: 820, y: 400, width: 130, height: 52, text: '分支四', color: '#7c3aed', shape: 'rounded' },
    ],
    edges: [
      { id: 'e1', sourceId: 'root', targetId: 'b1', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: false, color: '#64748b', label: '', curveType: 'bezier' },
      { id: 'e2', sourceId: 'root', targetId: 'b2', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: false, color: '#64748b', label: '', curveType: 'bezier' },
      { id: 'e3', sourceId: 'root', targetId: 'b3', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: false, color: '#64748b', label: '', curveType: 'bezier' },
      { id: 'e4', sourceId: 'root', targetId: 'b4', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: false, color: '#64748b', label: '', curveType: 'bezier' },
    ],
  },
  {
    id: 'characters',
    name: '人物关系',
    description: '主角与配角关系网络',
    icon: '👥',
    nodes: [
      { id: 'p1', x: 480, y: 260, width: 140, height: 60, text: '主角', color: '#4f46e5', shape: 'rounded' },
      { id: 'p2', x: 240, y: 140, width: 120, height: 52, text: '导师', color: '#0891b2', shape: 'rounded' },
      { id: 'p3', x: 240, y: 380, width: 120, height: 52, text: '挚友', color: '#059669', shape: 'rounded' },
      { id: 'p4', x: 760, y: 140, width: 120, height: 52, text: '反派', color: '#dc2626', shape: 'rounded' },
      { id: 'p5', x: 760, y: 380, width: 120, height: 52, text: '恋人', color: '#db2777', shape: 'rounded' },
    ],
    edges: [
      { id: 'c1', sourceId: 'p2', targetId: 'p1', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: true, color: '#64748b', label: '师徒', curveType: 'bezier' },
      { id: 'c2', sourceId: 'p1', targetId: 'p3', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: true, color: '#64748b', label: '挚友', curveType: 'bezier' },
      { id: 'c3', sourceId: 'p4', targetId: 'p1', lineStyle: 'dashed', lineWidth: 2, startArrow: false, endArrow: true, color: '#dc2626', label: '对立', curveType: 'bezier' },
      { id: 'c4', sourceId: 'p1', targetId: 'p5', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: true, color: '#db2777', label: '恋人', curveType: 'bezier' },
    ],
  },
  {
    id: 'factions',
    name: '势力关系',
    description: '阵营与组织对抗/联盟',
    icon: '🏛',
    nodes: [
      { id: 'f1', x: 300, y: 200, width: 130, height: 56, text: '北方联盟', color: '#2563eb', shape: 'rounded' },
      { id: 'f2', x: 300, y: 380, width: 130, height: 56, text: '南方王国', color: '#059669', shape: 'rounded' },
      { id: 'f3', x: 720, y: 290, width: 130, height: 56, text: '暗影教团', color: '#7c3aed', shape: 'rounded' },
      { id: 'f4', x: 510, y: 120, width: 120, height: 52, text: '中立商会', color: '#d97706', shape: 'circle' },
    ],
    edges: [
      { id: 'f-e1', sourceId: 'f1', targetId: 'f2', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: true, color: '#64748b', label: '贸易', curveType: 'straight' },
      { id: 'f-e2', sourceId: 'f1', targetId: 'f3', lineStyle: 'dashed', lineWidth: 2, startArrow: false, endArrow: true, color: '#dc2626', label: '战争', curveType: 'straight' },
      { id: 'f-e3', sourceId: 'f2', targetId: 'f3', lineStyle: 'dotted', lineWidth: 2, startArrow: false, endArrow: true, color: '#94a3b8', label: '渗透', curveType: 'straight' },
      { id: 'f-e4', sourceId: 'f4', targetId: 'f1', lineStyle: 'solid', lineWidth: 1.5, startArrow: false, endArrow: true, color: '#64748b', label: '合作', curveType: 'bezier' },
    ],
  },
  {
    id: 'family',
    name: '家族谱系',
    description: '血缘与辈分关系',
    icon: '🌳',
    nodes: [
      { id: 'g1', x: 480, y: 100, width: 120, height: 50, text: '祖父', color: '#64748b', shape: 'rounded' },
      { id: 'g2', x: 360, y: 220, width: 120, height: 50, text: '父亲', color: '#4f46e5', shape: 'rounded' },
      { id: 'g3', x: 600, y: 220, width: 120, height: 50, text: '叔父', color: '#0891b2', shape: 'rounded' },
      { id: 'g4', x: 480, y: 360, width: 120, height: 50, text: '我', color: '#059669', shape: 'rounded' },
    ],
    edges: [
      { id: 'g-e1', sourceId: 'g1', targetId: 'g2', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: true, color: '#64748b', label: '父子', curveType: 'straight' },
      { id: 'g-e2', sourceId: 'g1', targetId: 'g3', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: true, color: '#64748b', label: '父子', curveType: 'straight' },
      { id: 'g-e3', sourceId: 'g2', targetId: 'g4', lineStyle: 'solid', lineWidth: 2, startArrow: false, endArrow: true, color: '#64748b', label: '父子', curveType: 'straight' },
    ],
  },
];

export function cloneTemplate(templateId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const tpl = GRAPH_TEMPLATES.find(t => t.id === templateId) ?? GRAPH_TEMPLATES[0];
  const idMap = new Map<string, string>();

  const nodes = tpl.nodes.map(n => {
    const newId = tid();
    idMap.set(n.id, newId);
    return { ...n, id: newId };
  });

  const edges = tpl.edges.map(e => ({
    ...e,
    id: tid(),
    sourceId: idMap.get(e.sourceId) ?? e.sourceId,
    targetId: idMap.get(e.targetId) ?? e.targetId,
    label: e.label ?? '',
    curveType: e.curveType ?? 'bezier',
  }));

  return { nodes, edges };
}

export function migrateEdge(edge: GraphEdge): GraphEdge {
  return {
    ...edge,
    label: edge.label ?? '',
    curveType: edge.curveType ?? 'straight',
  };
}

export function migrateNode(node: GraphNode): GraphNode {
  return {
    ...node,
    shape: node.shape ?? 'rounded',
    note: node.note ?? '',
    characterId: node.characterId ?? '',
    chapterLink: node.chapterLink ?? '',
  };
}

export function migrateGraph(graph: RelationGraph): RelationGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(migrateNode),
    edges: graph.edges.map(migrateEdge),
  };
}

/** Build adjacency for layout (directed from source → target) */
function buildChildren(edges: GraphEdge[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const e of edges) {
    if (!children.has(e.sourceId)) children.set(e.sourceId, []);
    children.get(e.sourceId)!.push(e.targetId);
  }
  return children;
}

function findRoot(nodes: GraphNode[], edges: GraphEdge[]): string {
  const hasIncoming = new Set(edges.map(e => e.targetId));
  const root = nodes.find(n => !hasIncoming.has(n.id));
  return root?.id ?? nodes[0]?.id ?? '';
}

export function applyAutoLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  layout: LayoutType,
): GraphNode[] {
  if (nodes.length === 0 || layout === 'free') return nodes;

  const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]));
  const children = buildChildren(edges);
  const rootId = findRoot(nodes, edges);
  if (!rootId) return nodes;

  const H_GAP = 80;
  const V_GAP = 100;

  if (layout === 'tree-v') {
    const levels = new Map<string, number>();
    const assignLevel = (id: string, level: number) => {
      if (levels.has(id)) return;
      levels.set(id, level);
      for (const c of children.get(id) ?? []) assignLevel(c, level + 1);
    };
    assignLevel(rootId, 0);
    for (const n of nodes) {
      if (!levels.has(n.id)) levels.set(n.id, 0);
    }

    const byLevel = new Map<number, string[]>();
    for (const [id, lv] of levels) {
      if (!byLevel.has(lv)) byLevel.set(lv, []);
      byLevel.get(lv)!.push(id);
    }

    const startX = 200;
    const startY = 120;
    for (const [lv, ids] of byLevel) {
      const rowW = ids.reduce((s, id) => s + (nodeMap.get(id)?.width ?? 140), 0) + H_GAP * (ids.length - 1);
      let x = startX + Math.max(0, (800 - rowW) / 2);
      const y = startY + lv * (V_GAP + 60);
      for (const id of ids) {
        const n = nodeMap.get(id)!;
        n.x = x;
        n.y = y;
        x += n.width + H_GAP;
      }
    }
  }

  if (layout === 'tree-h') {
    const levels = new Map<string, number>();
    const assignLevel = (id: string, level: number) => {
      if (levels.has(id)) return;
      levels.set(id, level);
      for (const c of children.get(id) ?? []) assignLevel(c, level + 1);
    };
    assignLevel(rootId, 0);
    for (const n of nodes) {
      if (!levels.has(n.id)) levels.set(n.id, 0);
    }

    const byLevel = new Map<number, string[]>();
    for (const [id, lv] of levels) {
      if (!byLevel.has(lv)) byLevel.set(lv, []);
      byLevel.get(lv)!.push(id);
    }

    const startX = 120;
    const startY = 100;
    for (const [lv, ids] of byLevel) {
      const x = startX + lv * (180 + H_GAP);
      let y = startY;
      for (const id of ids) {
        const n = nodeMap.get(id)!;
        n.x = x;
        n.y = y;
        y += n.height + V_GAP;
      }
    }
  }

  if (layout === 'radial') {
    const root = nodeMap.get(rootId)!;
    root.x = 500;
    root.y = 300;

    const others = nodes.filter(n => n.id !== rootId);
    const count = others.length;
    const radius = Math.max(180, 60 + count * 28);
    others.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      const node = nodeMap.get(n.id)!;
      node.x = root.x + root.width / 2 + Math.cos(angle) * radius - node.width / 2;
      node.y = root.y + root.height / 2 + Math.sin(angle) * radius - node.height / 2;
    });
  }

  return Array.from(nodeMap.values());
}

export function applyTheme(
  nodes: GraphNode[],
  edges: GraphEdge[],
  themeId: GraphThemeId,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const theme = GRAPH_THEMES.find(t => t.id === themeId) ?? GRAPH_THEMES[0];
  return {
    nodes: nodes.map((n, i) => ({
      ...n,
      color: theme.nodeColors[i % theme.nodeColors.length],
    })),
    edges: edges.map(e => ({ ...e, color: theme.edge })),
  };
}

export function getGraphBounds(nodes: GraphNode[]): {
  minX: number; minY: number; maxX: number; maxY: number; width: number; height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function computeFitView(
  nodes: GraphNode[],
  viewportW: number,
  viewportH: number,
  padding = 80,
): { panX: number; panY: number; zoom: number } {
  const b = getGraphBounds(nodes);
  if (nodes.length === 0) return { panX: 40, panY: 40, zoom: 100 };

  const scaleX = (viewportW - padding * 2) / Math.max(b.width, 200);
  const scaleY = (viewportH - padding * 2) / Math.max(b.height, 150);
  const scale = Math.min(scaleX, scaleY, 1.5);
  const zoom = Math.max(25, Math.min(150, Math.round(scale * 100)));

  const contentW = b.width * (zoom / 100);
  const contentH = b.height * (zoom / 100);
  const panX = (viewportW - contentW) / 2 - b.minX * (zoom / 100);
  const panY = (viewportH - contentH) / 2 - b.minY * (zoom / 100);

  return { panX, panY, zoom };
}

/** Mind-map: add child node connected to selected */
export function createChildNode(
  parent: GraphNode,
  nodes: GraphNode[],
  color: string,
): { node: GraphNode; edge: GraphEdge } {
  const childCount = nodes.filter(n =>
    n.x < parent.x - 20 || n.x > parent.x + parent.width + 20,
  ).length;
  const goLeft = childCount % 2 === 0;
  const node: GraphNode = {
    id: tid(),
    x: goLeft ? parent.x - 180 : parent.x + parent.width + 40,
    y: parent.y + (childCount * 70) - 30,
    width: 130,
    height: 52,
    text: '新分支',
    color,
    shape: 'rounded',
  };
  const edge: GraphEdge = {
    id: tid(),
    sourceId: parent.id,
    targetId: node.id,
    lineStyle: 'solid',
    lineWidth: 2,
    startArrow: false,
    endArrow: false,
    color: '#64748b',
    label: '',
    curveType: 'bezier',
  };
  return { node, edge };
}

/** BFS presentation order from root, then disconnected nodes */
export function buildPresentationOrder(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  if (nodes.length === 0) return [];
  const rootId = findRoot(nodes, edges);
  const children = buildChildren(edges);
  const order: string[] = [];
  const visited = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    for (const kid of children.get(id) ?? []) queue.push(kid);
  }
  for (const n of nodes) {
    if (!visited.has(n.id)) order.push(n.id);
  }
  return order;
}

export function nodesInRect(
  nodes: GraphNode[],
  rect: { minX: number; minY: number; maxX: number; maxY: number },
): string[] {
  return nodes
    .filter(n => {
      const r = n.x + n.width;
      const b = n.y + n.height;
      return n.x < rect.maxX && r > rect.minX && n.y < rect.maxY && b > rect.minY;
    })
    .map(n => n.id);
}

export function computeFocusNode(
  node: GraphNode,
  viewportW: number,
  viewportH: number,
  targetZoom = 125,
): { panX: number; panY: number; zoom: number } {
  const scale = targetZoom / 100;
  return {
    panX: viewportW / 2 - (node.x + node.width / 2) * scale,
    panY: viewportH / 2 - (node.y + node.height / 2) * scale,
    zoom: targetZoom,
  };
}

/** Bezier path between two points */
export function bezierPath(
  x1: number, y1: number, x2: number, y2: number,
): string {
  const dx = Math.abs(x2 - x1);
  const cp = Math.max(40, dx * 0.45);
  return `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
}
