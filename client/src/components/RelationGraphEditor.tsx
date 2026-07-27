import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Square, Triangle, Circle, Network, Minus, Plus, RotateCcw, X, MousePointer, Link2, Trash2, Maximize2, Save, Eye, Check, Box, LayoutTemplate, Wand2, Palette, Download, Focus, Undo2, Redo2, Presentation, StickyNote, User, ChevronLeft, ChevronRight } from 'lucide-react';
import GraphMinimap from './GraphMinimap';
import {
  GRAPH_TEMPLATES,
  GRAPH_THEMES,
  cloneTemplate,
  applyAutoLayout,
  applyTheme,
  computeFitView,
  computeFocusNode,
  createChildNode,
  bezierPath,
  migrateGraph,
  buildPresentationOrder,
  nodesInRect,
  type LayoutType,
  type GraphThemeId,
} from './relationGraphUtils';

const CHARACTERS_KEY = 'slate_characters';

/* ── Types ── */

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  shape?: NodeShape;
  note?: string;
  characterId?: string;
  chapterLink?: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  lineWidth: number;
  startArrow: boolean;
  endArrow: boolean;
  color: string;
  label?: string;
  curveType?: 'straight' | 'bezier';
}

export interface RelationGraph {
  id: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: string;
  updatedAt: string;
}

interface RelationGraphEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (graph: RelationGraph) => void;
  initialGraph?: RelationGraph | null;
  mode?: 'create' | 'edit' | 'view';
  templateId?: string;
  chapterTitle?: string;
}

type Tool = 'select' | 'addNode' | 'connect';

const NODE_DEFAULTS = {
  width: 140,
  height: 60,
  color: '#4f46e5',
};

const NODE_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#2563eb', '#9333ea', '#0d9488',
];

type NodeShape = 'rounded' | 'triangle' | 'circle';

const SHAPE_META: { key: NodeShape; icon: React.ReactNode; label: string }[] = [
  { key: 'rounded', icon: <Square size={14} />, label: '圆角矩形' },
  { key: 'triangle', icon: <Triangle size={14} />, label: '三角形' },
  { key: 'circle', icon: <Circle size={14} />, label: '圆形' },
];

const ARROW_SIZE = 10;

/* ── Helpers ── */

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Calculate where a connection line meets a node's border */
function getEdgeAnchor(
  node: GraphNode,
  targetX: number,
  targetY: number,
): { x: number; y: number } {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  const rx = node.width / 2 + 4;
  const ry = node.height / 2 + 4;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx + rx, y: cy };
  }

  const angle = Math.atan2(dy, dx);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Intersect with ellipse (rounded rect approx)
  const t = Math.sqrt(
    (rx * rx * ry * ry) /
      (ry * ry * cosA * cosA + rx * rx * sinA * sinA),
  );

  return {
    x: cx + t * cosA,
    y: cy + t * sinA,
  };
}

/* ═════════════════════════════════════════════
   Component
   ═════════════════════════════════════════════ */

