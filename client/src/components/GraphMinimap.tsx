import React, { useRef, useCallback } from 'react';
import type { GraphEdge, GraphNode } from './RelationGraphEditor';
import { getGraphBounds } from './relationGraphUtils';

interface GraphMinimapProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  pan: { x: number; y: number };
  zoom: number;
  viewportW: number;
  viewportH: number;
  onPanChange: (pan: { x: number; y: number }) => void;
  canvasColor?: string;
}

const MINIMAP_W = 168;
const MINIMAP_H = 112;
const PAD = 8;

const GraphMinimap: React.FC<GraphMinimapProps> = ({
  nodes,
  edges,
  pan,
  zoom,
  viewportW,
  viewportH,
  onPanChange,
  canvasColor = '#f8fafc',
}) => {
  const draggingRef = useRef(false);

  const bounds = getGraphBounds(nodes);
  const graphW = Math.max(bounds.width, 200);
  const graphH = Math.max(bounds.height, 150);
  const scale = Math.min(
    (MINIMAP_W - PAD * 2) / graphW,
    (MINIMAP_H - PAD * 2) / graphH,
  );

  const tx = (x: number) => (x - bounds.minX) * scale + PAD;
  const ty = (y: number) => (y - bounds.minY) * scale + PAD;

  const scaleFactor = zoom / 100;
  const viewLeft = -pan.x / scaleFactor;
  const viewTop = -pan.y / scaleFactor;
  const viewW = viewportW / scaleFactor;
  const viewH = viewportH / scaleFactor;

  const vpX = tx(viewLeft);
  const vpY = ty(viewTop);
  const vpW = viewW * scale;
  const vpH = viewH * scale;

  const panFromMinimap = useCallback(
    (clientX: number, clientY: number, el: SVGSVGElement) => {
      const rect = el.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const wx = (mx - PAD) / scale + bounds.minX;
      const wy = (my - PAD) / scale + bounds.minY;
      const newPanX = viewportW / 2 - wx * scaleFactor;
      const newPanY = viewportH / 2 - wy * scaleFactor;
      onPanChange({ x: newPanX, y: newPanY });
    },
    [scale, bounds.minX, bounds.minY, scaleFactor, viewportW, viewportH, onPanChange],
  );

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    draggingRef.current = true;
    panFromMinimap(e.clientX, e.clientY, e.currentTarget);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    panFromMinimap(e.clientX, e.clientY, e.currentTarget);
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
  };

  return (
    <div className="rg-minimap" onMouseLeave={handleMouseUp}>
      <div className="rg-minimap-label">导航</div>
      <svg
        width={MINIMAP_W}
        height={MINIMAP_H}
        className="rg-minimap-svg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <rect x={0} y={0} width={MINIMAP_W} height={MINIMAP_H} fill={canvasColor} rx={6} />
        {edges.map(edge => {
          const s = nodes.find(n => n.id === edge.sourceId);
          const t = nodes.find(n => n.id === edge.targetId);
          if (!s || !t) return null;
          return (
            <line
              key={edge.id}
              x1={tx(s.x + s.width / 2)}
              y1={ty(s.y + s.height / 2)}
              x2={tx(t.x + t.width / 2)}
              y2={ty(t.y + t.height / 2)}
              stroke="#94a3b8"
              strokeWidth={0.8}
              opacity={0.6}
            />
          );
        })}
        {nodes.map(n => (
          <rect
            key={n.id}
            x={tx(n.x)}
            y={ty(n.y)}
            width={Math.max(4, n.width * scale)}
            height={Math.max(3, n.height * scale)}
            fill={n.color}
            rx={1}
            opacity={0.9}
          />
        ))}
        <rect
          x={Math.max(PAD, Math.min(vpX, MINIMAP_W - PAD - 4))}
          y={Math.max(PAD, Math.min(vpY, MINIMAP_H - PAD - 4))}
          width={Math.min(vpW, MINIMAP_W - PAD * 2)}
          height={Math.min(vpH, MINIMAP_H - PAD * 2)}
          fill="rgba(79,70,229,0.08)"
          stroke="#4f46e5"
          strokeWidth={1.5}
          rx={2}
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  );
};

export default GraphMinimap;