const RelationGraphEditor: React.FC<RelationGraphEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialGraph,
  mode = 'create',
  templateId = 'blank',
  chapterTitle = '',
}) => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const historyRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }[]>([]);
  const historyIdxRef = useRef(0);
  const isRestoringRef = useRef(false);
  const dragMovedRef = useRef(false);

  /* ── State ── */
  const [graphName, setGraphName] = useState('');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [nodeColor, setNodeColor] = useState(NODE_COLORS[0]);
  const [nodeShape, setNodeShape] = useState<NodeShape>('rounded');
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [activeTheme, setActiveTheme] = useState<GraphThemeId>('indigo');
  const [canvasTheme, setCanvasTheme] = useState(GRAPH_THEMES[0]);

  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const selectedNodeId = selectedNodeIds.length ? selectedNodeIds[selectedNodeIds.length - 1] : null;
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Undo / redo
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Box select
  const boxSelectRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Presentation mode
  const [presentMode, setPresentMode] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const presentOrder = useMemo(() => buildPresentationOrder(nodes, edges), [nodes, edges]);
  const presentFocusId = presentMode && presentOrder.length ? presentOrder[presentIndex] : null;

  // Characters for linking
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>([]);

  // Viewport size for minimap
  const [viewportSize, setViewportSize] = useState({ w: 800, h: 600 });

  // Edge property panel state
  const [edgePanelEdge, setEdgePanelEdge] = useState<GraphEdge | null>(null);

  // Text editing
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Connect mode: first selected node
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  // Snap-to-align state
  const [snapLines, setSnapLines] = useState<{ orientation: 'h' | 'v'; pos: number; start: number; end: number }[]>([]);
  const SNAP_THRESHOLD = 5; // pixels in workspace coordinates

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(100);
  const panningRef = useRef({ isPanning: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 });

  // Drag node state (supports multi-select)
  const draggingRef = useRef<{
    nodeIds: string[];
    startX: number;
    startY: number;
    starts: Record<string, { x: number; y: number }>;
  }>({ nodeIds: [], startX: 0, startY: 0, starts: {} });

  // Resize state
  const resizingRef = useRef<{
    nodeId: string | null;
    handle: string | null;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startNX: number;
    startNY: number;
  }>({ nodeId: null, handle: null, startX: 0, startY: 0, startW: 0, startH: 0, startNX: 0, startNY: 0 });

  const ZOOM_STEPS = [25, 50, 67, 75, 100, 125, 150, 200, 300];
  const ZOOM_MIN = 25;
  const ZOOM_MAX = 300;

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const resetHistory = useCallback((initialNodes: GraphNode[], initialEdges: GraphEdge[]) => {
    historyRef.current = [{
      nodes: structuredClone(initialNodes),
      edges: structuredClone(initialEdges),
    }];
    historyIdxRef.current = 0;
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  const recordHistory = useCallback((nextNodes: GraphNode[], nextEdges: GraphEdge[]) => {
    if (isRestoringRef.current) return;
    const snapshot = { nodes: structuredClone(nextNodes), edges: structuredClone(nextEdges) };
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 60) {
      historyRef.current.shift();
    } else {
      historyIdxRef.current++;
    }
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const snap = historyRef.current[historyIdxRef.current];
    isRestoringRef.current = true;
    setNodes(structuredClone(snap.nodes));
    setEdges(structuredClone(snap.edges));
    isRestoringRef.current = false;
    syncHistoryButtons();
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEdgePanelEdge(null);
  }, [syncHistoryButtons]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const snap = historyRef.current[historyIdxRef.current];
    isRestoringRef.current = true;
    setNodes(structuredClone(snap.nodes));
    setEdges(structuredClone(snap.edges));
    isRestoringRef.current = false;
    syncHistoryButtons();
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEdgePanelEdge(null);
  }, [syncHistoryButtons]);

  const updateNodeProperty = useCallback((nodeId: string, patch: Partial<GraphNode>, record = true) => {
    setNodes(prev => {
      const next = prev.map(n => (n.id === nodeId ? { ...n, ...patch } : n));
      if (record) recordHistory(next, edgesRef.current);
      return next;
    });
  }, [recordHistory]);

  /* ── Init ── */
  useEffect(() => {
    if (!isOpen) return;
    let initNodes: GraphNode[] = [];
    let initEdges: GraphEdge[] = [];
    if (initialGraph && (mode === 'edit' || mode === 'view')) {
      const migrated = migrateGraph(initialGraph);
      setGraphName(migrated.name);
      initNodes = migrated.nodes;
      initEdges = migrated.edges;
      setNodes(initNodes);
      setEdges(initEdges);
      setShowTemplatePicker(false);
    } else {
      setGraphName('');
      if (templateId && templateId !== 'blank') {
        const { nodes: tn, edges: te } = cloneTemplate(templateId);
        initNodes = tn;
        initEdges = te;
        setNodes(initNodes);
        setEdges(initEdges);
        setShowTemplatePicker(false);
      } else {
        initNodes = [];
        initEdges = [];
        setNodes([]);
        setEdges([]);
        setShowTemplatePicker(mode === 'create');
      }
    }
    resetHistory(initNodes, initEdges);
    setTool(mode === 'view' ? 'select' : 'select');
    setNodeColor(NODE_COLORS[0]);
    setNodeShape('rounded');
    setShapeMenuOpen(false);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEdgePanelEdge(null);
    setEditingNodeId(null);
    setConnectSourceId(null);
    setSaveDialogOpen(false);
    setPan({ x: 0, y: 0 });
    setZoom(100);
    setActiveTheme('indigo');
    setCanvasTheme(GRAPH_THEMES[0]);
    setPresentMode(false);
    setPresentIndex(0);
    setSelectionBox(null);
    boxSelectRef.current = null;
    try {
      const saved = localStorage.getItem(CHARACTERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { id: string; name: string }[];
        setCharacters(parsed.map(c => ({ id: c.id, name: c.name })));
      } else {
        setCharacters([]);
      }
    } catch {
      setCharacters([]);
    }
  }, [isOpen, initialGraph, mode, templateId, resetHistory]);

  useEffect(() => {
    if (!isOpen) return;
    const el = workspaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [isOpen]);

  /* ── Desktop-only guard ── */
  const isViewMode = mode === 'view';

  /* ── Zoom helpers ── */
  const zoomIn = () => setZoom(z => { const n = ZOOM_STEPS.find(s => s > z); return n ?? ZOOM_MAX; });
  const zoomOut = () => setZoom(z => { const rev = [...ZOOM_STEPS].reverse(); const n = rev.find(s => s < z); return n ?? ZOOM_MIN; });
  const zoomReset = () => setZoom(100);

  const fitToContent = useCallback(() => {
    const wrap = workspaceRef.current;
    if (!wrap) return;
    const { panX, panY, zoom: z } = computeFitView(nodes, wrap.clientWidth, wrap.clientHeight);
    setPan({ x: panX, y: panY });
    setZoom(z);
  }, [nodes]);

  const handleApplyLayout = (layout: LayoutType) => {
    const next = applyAutoLayout(nodes, edges, layout);
    setNodes(next);
    recordHistory(next, edges);
  };

  const handleApplyTheme = (themeId: GraphThemeId) => {
    const theme = GRAPH_THEMES.find(t => t.id === themeId) ?? GRAPH_THEMES[0];
    setActiveTheme(themeId);
    setCanvasTheme(theme);
    const applied = applyTheme(nodes, edges, themeId);
    setNodes(applied.nodes);
    setEdges(applied.edges);
    recordHistory(applied.nodes, applied.edges);
  };

  const handleLoadTemplate = (id: string) => {
    const { nodes: tn, edges: te } = cloneTemplate(id);
    setNodes(tn);
    setEdges(te);
    resetHistory(tn, te);
    setShowTemplatePicker(false);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEdgePanelEdge(null);
    setTimeout(() => fitToContent(), 50);
  };

  const handleAddChildNode = useCallback(() => {
    if (!selectedNodeId || mode === 'view') return;
    const parent = nodes.find(n => n.id === selectedNodeId);
    if (!parent) return;
    const { node, edge } = createChildNode(parent, nodes, nodeColor);
    const nextNodes = [...nodes, node];
    const nextEdges = [...edges, edge];
    setNodes(nextNodes);
    setEdges(nextEdges);
    recordHistory(nextNodes, nextEdges);
    setSelectedNodeIds([node.id]);
    setEditingNodeId(node.id);
    setEditText(node.text);
  }, [selectedNodeId, mode, nodes, edges, nodeColor, recordHistory]);

  const startPresentation = () => {
    if (nodes.length === 0) return;
    setPresentMode(true);
    setPresentIndex(0);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEdgePanelEdge(null);
  };

  const exitPresentation = () => {
    setPresentMode(false);
    setPresentIndex(0);
  };

  const focusPresentNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const wrap = workspaceRef.current;
    if (!node || !wrap) return;
    const { panX, panY, zoom: z } = computeFocusNode(node, wrap.clientWidth, wrap.clientHeight);
    setPan({ x: panX, y: panY });
    setZoom(z);
  }, [nodes]);

  useEffect(() => {
    if (presentMode && presentFocusId) {
      focusPresentNode(presentFocusId);
    }
  }, [presentMode, presentFocusId, presentIndex, focusPresentNode]);

  const handleExportPng = useCallback(() => {
    const wrap = workspaceRef.current;
    if (!wrap) return;
    const scale = 2;
    const b = nodes.length
      ? (() => {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const n of nodes) {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
          }
          return { minX: minX - 40, minY: minY - 40, maxX: maxX + 40, maxY: maxY + 40 };
        })()
      : { minX: 0, minY: 0, maxX: 800, maxY: 600 };

    const w = Math.ceil(b.maxX - b.minX);
    const h = Math.ceil(b.maxY - b.minY);
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.fillStyle = canvasTheme.canvas;
    ctx.fillRect(0, 0, w, h);

    const tx = (x: number) => x - b.minX;
    const ty = (y: number) => y - b.minY;

    for (const edge of edges) {
      const s = nodes.find(n => n.id === edge.sourceId);
      const t = nodes.find(n => n.id === edge.targetId);
      if (!s || !t) continue;
      const sx = tx(s.x + s.width / 2);
      const sy = ty(s.y + s.height / 2);
      const ex = tx(t.x + t.width / 2);
      const ey = ty(t.y + t.height / 2);
      ctx.strokeStyle = edge.color;
      ctx.lineWidth = edge.lineWidth;
      ctx.beginPath();
      if (edge.curveType === 'bezier') {
        const dx = Math.abs(ex - sx);
        const cp = Math.max(40, dx * 0.45);
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + cp, sy, ex - cp, ey, ex, ey);
      } else {
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      if (edge.label) {
        ctx.fillStyle = '#475569';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(edge.label, (sx + ex) / 2, (sy + ey) / 2 - 6);
      }
    }

    for (const n of nodes) {
      const nx = tx(n.x);
      const ny = ty(n.y);
      ctx.fillStyle = n.color;
      const r = 8;
      ctx.beginPath();
      ctx.roundRect(nx, ny, n.width, n.height, r);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = (n.text || '').slice(0, 24);
      ctx.fillText(lines, nx + n.width / 2, ny + n.height / 2);
    }

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${graphName.trim() || '关系图谱'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [nodes, edges, graphName, canvasTheme]);

  /* ── Coordinate transforms ── */
  const screenToWorkspace = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const el = workspaceRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const scale = zoom / 100;
      return {
        x: (clientX - rect.left - pan.x) / scale,
        y: (clientY - rect.top - pan.y) / scale,
      };
    },
    [pan, zoom],
  );

  /* ── Snap-to-align calculation ── */

  const calcSnap = useCallback(
    (draggedId: string, candidateX: number, candidateY: number, nodeW: number, nodeH: number) => {
      const lines: { orientation: 'h' | 'v'; pos: number; start: number; end: number }[] = [];
      let snappedX = candidateX;
      let snappedY = candidateY;

      // Edges of the dragged node (at candidate position)
      const dLeft = candidateX;
      const dRight = candidateX + nodeW;
      const dCenterX = candidateX + nodeW / 2;
      const dTop = candidateY;
      const dBottom = candidateY + nodeH;
      const dCenterY = candidateY + nodeH / 2;

      // Collect all alignment edges from other nodes
      const others = nodes.filter(n => n.id !== draggedId);
      if (others.length === 0) return { snappedX, snappedY, lines };

      // For each alignment type, find the closest match within threshold
      interface SnapCandidate { diff: number; pos: number; refStart: number; refEnd: number; refNodeId: string }

      // Horizontal alignments (affect Y)
      const hCandidates: SnapCandidate[] = [];
      // Vertical alignments (affect X)
      const vCandidates: SnapCandidate[] = [];

      for (const o of others) {
        const oLeft = o.x;
        const oRight = o.x + o.width;
        const oCenterX = o.x + o.width / 2;
        const oTop = o.y;
        const oBottom = o.y + o.height;
        const oCenterY = o.y + o.height / 2;

        // Vertical lines (guide is vertical, aligns X positions)
        vCandidates.push({ diff: dLeft - oLeft, pos: oLeft, refStart: Math.min(dTop, oTop), refEnd: Math.max(dBottom, oBottom), refNodeId: o.id });
        vCandidates.push({ diff: dCenterX - oCenterX, pos: oCenterX, refStart: Math.min(dTop, oTop), refEnd: Math.max(dBottom, oBottom), refNodeId: o.id });
        vCandidates.push({ diff: dRight - oRight, pos: oRight, refStart: Math.min(dTop, oTop), refEnd: Math.max(dBottom, oBottom), refNodeId: o.id });
        // Also check dLeft vs oRight and dRight vs oLeft (adjacent edges)
        vCandidates.push({ diff: dLeft - oRight, pos: oRight, refStart: Math.min(dTop, oTop), refEnd: Math.max(dBottom, oBottom), refNodeId: o.id });
        vCandidates.push({ diff: dRight - oLeft, pos: oLeft, refStart: Math.min(dTop, oTop), refEnd: Math.max(dBottom, oBottom), refNodeId: o.id });

        // Horizontal lines (guide is horizontal, aligns Y positions)
        hCandidates.push({ diff: dTop - oTop, pos: oTop, refStart: Math.min(dLeft, oLeft), refEnd: Math.max(dRight, oRight), refNodeId: o.id });
        hCandidates.push({ diff: dCenterY - oCenterY, pos: oCenterY, refStart: Math.min(dLeft, oLeft), refEnd: Math.max(dRight, oRight), refNodeId: o.id });
        hCandidates.push({ diff: dBottom - oBottom, pos: oBottom, refStart: Math.min(dLeft, oLeft), refEnd: Math.max(dRight, oRight), refNodeId: o.id });
        hCandidates.push({ diff: dTop - oBottom, pos: oBottom, refStart: Math.min(dLeft, oLeft), refEnd: Math.max(dRight, oRight), refNodeId: o.id });
        hCandidates.push({ diff: dBottom - oTop, pos: oTop, refStart: Math.min(dLeft, oLeft), refEnd: Math.max(dRight, oRight), refNodeId: o.id });
      }

      // Find the closest vertical snap
      const bestV = vCandidates
        .filter(c => Math.abs(c.diff) <= SNAP_THRESHOLD)
        .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0];

      if (bestV) {
        snappedX = candidateX - bestV.diff;
        // Recompute edges after X snap for line start/end
        const newDTop = snappedY;
        const newDBottom = snappedY + nodeH;
        lines.push({
          orientation: 'v',
          pos: bestV.pos,
          start: Math.min(newDTop, bestV.refStart) - 20,
          end: Math.max(newDBottom, bestV.refEnd) + 20,
        });
      }

      // Find the closest horizontal snap
      const bestH = hCandidates
        .filter(c => Math.abs(c.diff) <= SNAP_THRESHOLD)
        .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0];

      if (bestH) {
        snappedY = candidateY - bestH.diff;
        const newDLeft = snappedX;
        const newDRight = snappedX + nodeW;
        lines.push({
          orientation: 'h',
          pos: bestH.pos,
          start: Math.min(newDLeft, bestH.refStart) - 20,
          end: Math.max(newDRight, bestH.refEnd) + 20,
        });
      }

      return { snappedX, snappedY, lines };
    },
    [nodes, SNAP_THRESHOLD],
  );

  /* ── Workspace mouse handlers (pan, add node, deselect, box select) ── */
  const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
    if (isViewMode && !presentMode) return;
    if (presentMode) return;
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panningRef.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
      e.preventDefault();
      return;
    }

    if (e.target === workspaceRef.current || (e.target as HTMLElement).classList.contains('rg-workspace-bg')) {
      if (tool === 'addNode') {
        const pos = screenToWorkspace(e.clientX, e.clientY);
        const newNode: GraphNode = {
          id: generateId(),
          x: pos.x - NODE_DEFAULTS.width / 2,
          y: pos.y - NODE_DEFAULTS.height / 2,
          width: NODE_DEFAULTS.width,
          height: NODE_DEFAULTS.height,
          text: '',
          color: nodeColor,
          shape: nodeShape,
          note: '',
          characterId: '',
          chapterLink: '',
        };
        const nextNodes = [...nodes, newNode];
        setNodes(nextNodes);
        recordHistory(nextNodes, edges);
        setSelectedNodeIds([newNode.id]);
        setSelectedEdgeId(null);
        setEdgePanelEdge(null);
        setConnectSourceId(null);
      } else if (tool === 'select') {
        const pos = screenToWorkspace(e.clientX, e.clientY);
        boxSelectRef.current = { startX: pos.x, startY: pos.y, x: pos.x, y: pos.y };
        dragMovedRef.current = false;
      }
    }
  };

  const handleWorkspaceMouseMove = (e: React.MouseEvent) => {
    if (panningRef.current.isPanning) {
      setPan({
        x: panningRef.current.panStartX + (e.clientX - panningRef.current.startX),
        y: panningRef.current.panStartY + (e.clientY - panningRef.current.startY),
      });
      return;
    }

    if (boxSelectRef.current && tool === 'select') {
      const pos = screenToWorkspace(e.clientX, e.clientY);
      boxSelectRef.current.x = pos.x;
      boxSelectRef.current.y = pos.y;
      const { startX, startY, x, y } = boxSelectRef.current;
      const bx = Math.min(startX, x);
      const by = Math.min(startY, y);
      const bw = Math.abs(x - startX);
      const bh = Math.abs(y - startY);
      setSelectionBox({ x: bx, y: by, w: bw, h: bh });
      if (bw > 5 || bh > 5) dragMovedRef.current = true;
      return;
    }

    if (draggingRef.current.nodeIds.length > 0) {
      const pos = screenToWorkspace(e.clientX, e.clientY);
      const dx = pos.x - draggingRef.current.startX;
      const dy = pos.y - draggingRef.current.startY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragMovedRef.current = true;

      const primaryId = draggingRef.current.nodeIds[0];
      const primaryStart = draggingRef.current.starts[primaryId];
      if (!primaryStart) return;

      let newX = primaryStart.x + dx;
      let newY = primaryStart.y + dy;
      const draggedNode = nodes.find(n => n.id === primaryId);
      if (draggedNode && draggingRef.current.nodeIds.length === 1) {
        const { snappedX, snappedY, lines } = calcSnap(
          primaryId,
          newX,
          newY,
          draggedNode.width,
          draggedNode.height,
        );
        newX = snappedX;
        newY = snappedY;
        setSnapLines(lines);
      } else {
        setSnapLines([]);
      }

      const snapDx = newX - primaryStart.x;
      const snapDy = newY - primaryStart.y;

      setNodes(prev =>
        prev.map(n => {
          const start = draggingRef.current.starts[n.id];
          if (!start) return n;
          return { ...n, x: start.x + snapDx, y: start.y + snapDy };
        }),
      );
      return;
    }

    // Resizing
    if (resizingRef.current.nodeId) {
      const pos = screenToWorkspace(e.clientX, e.clientY);
      const dx = pos.x - resizingRef.current.startX;
      const dy = pos.y - resizingRef.current.startY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragMovedRef.current = true;
      const handle = resizingRef.current.handle;
      const old = resizingRef.current;
      const others = nodes.filter(n => n.id !== resizingRef.current.nodeId);

      // Compute candidate without snap first
      let nw = old.startW, nh = old.startH;
      let nx = old.startNX, ny = old.startNY;
      if (handle === 'se') {
        nw = Math.max(80, old.startW + dx);
        nh = Math.max(40, old.startH + dy);
      } else if (handle === 'nw') {
        nw = Math.max(80, old.startW - dx);
        nh = Math.max(40, old.startH - dy);
        nx = old.startNX + (old.startW - nw);
        ny = old.startNY + (old.startH - nh);
      } else if (handle === 'ne') {
        nw = Math.max(80, old.startW + dx);
        nh = Math.max(40, old.startH - dy);
        ny = old.startNY + (old.startH - nh);
      } else if (handle === 'sw') {
        nw = Math.max(80, old.startW - dx);
        nh = Math.max(40, old.startH + dy);
        nx = old.startNX + (old.startW - nw);
      } else if (handle === 'e') {
        nw = Math.max(80, old.startW + dx);
      } else if (handle === 's') {
        nh = Math.max(40, old.startH + dy);
      } else if (handle === 'w') {
        nw = Math.max(80, old.startW - dx);
        nx = old.startNX + (old.startW - nw);
      } else if (handle === 'n') {
        nh = Math.max(40, old.startH - dy);
        ny = old.startNY + (old.startH - nh);
      }

      // Determine which edges are moving based on the handle
      const moveLeft = handle === 'nw' || handle === 'sw' || handle === 'w';
      const moveRight = handle === 'ne' || handle === 'se' || handle === 'e';
      const moveTop = handle === 'nw' || handle === 'ne' || handle === 'n';
      const moveBottom = handle === 'sw' || handle === 'se' || handle === 's';

      const curLeft = nx;
      const curRight = nx + nw;
      const curTop = ny;
      const curBottom = ny + nh;
      const curCenterX = nx + nw / 2;
      const curCenterY = ny + nh / 2;

      const lines: { orientation: 'h' | 'v'; pos: number; start: number; end: number }[] = [];
      let bestVPos: number | null = null;
      let bestVDiff = Infinity;
      let bestVRef: { start: number; end: number } | null = null;
      let bestHPos: number | null = null;
      let bestHDiff = Infinity;
      let bestHRef: { start: number; end: number } | null = null;

      // Check moving edges against all other nodes
      for (const o of others) {
        const oL = o.x, oR = o.x + o.width, oCX = o.x + o.width / 2;
        const oT = o.y, oB = o.y + o.height, oCY = o.y + o.height / 2;
        const refV = { start: Math.min(curTop, oT), end: Math.max(curBottom, oB) };
        const refH = { start: Math.min(curLeft, oL), end: Math.max(curRight, oR) };

        // Vertical snap (X-axis): check moving horizontal edges
        if (moveLeft || moveRight) {
          const checks = [
            ...(moveLeft ? [{ edge: curLeft, ref: oL }, { edge: curLeft, ref: oR }, { edge: curLeft, ref: oCX }] : []),
            ...(moveRight ? [{ edge: curRight, ref: oR }, { edge: curRight, ref: oL }, { edge: curRight, ref: oCX }] : []),
            { edge: curCenterX, ref: oCX },
            { edge: curCenterX, ref: oL },
            { edge: curCenterX, ref: oR },
          ];
          for (const { edge, ref } of checks) {
            const d = Math.abs(edge - ref);
            if (d <= SNAP_THRESHOLD && d < Math.abs(bestVDiff)) {
              bestVDiff = edge - ref;
              bestVPos = ref;
              bestVRef = refV;
            }
          }
        }

        // Horizontal snap (Y-axis): check moving vertical edges
        if (moveTop || moveBottom) {
          const checks = [
            ...(moveTop ? [{ edge: curTop, ref: oT }, { edge: curTop, ref: oB }, { edge: curTop, ref: oCY }] : []),
            ...(moveBottom ? [{ edge: curBottom, ref: oB }, { edge: curBottom, ref: oT }, { edge: curBottom, ref: oCY }] : []),
            { edge: curCenterY, ref: oCY },
            { edge: curCenterY, ref: oT },
            { edge: curCenterY, ref: oB },
          ];
          for (const { edge, ref } of checks) {
            const d = Math.abs(edge - ref);
            if (d <= SNAP_THRESHOLD && d < Math.abs(bestHDiff)) {
              bestHDiff = edge - ref;
              bestHPos = ref;
              bestHRef = refH;
            }
          }
        }
      }

      // Apply vertical snap
      if (bestVPos !== null) {
        const offset = bestVDiff;
        if (moveLeft && !moveRight) {
          nx = nx - offset;
          nw = old.startNX + old.startW - nx;
        } else if (moveRight && !moveLeft) {
          nw = bestVPos - nx;
        } else if (moveLeft && moveRight) {
          // Center snap or both edges moving
          nx = nx - offset;
          nw = old.startNX + old.startW - nx;
        }
        nw = Math.max(80, nw);
        lines.push({ orientation: 'v', pos: bestVPos, start: bestVRef!.start - 20, end: bestVRef!.end + 20 });
      }

      // Apply horizontal snap
      if (bestHPos !== null) {
        const offset = bestHDiff;
        if (moveTop && !moveBottom) {
          ny = ny - offset;
          nh = old.startNY + old.startH - ny;
        } else if (moveBottom && !moveTop) {
          nh = bestHPos - ny;
        } else if (moveTop && moveBottom) {
          ny = ny - offset;
          nh = old.startNY + old.startH - ny;
        }
        nh = Math.max(40, nh);
        lines.push({ orientation: 'h', pos: bestHPos, start: bestHRef!.start - 20, end: bestHRef!.end + 20 });
      }

      setSnapLines(lines);

      // Ensure we're within valid range
      nw = Math.max(80, nw);
      nh = Math.max(40, nh);
      // Fix position if dimensions constrained
      if (moveLeft && nw === 80) nx = old.startNX + old.startW - 80;
      if (moveTop && nh === 40) ny = old.startNY + old.startH - 40;

      setNodes(prev =>
        prev.map(n =>
          n.id === resizingRef.current.nodeId
            ? { ...n, x: nx, y: ny, width: nw, height: nh }
            : n,
        ),
      );
      return;
    }
  };

  const handleWorkspaceMouseUp = () => {
    panningRef.current.isPanning = false;

    if (boxSelectRef.current && tool === 'select') {
      const { startX, startY, x, y } = boxSelectRef.current;
      const bw = Math.abs(x - startX);
      const bh = Math.abs(y - startY);
      if (bw > 5 || bh > 5) {
        const rect = {
          minX: Math.min(startX, x),
          minY: Math.min(startY, y),
          maxX: Math.max(startX, x),
          maxY: Math.max(startY, y),
        };
        setSelectedNodeIds(nodesInRect(nodes, rect));
        setSelectedEdgeId(null);
        setEdgePanelEdge(null);
      } else if (!dragMovedRef.current) {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setEdgePanelEdge(null);
        setEditingNodeId(null);
        setConnectSourceId(null);
      }
      boxSelectRef.current = null;
      setSelectionBox(null);
    }

    if (draggingRef.current.nodeIds.length > 0 && dragMovedRef.current) {
      setNodes(prev => {
        recordHistory(prev, edgesRef.current);
        return prev;
      });
    }
    if (resizingRef.current.nodeId && dragMovedRef.current) {
      setNodes(prev => {
        recordHistory(prev, edgesRef.current);
        return prev;
      });
    }
    draggingRef.current = { nodeIds: [], startX: 0, startY: 0, starts: {} };
    resizingRef.current.nodeId = null;
    setSnapLines([]);
  };

  /* ── Wheel zoom ── */
  const handleWheel = (e: React.WheelEvent) => {
    // Pan with scroll wheel (no ctrl)
    if (!e.ctrlKey && !e.metaKey) {
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
      return;
    }
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    if (delta > 0) zoomIn();
    else zoomOut();
  };

  /* ── Node mouse handlers ── */
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (isViewMode && !presentMode) return;
    if (presentMode) return;
    e.stopPropagation();

    if (tool === 'connect') {
      if (!connectSourceId) {
        setConnectSourceId(nodeId);
        setSelectedNodeIds([nodeId]);
        setSelectedEdgeId(null);
        setEdgePanelEdge(null);
      } else if (connectSourceId !== nodeId) {
        const newEdge: GraphEdge = {
          id: generateId(),
          sourceId: connectSourceId,
          targetId: nodeId,
          lineStyle: 'solid',
          lineWidth: 2,
          startArrow: false,
          endArrow: true,
          color: '#64748b',
          label: '',
          curveType: 'bezier',
        };
        const nextEdges = [...edges, newEdge];
        setEdges(nextEdges);
        recordHistory(nodes, nextEdges);
        setConnectSourceId(null);
        setSelectedNodeIds([]);
        setSelectedEdgeId(newEdge.id);
      } else {
        setConnectSourceId(null);
        setSelectedNodeIds([]);
      }
      return;
    }

    if (e.shiftKey) {
      setSelectedNodeIds(prev =>
        prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId],
      );
      setSelectedEdgeId(null);
      setEdgePanelEdge(null);
      setConnectSourceId(null);
      return;
    }

    const idsToDrag = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
    if (!selectedNodeIds.includes(nodeId)) {
      setSelectedNodeIds([nodeId]);
    }
    setSelectedEdgeId(null);
    setEdgePanelEdge(null);
    setConnectSourceId(null);

    if (tool === 'select') {
      const pos = screenToWorkspace(e.clientX, e.clientY);
      const starts: Record<string, { x: number; y: number }> = {};
      for (const id of idsToDrag) {
        const n = nodes.find(nn => nn.id === id);
        if (n) starts[id] = { x: n.x, y: n.y };
      }
      draggingRef.current = {
        nodeIds: idsToDrag,
        startX: pos.x,
        startY: pos.y,
        starts,
      };
      dragMovedRef.current = false;
    }
  };

  const handleNodeDoubleClick = (e: React.MouseEvent, nodeId: string) => {
    if (isViewMode) return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
    }
  };

  /* ── Resize handle mouse down ── */
  const handleResizeMouseDown = (e: React.MouseEvent, nodeId: string, handle: string) => {
    if (isViewMode) return;
    e.stopPropagation();
    e.preventDefault();
    const pos = screenToWorkspace(e.clientX, e.clientY);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    resizingRef.current = {
      nodeId,
      handle,
      startX: pos.x,
      startY: pos.y,
      startW: node.width,
      startH: node.height,
      startNX: node.x,
      startNY: node.y,
    };
  };

  /* ── Edge click handler ── */
  const handleEdgeClick = (e: React.MouseEvent, edgeId: string) => {
    if (isViewMode || presentMode) return;
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeIds([]);
    setConnectSourceId(null);
    const edge = edges.find(ed => ed.id === edgeId);
    if (edge) {
      setEdgePanelEdge({ ...edge });
    }
  };

  /* ── Text editing ── */
  const finishEditing = () => {
    if (editingNodeId) {
      setNodes(prev => {
        const next = prev.map(n =>
          n.id === editingNodeId ? { ...n, text: editText } : n,
        );
        recordHistory(next, edgesRef.current);
        return next;
      });
      setEditingNodeId(null);
      setEditText('');
    }
  };

  /* ── Edge property changes ── */
  const updateEdgeProperty = (key: keyof GraphEdge, value: any) => {
    if (!edgePanelEdge) return;
    const updated = { ...edgePanelEdge, [key]: value };
    setEdgePanelEdge(updated);
    setEdges(prev => {
      const next = prev.map(e => (e.id === updated.id ? updated : e));
      recordHistory(nodesRef.current, next);
      return next;
    });
  };

  /* ── Delete selected ── */
  const handleDeleteSelected = () => {
    if (selectedNodeIds.length > 0) {
      const idSet = new Set(selectedNodeIds);
      const nextNodes = nodes.filter(n => !idSet.has(n.id));
      const nextEdges = edges.filter(e => !idSet.has(e.sourceId) && !idSet.has(e.targetId));
      setNodes(nextNodes);
      setEdges(nextEdges);
      recordHistory(nextNodes, nextEdges);
      setSelectedNodeIds([]);
      setEdgePanelEdge(null);
    }
    if (selectedEdgeId) {
      const nextEdges = edges.filter(e => e.id !== selectedEdgeId);
      setEdges(nextEdges);
      recordHistory(nodes, nextEdges);
      setSelectedEdgeId(null);
      setEdgePanelEdge(null);
    }
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (presentMode) {
        if (e.key === 'Escape') { exitPresentation(); return; }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          setPresentIndex(i => Math.min(i + 1, presentOrder.length - 1));
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setPresentIndex(i => Math.max(i - 1, 0));
          return;
        }
        return;
      }

      if (isViewMode) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Escape') {
        if (editingNodeId) {
          finishEditing();
          return;
        }
        if (connectSourceId) {
          setConnectSourceId(null);
          return;
        }
        if (saveDialogOpen) {
          setSaveDialogOpen(false);
          return;
        }
        onClose();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingNodeId || inInput) return;
        handleDeleteSelected();
      }
      if (e.key === 'Enter' && editingNodeId) {
        finishEditing();
      }
      if (e.key === 'Tab' && !editingNodeId && !inInput) {
        e.preventDefault();
        handleAddChildNode();
      }
    };
    window.addEventListener('keydown', handleKey);
    const closeMenu = (e: MouseEvent) => {
      if (shapeMenuRef.current && shapeMenuRef.current.contains(e.target as Node)) return;
      setShapeMenuOpen(false);
    };
    window.addEventListener('click', closeMenu);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', closeMenu);
    };
  }, [isOpen, isViewMode, presentMode, presentOrder.length, editingNodeId, connectSourceId, saveDialogOpen, handleAddChildNode, undo, redo]);

  /* ── Save ── */
  const handleSave = () => {
    if (!graphName.trim()) return;
    const now = new Date().toLocaleString('zh-CN');
    const graph: RelationGraph = {
      id: initialGraph?.id || generateId(),
      name: graphName.trim(),
      nodes,
      edges,
      createdAt: initialGraph?.createdAt || now,
      updatedAt: now,
    };
    onSave(graph);
    setSaveDialogOpen(false);
    onClose();
  };

  /* ── Render helpers ── */

  const renderEdgeLines = () => {
    return edges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.sourceId);
      const targetNode = nodes.find(n => n.id === edge.targetId);
      if (!sourceNode || !targetNode) return null;

      const scx = sourceNode.x + sourceNode.width / 2;
      const scy = sourceNode.y + sourceNode.height / 2;
      const tcx = targetNode.x + targetNode.width / 2;
      const tcy = targetNode.y + targetNode.height / 2;

      const start = getEdgeAnchor(sourceNode, tcx, tcy);
      const end = getEdgeAnchor(targetNode, scx, scy);

      const isSelected = selectedEdgeId === edge.id;
      const isConnectSource = connectSourceId === edge.sourceId;

      const dashArray =
        edge.lineStyle === 'dashed' ? `${edge.lineWidth * 6},${edge.lineWidth * 3}` :
        edge.lineStyle === 'dotted' ? `${edge.lineWidth * 2},${edge.lineWidth * 2}` :
        'none';

      // Arrow marker IDs
      const arrowEndId = `arrow-end-${edge.id}`;
      const arrowStartId = `arrow-start-${edge.id}`;

      // Calculate midpoint for clickable area
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const useBezier = edge.curveType === 'bezier';
      const pathD = useBezier ? bezierPath(start.x, start.y, end.x, end.y) : undefined;

      return (
        <g key={edge.id}>
          <defs>
            {edge.endArrow && (
              <marker
                id={arrowEndId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth={ARROW_SIZE}
                markerHeight={ARROW_SIZE}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={edge.color} />
              </marker>
            )}
            {edge.startArrow && (
              <marker
                id={arrowStartId}
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerWidth={ARROW_SIZE}
                markerHeight={ARROW_SIZE}
                orient="auto-start-reverse"
              >
                <path d="M 10 0 L 0 5 L 10 10 z" fill={edge.color} />
              </marker>
            )}
          </defs>

          {/* Invisible wider clickable path */}
          {useBezier && pathD ? (
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(edge.lineWidth + 8, 14)}
              style={{ cursor: isViewMode ? 'default' : 'pointer' }}
              onClick={(e) => handleEdgeClick(e as any, edge.id)}
            />
          ) : (
            <line
              x1={start.x} y1={start.y}
              x2={end.x} y2={end.y}
              stroke="transparent"
              strokeWidth={Math.max(edge.lineWidth + 8, 14)}
              style={{ cursor: isViewMode ? 'default' : 'pointer' }}
              onClick={(e) => handleEdgeClick(e as any, edge.id)}
            />
          )}

          {/* Visible line */}
          {useBezier && pathD ? (
            <path
              d={pathD}
              fill="none"
              stroke={isSelected ? '#4f46e5' : isConnectSource ? '#f59e0b' : edge.color}
              strokeWidth={edge.lineWidth}
              strokeDasharray={dashArray}
              markerStart={edge.startArrow ? `url(#${arrowStartId})` : undefined}
              markerEnd={edge.endArrow ? `url(#${arrowEndId})` : undefined}
              style={{ cursor: isViewMode ? 'default' : 'pointer', transition: 'stroke 0.15s' }}
              onClick={(e) => handleEdgeClick(e as any, edge.id)}
            />
          ) : (
            <line
              x1={start.x} y1={start.y}
              x2={end.x} y2={end.y}
              stroke={isSelected ? '#4f46e5' : isConnectSource ? '#f59e0b' : edge.color}
              strokeWidth={edge.lineWidth}
              strokeDasharray={dashArray}
              markerStart={edge.startArrow ? `url(#${arrowStartId})` : undefined}
              markerEnd={edge.endArrow ? `url(#${arrowEndId})` : undefined}
              style={{
                cursor: isViewMode ? 'default' : 'pointer',
                transition: 'stroke 0.15s',
              }}
              onClick={(e) => handleEdgeClick(e as any, edge.id)}
            />
          )}

          {/* Edge label */}
          {edge.label && (
            <text
              x={midX}
              y={midY - 8}
              textAnchor="middle"
              fill={isSelected ? '#4f46e5' : '#64748b'}
              fontSize={11}
              fontWeight={600}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {edge.label}
            </text>
          )}

          {/* Selection midpoint dot */}
          {isSelected && (
            <circle
              cx={midX} cy={midY} r={4}
              fill="#4f46e5"
              stroke="#fff"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
      );
    });
  };

  const renderNodes = () => {
    return nodes.map(node => {
      const isSelected = selectedNodeIds.includes(node.id);
      const isConnectSrc = connectSourceId === node.id;
      const isEditing = editingNodeId === node.id;
      const isPresentFocus = presentMode && presentFocusId === node.id;
      const isPresentDim = presentMode && presentFocusId !== node.id;
      const linkedChar = characters.find(c => c.id === node.characterId);

      return (
        <div
          key={node.id}
          className={`rg-node rg-shape-${node.shape || 'rounded'}${isSelected ? ' selected' : ''}${isConnectSrc ? ' connect-source' : ''}${isPresentFocus ? ' present-focus' : ''}${isPresentDim ? ' present-dim' : ''}`}
          style={{
            position: 'absolute',
            left: node.x,
            top: node.y,
            width: node.width,
            height: node.height,
            background: (node.shape === 'triangle') ? 'transparent' : node.color,
            boxShadow: (node.shape === 'triangle') ? 'none' : undefined,
            opacity: isPresentDim ? 0.28 : 1,
          }}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
          onDoubleClick={(e) => handleNodeDoubleClick(e, node.id)}
        >
          {/* Triangle background fill */}
          {node.shape === 'triangle' && (
            <div
              className="rg-triangle-bg"
              style={{
                position: 'absolute',
                inset: 0,
                background: node.color,
                clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))',
              }}
            />
          )}
          {/* Text area */}
          <div className="rg-node-text">
            {isEditing ? (
              <textarea
                className="rg-node-textarea"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    finishEditing();
                  }
                  e.stopPropagation();
                }}
                autoFocus
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                placeholder="输入文字..."
              />
            ) : (
              <span className="rg-node-text-span">
                {node.text || (isViewMode ? '' : '双击编辑')}
              </span>
            )}
          </div>

          {(node.note || node.characterId || node.chapterLink) && !isEditing && (
            <div className="rg-node-badges">
              {node.note && <span className="rg-node-badge" title={node.note}><StickyNote size={10} /></span>}
              {linkedChar && <span className="rg-node-badge" title={linkedChar.name}><User size={10} /></span>}
              {node.chapterLink && <span className="rg-node-badge" title={node.chapterLink}>📖</span>}
            </div>
          )}

          {/* Resize handles (when selected and not view mode) */}
          {isSelected && !isViewMode && !presentMode && selectedNodeIds.length === 1 && (
            <>
              <div
                className="rg-resize-handle se"
                onMouseDown={e => handleResizeMouseDown(e, node.id, 'se')}
              />
              <div
                className="rg-resize-handle nw"
                onMouseDown={e => handleResizeMouseDown(e, node.id, 'nw')}
              />
              <div
                className="rg-resize-handle ne"
                onMouseDown={e => handleResizeMouseDown(e, node.id, 'ne')}
              />
              <div
                className="rg-resize-handle sw"
                onMouseDown={e => handleResizeMouseDown(e, node.id, 'sw')}
              />
              <div
                className="rg-resize-handle e"
                onMouseDown={e => handleResizeMouseDown(e, node.id, 'e')}
              />
              <div
                className="rg-resize-handle s"
                onMouseDown={e => handleResizeMouseDown(e, node.id, 's')}
              />
              <div
                className="rg-resize-handle w"
                onMouseDown={e => handleResizeMouseDown(e, node.id, 'w')}
              />
              <div
                className="rg-resize-handle n"
                onMouseDown={e => handleResizeMouseDown(e, node.id, 'n')}
              />
            </>
          )}

          {/* Connect source indicator */}
          {isConnectSrc && (
            <div className="rg-connect-indicator">← 点击目标节点</div>
          )}
        </div>
      );
    });
  };

  /* ── Render ── */
  if (!isOpen) return null;

  return (
    <div className="rg-editor-overlay" onClick={isViewMode ? onClose : undefined}>
      <div
        className={`rg-editor-container${isViewMode ? ' view-mode' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="rg-editor-header">
          <h2>
            <Network size={18} /> {mode === 'view' ? '查看图谱' : mode === 'edit' ? '编辑图谱' : '新建关系图谱'}
            {graphName && <span className="rg-graph-name-sub">— {graphName}</span>}
          </h2>
          <div className="map-zoom-controls">
            <button className="map-tool-btn map-zoom-btn" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}><Minus size={16} /></button>
            <span className="map-zoom-label">{zoom}%</span>
            <button className="map-tool-btn map-zoom-btn" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}><Plus size={16} /></button>
            {zoom !== 100 && (
              <button className="map-tool-btn map-zoom-btn" onClick={zoomReset}><RotateCcw size={16} /></button>
            )}
            {nodes.length > 0 && (
              <button className="map-tool-btn map-zoom-btn" onClick={startPresentation} title="演示模式"><Presentation size={16} /></button>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Toolbar */}
        {!isViewMode && (
          <div className="rg-editor-toolbar">
            <div className="map-tool-group">
              <button
                className={`map-tool-btn${tool === 'select' ? ' active' : ''}`}
                onClick={() => { setTool('select'); setConnectSourceId(null); }}
                title="选择 - 移动节点、调整大小"
              ><MousePointer size={14} /> 选择</button>
              <div className="rg-split-btn" ref={shapeMenuRef}>
                <button
                  className={`map-tool-btn rg-split-main${tool === 'addNode' ? ' active' : ''}`}
                  onClick={() => { setTool('addNode'); setConnectSourceId(null); setShapeMenuOpen(false); }}
                  title="添加节点 - 点击画布放置新节点"
                ><Plus size={14} /> 添加节点</button>
                <button
                  className={`map-tool-btn rg-split-drop${tool === 'addNode' ? ' active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setShapeMenuOpen(!shapeMenuOpen); }}
                  title="选择形状"
                >{SHAPE_META.find(s => s.key === nodeShape)?.icon || <Square size={14} />}</button>
                {shapeMenuOpen && (
                  <div className="rg-shape-menu">
                    {SHAPE_META.map(s => (
                      <button
                        key={s.key}
                        className={`rg-shape-item${nodeShape === s.key ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setNodeShape(s.key);
                          setShapeMenuOpen(false);
                          if (tool !== 'addNode') setTool('addNode');
                        }}
                        title={s.label}
                      >
                        <span className="rg-shape-icon">{s.icon}</span>
                        <span className="rg-shape-label">{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className={`map-tool-btn${tool === 'connect' ? ' active' : ''}`}
                onClick={() => { setTool('connect'); setConnectSourceId(null); }}
                title="连线 - 点击源节点，再点击目标节点"
              ><Link2 size={14} /> 连线</button>
            </div>

            <div className="map-tool-divider" />

            {/* Node color picker (shown when addNode tool active) */}
            {tool === 'addNode' && (
              <div className="map-tool-group">
                {NODE_COLORS.map(c => (
                  <button
                    key={c}
                    className={`rg-color-btn${nodeColor === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setNodeColor(c)}
                  />
                ))}
              </div>
            )}

            {tool === 'addNode' && <div className="map-tool-divider" />}

            <button
              className="map-tool-btn danger-action"
              onClick={handleDeleteSelected}
              disabled={selectedNodeIds.length === 0 && !selectedEdgeId}
              title="删除选中的节点或连线 (Delete)"
            ><Trash2 size={14} /> 删除{selectedNodeIds.length > 1 ? ` (${selectedNodeIds.length})` : ''}</button>

            <div className="map-tool-divider" />

            <button className="map-tool-btn" onClick={undo} disabled={!canUndo} title="撤销 (Ctrl+Z)"><Undo2 size={14} /></button>
            <button className="map-tool-btn" onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Y)"><Redo2 size={14} /></button>

            <div style={{ flex: 1 }} />

            <button className="map-tool-btn" onClick={startPresentation} disabled={nodes.length === 0} title="演示模式"><Presentation size={14} /> 演示</button>
            <button className="map-tool-btn" onClick={fitToContent} title="适应全部内容"><Focus size={14} /> 适应内容</button>
            <button className="map-tool-btn" onClick={handleExportPng} title="导出 PNG"><Download size={14} /> 导出</button>
            <button className="map-tool-btn" onClick={zoomReset} title="重置缩放"><Maximize2 size={14} /> 100%</button>
            <button className="map-tool-btn primary-action" onClick={() => setSaveDialogOpen(true)}>
              <Save size={14} /> 保存图谱
            </button>
          </div>
        )}

        {/* Body: workspace + edge panel */}
        <div className="rg-editor-body">
          {/* Left toolbox (BoardMix-style) */}
          {!isViewMode && (
            <aside className="rg-toolbox">
              <div className="rg-toolbox-section">
                <h4><LayoutTemplate size={14} /> 模板</h4>
                <div className="rg-template-grid">
                  {GRAPH_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className="rg-template-card"
                      onClick={() => handleLoadTemplate(t.id)}
                      title={t.description}
                    >
                      <span className="rg-template-icon">{t.icon}</span>
                      <span className="rg-template-name">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rg-toolbox-section">
                <h4><Wand2 size={14} /> 智能布局</h4>
                <div className="rg-layout-btns">
                  <button type="button" className="rg-layout-btn" onClick={() => handleApplyLayout('tree-v')}>树形 ↓</button>
                  <button type="button" className="rg-layout-btn" onClick={() => handleApplyLayout('tree-h')}>树形 →</button>
                  <button type="button" className="rg-layout-btn" onClick={() => handleApplyLayout('radial')}>辐射</button>
                </div>
              </div>

              <div className="rg-toolbox-section">
                <h4><Palette size={14} /> 主题</h4>
                <div className="rg-theme-btns">
                  {GRAPH_THEMES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`rg-theme-btn${activeTheme === t.id ? ' active' : ''}`}
                      onClick={() => handleApplyTheme(t.id)}
                      title={t.name}
                    >
                      <span className="rg-theme-dot" style={{ background: t.nodeColors[0] }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rg-toolbox-hint">
                <p><kbd>Tab</kbd> 添加子节点</p>
                <p><kbd>Shift</kbd> 多选 · 框选批量选择</p>
                <p><kbd>Ctrl+Z</kbd> 撤销 · <kbd>Ctrl+Y</kbd> 重做</p>
                <p><kbd>Delete</kbd> 删除选中</p>
              </div>
            </aside>
          )}

          {/* Workspace */}
          <div
            className={`rg-workspace-wrap${presentMode ? ' present-mode' : ''}`}
            ref={workspaceRef}
            onMouseDown={handleWorkspaceMouseDown}
            onMouseMove={handleWorkspaceMouseMove}
            onMouseUp={handleWorkspaceMouseUp}
            onMouseLeave={handleWorkspaceMouseUp}
            onWheel={handleWheel}
          >
            <div
              className="rg-workspace-bg"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
                transformOrigin: '0 0',
                width: 4000,
                height: 3000,
                backgroundColor: canvasTheme.canvas,
                backgroundImage: `radial-gradient(circle, ${canvasTheme.grid} 1px, transparent 1px)`,
                backgroundSize: '24px 24px',
              }}
            />

            {/* SVG overlay for edges */}
            <svg
              ref={svgRef}
              className="rg-svg-layer"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
                transformOrigin: '0 0',
                width: 4000,
                height: 3000,
              }}
            >
              {renderEdgeLines()}
              {/* Snap guide lines */}
              {snapLines.map((line, i) => (
                <line
                  key={`snap-${i}`}
                  x1={line.orientation === 'v' ? line.pos : line.start}
                  y1={line.orientation === 'h' ? line.pos : line.start}
                  x2={line.orientation === 'v' ? line.pos : line.end}
                  y2={line.orientation === 'h' ? line.pos : line.end}
                  stroke="#4f46e5"
                  strokeWidth={1}
                  strokeDasharray="6,3"
                  opacity={0.7}
                  style={{ pointerEvents: 'none' }}
                />
              ))}
            </svg>

            {/* HTML node layer */}
            <div
              className="rg-node-layer"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
                transformOrigin: '0 0',
                width: 4000,
                height: 3000,
              }}
            >
              {renderNodes()}
            </div>

            {/* Box selection overlay */}
            {selectionBox && (
              <div
                className="rg-selection-box"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
                  transformOrigin: '0 0',
                  left: selectionBox.x,
                  top: selectionBox.y,
                  width: selectionBox.w,
                  height: selectionBox.h,
                }}
              />
            )}

            {/* Minimap */}
            {nodes.length > 0 && (
              <GraphMinimap
                nodes={nodes}
                edges={edges}
                pan={pan}
                zoom={zoom}
                viewportW={viewportSize.w}
                viewportH={viewportSize.h}
                onPanChange={setPan}
                canvasColor={canvasTheme.canvas}
              />
            )}

            {/* Presentation controls */}
            {presentMode && presentOrder.length > 0 && (
              <div className="rg-present-bar">
                <button type="button" className="btn btn-sm" disabled={presentIndex <= 0}
                  onClick={() => setPresentIndex(i => Math.max(0, i - 1))}>
                  <ChevronLeft size={16} /> 上一步
                </button>
                <span className="rg-present-counter">
                  {presentIndex + 1} / {presentOrder.length}
                  {(() => {
                    const n = nodes.find(nn => nn.id === presentFocusId);
                    return n ? ` · ${n.text || '未命名'}` : '';
                  })()}
                </span>
                <button type="button" className="btn btn-sm" disabled={presentIndex >= presentOrder.length - 1}
                  onClick={() => setPresentIndex(i => Math.min(presentOrder.length - 1, i + 1))}>
                  下一步 <ChevronRight size={16} />
                </button>
                <button type="button" className="btn btn-sm" onClick={exitPresentation}>退出演示</button>
              </div>
            )}

            {/* Tool hint */}
            {!isViewMode && (
              <div className="rg-tool-hint">
                {tool === 'addNode' && '点击画布空白处添加节点'}
                {tool === 'select' && '拖拽移动 · Shift 多选 · 框选 · Tab 子节点'}
                {tool === 'connect' && (connectSourceId ? '点击目标节点完成连线' : '点击源节点开始连线')}
                {' · Alt+拖拽 平移画布 · Ctrl+滚轮 缩放'}
              </div>
            )}
          </div>

          {/* Edge Property Panel (shown when edge/line is selected) */}
          {edgePanelEdge && !isViewMode && (
            <div className="rg-edge-panel">
              <div className="rg-edge-panel-header">
                <h3><Link2 size={14} /> 连线属性</h3>
                <button
                  className="modal-close-btn"
                  onClick={() => { setEdgePanelEdge(null); setSelectedEdgeId(null); }}
                ><X size={18} /></button>
              </div>

              <div className="rg-edge-panel-body">
                <div className="form-group">
                  <label>关系标签</label>
                  <input
                    className="plugin-input sm"
                    type="text"
                    placeholder="如：父子、盟友、对立..."
                    value={edgePanelEdge.label ?? ''}
                    onChange={e => updateEdgeProperty('label', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>连线类型</label>
                  <div className="rg-style-btns">
                    {([
                      { key: 'bezier', label: '曲线' },
                      { key: 'straight', label: '直线' },
                    ] as const).map(s => (
                      <button
                        key={s.key}
                        className={`rg-style-btn${(edgePanelEdge.curveType ?? 'straight') === s.key ? ' active' : ''}`}
                        onClick={() => updateEdgeProperty('curveType', s.key)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Style */}
                <div className="form-group">
                  <label>线型</label>
                  <div className="rg-style-btns">
                    {([
                      { key: 'solid', label: '━ 实线' },
                      { key: 'dashed', label: '┅ 虚线' },
                      { key: 'dotted', label: '┅ 点线' },
                    ] as const).map(s => (
                      <button
                        key={s.key}
                        className={`rg-style-btn${edgePanelEdge.lineStyle === s.key ? ' active' : ''}`}
                        onClick={() => updateEdgeProperty('lineStyle', s.key)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Width */}
                <div className="form-group">
                  <label>粗细: {edgePanelEdge.lineWidth}px</label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="0.5"
                    value={edgePanelEdge.lineWidth}
                    onChange={e => updateEdgeProperty('lineWidth', parseFloat(e.target.value))}
                    className="rg-slider"
                  />
                </div>

                {/* Line Color */}
                <div className="form-group">
                  <label>颜色</label>
                  <input
                    type="color"
                    value={edgePanelEdge.color}
                    onChange={e => updateEdgeProperty('color', e.target.value)}
                    className="map-color-input"
                  />
                </div>

                {/* Arrows */}
                <div className="form-group">
                  <label>箭头</label>
                  <div className="rg-check-row">
                    <label className="rg-check-label">
                      <input
                        type="checkbox"
                        checked={edgePanelEdge.startArrow}
                        onChange={e => updateEdgeProperty('startArrow', e.target.checked)}
                      />
                      起点箭头
                    </label>
                    <label className="rg-check-label">
                      <input
                        type="checkbox"
                        checked={edgePanelEdge.endArrow}
                        onChange={e => updateEdgeProperty('endArrow', e.target.checked)}
                      />
                      终点箭头
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Node property panel (when node selected and not editing) */}
          {selectedNodeId && selectedNodeIds.length === 1 && !edgePanelEdge && !isViewMode && !editingNodeId && (() => {
            const node = nodes.find(n => n.id === selectedNodeId);
            if (!node) return null;
            return (
              <div className="rg-edge-panel">
                <div className="rg-edge-panel-header">
                  <h3><Box size={14} /> 节点属性</h3>
                  <button
                    className="modal-close-btn"
                    onClick={() => setSelectedNodeIds([])}
                  ><X size={18} /></button>
                </div>
                <div className="rg-edge-panel-body">
                  <div className="form-group">
                    <label>文字内容</label>
                    <textarea
                      className="plugin-textarea"
                      value={node.text}
                      onChange={e => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, text: e.target.value } : n))}
                      onBlur={() => recordHistory(nodesRef.current, edgesRef.current)}
                      rows={3}
                      placeholder="节点文字..."
                    />
                  </div>

                  <div className="form-group">
                    <label><StickyNote size={12} /> 备注</label>
                    <textarea
                      className="plugin-textarea"
                      value={node.note ?? ''}
                      onChange={e => updateNodeProperty(node.id, { note: e.target.value }, false)}
                      onBlur={() => recordHistory(nodesRef.current, edgesRef.current)}
                      rows={3}
                      placeholder="补充说明、剧情要点..."
                    />
                  </div>

                  <div className="form-group">
                    <label><User size={12} /> 关联人物</label>
                    <select
                      className="plugin-select sm"
                      value={node.characterId ?? ''}
                      onChange={e => updateNodeProperty(node.id, { characterId: e.target.value })}
                    >
                      <option value="">— 不关联 —</option>
                      {characters.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {characters.length === 0 && (
                      <p className="rg-field-hint">可在「人物卡片」插件中创建人物</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>关联章节</label>
                    <input
                      className="plugin-input sm"
                      type="text"
                      placeholder={chapterTitle ? `如：${chapterTitle}` : '如：第三章 转折点'}
                      value={node.chapterLink ?? ''}
                      onChange={e => updateNodeProperty(node.id, { chapterLink: e.target.value }, false)}
                      onBlur={() => recordHistory(nodesRef.current, edgesRef.current)}
                    />
                    {chapterTitle && !node.chapterLink && (
                      <button
                        type="button"
                        className="btn btn-sm btn-full"
                        style={{ marginTop: 6 }}
                        onClick={() => updateNodeProperty(node.id, { chapterLink: chapterTitle })}
                      >
                        填入当前章节
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <label>颜色</label>
                    <div className="rg-style-btns">
                      {NODE_COLORS.map(c => (
                        <button
                          key={c}
                          className={`rg-color-btn${node.color === c ? ' active' : ''}`}
                          style={{ background: c }}
                          onClick={() => updateNodeProperty(node.id, { color: c })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>快捷操作</label>
                    <button type="button" className="btn btn-sm btn-full" onClick={handleAddChildNode}>
                      <Plus size={14} /> 添加子节点 (Tab)
                    </button>
                  </div>
                  <div className="form-group">
                    <label>尺寸: {Math.round(node.width)} × {Math.round(node.height)}</label>
                    <div className="rg-size-inputs">
                      <input
                        type="number"
                        className="plugin-input sm"
                        value={Math.round(node.width)}
                        onChange={e => updateNodeProperty(node.id, { width: Math.max(80, parseInt(e.target.value) || 80) }, false)}
                        onBlur={() => recordHistory(nodesRef.current, edgesRef.current)}
                        placeholder="宽"
                      />
                      <span>×</span>
                      <input
                        type="number"
                        className="plugin-input sm"
                        value={Math.round(node.height)}
                        onChange={e => updateNodeProperty(node.id, { height: Math.max(40, parseInt(e.target.value) || 40) }, false)}
                        onBlur={() => recordHistory(nodesRef.current, edgesRef.current)}
                        placeholder="高"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Multi-select hint */}
          {selectedNodeIds.length > 1 && !edgePanelEdge && !isViewMode && (
            <div className="rg-edge-panel">
              <div className="rg-edge-panel-header">
                <h3><Box size={14} /> 已选 {selectedNodeIds.length} 个节点</h3>
              </div>
              <div className="rg-edge-panel-body">
                <p className="rg-field-hint">可一起拖拽移动，或按 Delete 批量删除</p>
              </div>
            </div>
          )}
        </div>

        {/* Template picker overlay (first create) */}
        {showTemplatePicker && !isViewMode && (
          <div className="rg-template-overlay">
            <div className="rg-template-modal">
              <h3><LayoutTemplate size={20} /> 选择图谱模板</h3>
              <p className="rg-template-modal-desc">像 BoardMix 一样，从模板快速开始，之后仍可自由编辑</p>
              <div className="rg-template-modal-grid">
                {GRAPH_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className="rg-template-modal-card"
                    onClick={() => handleLoadTemplate(t.id)}
                  >
                    <span className="rg-template-modal-icon">{t.icon}</span>
                    <strong>{t.name}</strong>
                    <span>{t.description}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setShowTemplatePicker(false)}>
                跳过，使用空白画布
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="rg-editor-footer">
          {isViewMode ? (
            <>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <Eye size={14} /> 只读模式 — 点击背景或 <X size={14} /> 关闭
              </span>
              <button className="btn" onClick={onClose}>关闭</button>
            </>
          ) : (
            <>
              {saveDialogOpen ? (
                <div className="rg-save-dialog">
                  <input
                    className="plugin-input"
                    style={{ marginBottom: 0, width: 200 }}
                    placeholder="输入图谱名称..."
                    value={graphName}
                    onChange={e => setGraphName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveDialogOpen(false); }}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!graphName.trim()}>
                    <Check size={16} /> 确认保存
                  </button>
                  <button className="btn btn-sm" onClick={() => setSaveDialogOpen(false)}>
                    取消
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary" onClick={() => setSaveDialogOpen(true)}>
                  <Save size={14} /> 保存图谱
                </button>
              )}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 12 }}>
                节点: {nodes.length} · 连线: {edges.length} · Esc 关闭 · Delete 删除选中
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═════════════════════════════════════════════
   Graph Thumbnail (miniature SVG preview)
   ═════════════════════════════════════════════ */

interface GraphThumbnailProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
}

export const GraphThumbnail: React.FC<GraphThumbnailProps> = ({
  nodes,
  edges,
  width = 280,
  height = 120,
}) => {
  if (nodes.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: `${width}/${height}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff', fontSize: '0.75rem', flexDirection: 'column', gap: 4,
        }}
      >
        <Network size={18} />
        <span>空图谱</span>
      </div>
    );
  }

  // Compute bounding box of all nodes + edges
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  const graphW = maxX - minX || 400;
  const graphH = maxY - minY || 300;
  const pad = 16;
  const availW = width - pad * 2;
  const availH = height - pad * 2;
  const scale = Math.min(availW / graphW, availH / graphH);
  // Center content in the available area
  const offsetX = pad + (availW - graphW * scale) / 2;
  const offsetY = pad + (availH - graphH * scale) / 2;

  const tx = (x: number) => (x - minX) * scale + offsetX;
  const ty = (y: number) => (y - minY) * scale + offsetY;

  // Node-anchor for edges (center-based)
  const getAnchor = (
    node: GraphNode,
    txNode: number,
    tyNode: number,
    targetX: number,
    targetY: number,
  ): { x: number; y: number } => {
    const cx = txNode + (node.width * scale) / 2;
    const cy = tyNode + (node.height * scale) / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;
    const rx = (node.width * scale) / 2 + 2;
    const ry = (node.height * scale) / 2 + 2;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx + rx, y: cy };
    const angle = Math.atan2(dy, dx);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const t = Math.sqrt(
      (rx * rx * ry * ry) / (ry * ry * cosA * cosA + rx * rx * sinA * sinA),
    );
    return { x: cx + t * cosA, y: cy + t * sinA };
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height: 'auto', background: '#f8fafc' }}
    >
      {/* Subtle background */}
      <rect x={0} y={0} width={width} height={height} fill="#f8fafc" />

      {/* Edges */}
      {edges.map(edge => {
        const source = nodes.find(n => n.id === edge.sourceId);
        const target = nodes.find(n => n.id === edge.targetId);
        if (!source || !target) return null;

        const sx = tx(source.x), sy = ty(source.y);
        const ex = tx(target.x), ey = ty(target.y);
        const tcx = ex + (target.width * scale) / 2;
        const tcy = ey + (target.height * scale) / 2;
        const scx = sx + (source.width * scale) / 2;
        const scy = sy + (source.height * scale) / 2;

        const start = getAnchor(source, sx, sy, tcx, tcy);
        const end = getAnchor(target, ex, ey, scx, scy);

        const dashArray =
          edge.lineStyle === 'dashed' ? '4,3' :
          edge.lineStyle === 'dotted' ? '1.5,2' :
          'none';

        const lw = Math.max(0.8, edge.lineWidth * scale);

        const arrowId = `tmb-arrow-${edge.id}`;

        return (
          <g key={edge.id}>
            {edge.endArrow && (
              <defs>
                <marker
                  id={arrowId}
                  viewBox="0 0 10 10"
                  refX="9" refY="5"
                  markerWidth={5} markerHeight={5}
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={edge.color} />
                </marker>
              </defs>
            )}
            <line
              x1={start.x} y1={start.y}
              x2={end.x} y2={end.y}
              stroke={edge.color}
              strokeWidth={lw}
              strokeDasharray={dashArray}
              markerEnd={edge.endArrow ? `url(#${arrowId})` : undefined}
              opacity={0.7}
            />
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const nx = tx(node.x);
        const ny = ty(node.y);
        const nw = node.width * scale;
        const nh = node.height * scale;
        const fontSize = Math.max(5, Math.min(11, (nw * 0.09), (nh * 0.18)));

        return (
          <g key={node.id}>
            <rect
              x={nx} y={ny}
              width={nw} height={nh}
              rx={Math.min(6, nh * 0.22)}
              ry={Math.min(6, nh * 0.22)}
              fill={node.color}
              opacity={0.92}
            />
            {node.text && nw > 20 && nh > 10 && (
              <text
                x={nx + nw / 2}
                y={ny + nh / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={fontSize}
                fontWeight={600}
              >
                {node.text.slice(0, Math.max(1, Math.floor(nw / fontSize / 1.2)))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default RelationGraphEditor;
