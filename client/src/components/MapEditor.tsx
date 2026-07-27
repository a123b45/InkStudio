import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Map, Minus, Plus, RotateCcw, X, Pencil, Eraser, Square, Circle, Hexagon, PaintBucket, MapPin as MapPinIcon, Undo2, Trash2, ImagePlus, Dices, Save, Check, AlertTriangle } from 'lucide-react';

/* ── Types ── */

export interface MapData {
  id: string;
  name: string;
  dataURL: string;
  thumbnailURL: string;
  createdAt: string;
  pins: MapPin[];
}

export interface MapPin {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
}

interface MapEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, dataURL: string, thumbnailURL: string, pins: MapPin[]) => void;
  initialDataURL?: string | null;
  initialPins?: MapPin[];
  mode?: 'edit' | 'view';
}

type Tool = 'pencil' | 'rect' | 'ellipse' | 'polygon' | 'bucket' | 'eraser' | 'pin';

const CANVAS_W = 1200;
const CANVAS_H = 800;
const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10MB max image file size

const PIN_COLORS = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#F97316','#EC4899','#1F2937','#FFFFFF'];

const ZOOM_STEPS = [50, 67, 75, 100, 125, 150, 200, 300];
const ZOOM_MIN = 50;
const ZOOM_MAX = 300;

/* ── Helpers ── */

/** Create a thumbnail dataURL at the given max dimensions */
function createThumbnail(dataURL: string, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/png'));
    };
    img.src = dataURL;
  });
}

/* ── World map noise helpers ── */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function hash2f(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let n = Math.imul(xi ^ seed, 374761393) ^ Math.imul(yi ^ (seed >>> 13), 668265263);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2f(x0, y0, seed);
  const b = hash2f(x0 + 1, y0, seed);
  const c = hash2f(x0, y0 + 1, seed);
  const d = hash2f(x0 + 1, y0 + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency, seed + i * 7919);
    amplitude *= 0.52;
    frequency *= 2.08;
  }
  return value;
}

function pickTerrainColor(elevation: number, seaLevel: number, lat: number): [number, number, number] {
  if (elevation < seaLevel) {
    const depth = clamp01((seaLevel - elevation) / seaLevel);
    return [
      Math.round(lerp(18, 52, 1 - depth)),
      Math.round(lerp(55, 118, 1 - depth)),
      Math.round(lerp(95, 168, 1 - depth)),
    ];
  }

  const land = clamp01((elevation - seaLevel) / (1 - seaLevel));
  let r: number;
  let g: number;
  let b: number;

  if (land < 0.04) {
    r = 218; g = 200; b = 145; // 沙滩
  } else if (land < 0.28) {
    r = 88; g = 145; b = 72; // 平原
  } else if (land < 0.48) {
    r = 52; g = 108; b = 58; // 森林
  } else if (land < 0.68) {
    r = 96; g = 82; b = 58; // 丘陵
  } else if (land < 0.82) {
    r = 118; g = 108; b = 98; // 山脉
  } else {
    r = 228; g = 232; b = 238; // 雪峰
  }

  // 高纬度极地冰盖
  if (lat > 0.72) {
    const ice = clamp01((lat - 0.72) / 0.28);
    if (land < 0.62 || elevation > 0.78) {
      r = Math.round(lerp(r, 236, ice));
      g = Math.round(lerp(g, 242, ice));
      b = Math.round(lerp(b, 248, ice));
    }
  }

  // 低纬度沙漠带（副热带）
  if (lat > 0.22 && lat < 0.42 && land > 0.08 && land < 0.38) {
    const desert = clamp01((elevation - seaLevel) * 2.5) * 0.55;
    r = Math.round(lerp(r, 196, desert));
    g = Math.round(lerp(g, 170, desert));
    b = Math.round(lerp(b, 108, desert));
  }

  return [r, g, b];
}

function drawMapGraticule(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.lineWidth = 1;

  for (let i = 1; i < 10; i++) {
    const y = (h * i) / 10;
    ctx.strokeStyle = i === 5 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  for (let i = 1; i < 24; i++) {
    const x = (w * i) / 24;
    ctx.strokeStyle = i === 12 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMapBorder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  const inset = 14;

  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.82);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(20,14,8,0.18)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(72, 52, 36, 0.75)';
  ctx.lineWidth = 4;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

  ctx.strokeStyle = 'rgba(160, 130, 90, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(inset + 5, inset + 5, w - (inset + 5) * 2, h - (inset + 5) * 2);

  ctx.fillStyle = 'rgba(72, 52, 36, 0.85)';
  ctx.font = '600 13px "Noto Serif SC", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('墨坊 · 世界地图', w / 2, h - inset + 2);

  ctx.restore();
}

/* ═════════════════════════════════════════════
   Random World Map Generator (noise terrain)
   ═════════════════════════════════════════════ */

function generateRandomMap(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const seed = Math.floor(Math.random() * 1e9);
  const seaLevel = 0.47 + hash2f(1, 1, seed) * 0.04;
  const oceanBias = 0.1 + hash2f(2, 2, seed) * 0.02;

  // 半分辨率生成后平滑放大，海岸线更自然
  const rw = Math.max(400, Math.floor(w / 2));
  const rh = Math.max(280, Math.floor(h / 2));
  const imageData = ctx.createImageData(rw, rh);
  const data = imageData.data;

  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const nx = x / rw;
      const ny = y / rh;
      const lat = Math.abs(ny - 0.5) * 2;

      // 域扭曲：让大陆轮廓更有机
      const warpX = (fbm(nx * 2.8, ny * 2.8, seed + 11, 3) - 0.5) * 0.22;
      const warpY = (fbm(nx * 2.8 + 40, ny * 2.8 + 40, seed + 23, 3) - 0.5) * 0.18;

      const sx = nx + warpX;
      const sy = ny + warpY;

      // 多层噪声叠加 → Elevation
      let elevation =
        fbm(sx * 3.2, sy * 2.6, seed, 6) * 0.72 +
        fbm(sx * 7.5, sy * 6.5, seed + 101, 4) * 0.22 +
        fbm(sx * 14, sy * 12, seed + 303, 2) * 0.06;

      // 轻微经向拉伸，模拟世系平面展开感
      elevation += (fbm(sx * 1.6, sy * 3.8, seed + 505, 3) - 0.5) * 0.08;

      // 海洋面积约 65–72%
      elevation -= oceanBias;

      const [r, g, b] = pickTerrainColor(elevation, seaLevel, lat);
      const i = (y * rw + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = rw;
  offscreen.height = rh;
  const octx = offscreen.getContext('2d')!;
  octx.putImageData(imageData, 0, 0);

  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(offscreen, 0, 0, w, h);

  // 浅滩高光（海岸线附近）
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 18; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    const rx = 30 + Math.random() * 120;
    const ry = 20 + Math.random() * 80;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, '#a5f3fc');
    g.addColorStop(1, 'rgba(165,243,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  drawMapGraticule(ctx, w, h);
  drawMapBorder(ctx, w, h);
}

/* ═════════════════════════════════════════════
   Flood Fill (BFS)
   ═════════════════════════════════════════════ */

function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
  canvasW: number,
  canvasH: number,
) {
  const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imageData.data;
  const w = canvasW;

  const getPixel = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * w + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  };

  // Parse fill color
  const tmp = document.createElement('canvas');
  tmp.width = 1; tmp.height = 1;
  const tctx = tmp.getContext('2d')!;
  tctx.fillStyle = fillColor;
  tctx.fillRect(0, 0, 1, 1);
  const fillData = tctx.getImageData(0, 0, 1, 1).data;
  const fr = fillData[0], fg = fillData[1], fb = fillData[2];

  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sx >= w || sy < 0 || sy >= canvasH) return;

  const [tr, tg, tb] = getPixel(sx, sy);
  // Don't fill if target color is already the fill color
  if (Math.abs(tr - fr) < 2 && Math.abs(tg - fg) < 2 && Math.abs(tb - fb) < 2) return;

  const tolerance = 20;
  const match = (x: number, y: number) => {
    const [r, g, b] = getPixel(x, y);
    return Math.abs(r - tr) <= tolerance && Math.abs(g - tg) <= tolerance && Math.abs(b - tb) <= tolerance;
  };

  const stack: [number, number][] = [[sx, sy]];
  const visited = new Uint8Array(w * canvasH);
  const idx = (x: number, y: number) => y * w + x;

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || x >= w || y < 0 || y >= canvasH) continue;
    if (visited[idx(x, y)]) continue;
    if (!match(x, y)) continue;

    visited[idx(x, y)] = 1;
    setPixel(x, y, fr, fg, fb);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

/* ═════════════════════════════════════════════
   Component
   ═════════════════════════════════════════════ */

const MapEditor: React.FC<MapEditorProps> = ({ isOpen, onClose, onSave, initialDataURL, initialPins, mode = 'edit' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#1e293b');
  const [brushSize, setBrushSize] = useState(3);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [mapName, setMapName] = useState('');
  const [viewImage, setViewImage] = useState<HTMLImageElement | null>(null);
  const [importMsg, setImportMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pin state
  const [pins, setPins] = useState<MapPin[]>([]);
  const [pinColor, setPinColor] = useState(PIN_COLORS[0]);
  const [showPinInput, setShowPinInput] = useState<{ x: number; y: number } | null>(null);
  const [pinLabel, setPinLabel] = useState('');

  // Zoom state
  const [zoom, setZoom] = useState(100);

  // Drawing state
  const drawingRef = useRef({
    isDrawing: false,
    startX: 0,
    startY: 0,
    polygonPoints: [] as number[],
    undoStack: [] as ImageData[],
    maxUndo: 30,
  });

  /* ── Init / Reset Canvas ── */
  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const saveUndoState = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const stack = drawingRef.current;
    const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    stack.undoStack.push(imageData);
    if (stack.undoStack.length > stack.maxUndo) {
      stack.undoStack.shift();
    }
  }, [getCtx]);

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, [getCtx]);

  /* ── Pin Drawing ── */
  const drawPinShape = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    const r = 11; // head radius
    ctx.save();
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    // Needle (pointed tip below the head)
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + r - 3);
    ctx.lineTo(x + 5, y + r - 3);
    ctx.lineTo(x, y + r + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Round head
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();

    // Highlight for 3D effect
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  const redrawPins = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    // Draw each pin on the canvas (on top of whatever is there)
    for (const p of pins) {
      drawPinShape(ctx, p.x, p.y, p.color);
    }
  }, [getCtx, pins, drawPinShape]);

  /* ── Zoom ── */
  const zoomIn = useCallback(() => {
    setZoom(z => {
      const next = ZOOM_STEPS.find(s => s > z);
      return next ?? ZOOM_MAX;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => {
      const rev = [...ZOOM_STEPS].reverse();
      const next = rev.find(s => s < z);
      return next ?? ZOOM_MIN;
    });
  }, []);

  const zoomReset = useCallback(() => setZoom(100), []);

  // Initialize canvas on mount / mode change
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset
    drawingRef.current.undoStack = [];
    drawingRef.current.polygonPoints = [];
    drawingRef.current.isDrawing = false;
    setSaveDialogOpen(false);
    setMapName('');

    // Initialize pins and zoom from props
    setPins(initialPins || []);
    setShowPinInput(null);
    setPinLabel('');
    setZoom(100);

    if (mode === 'view' && initialDataURL) {
      // Load image for viewing
      const img = new Image();
      img.onload = () => {
        setViewImage(img);
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, 0, 0);
        // Draw pins on top in view mode
        for (const p of (initialPins || [])) {
          drawPinShape(ctx, p.x, p.y, p.color);
        }
      };
      img.src = initialDataURL;
    } else if (mode === 'edit' && initialDataURL) {
      // Re-edit a saved map
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, 0, 0);
        // Draw pins on top
        for (const p of (initialPins || [])) {
          drawPinShape(ctx, p.x, p.y, p.color);
        }
        saveUndoState();
      };
      img.src = initialDataURL;
    } else {
      // Fresh canvas
      clearCanvas();
      saveUndoState();
    }
  }, [isOpen, mode, initialDataURL, initialPins, clearCanvas, saveUndoState, drawPinShape]);

  /* ── Get canvas coordinates ── */
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  /* ── Drawing handlers ── */

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'view') return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    const dr = drawingRef.current;

    // Save state for undo before starting new operation
    if (tool !== 'polygon') {
      saveUndoState();
    }

    if (tool === 'pencil' || tool === 'eraser') {
      dr.isDrawing = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (tool === 'bucket') {
      saveUndoState();
      floodFill(ctx, Math.round(x), Math.round(y), color, CANVAS_W, CANVAS_H);
    } else if (tool === 'rect' || tool === 'ellipse') {
      dr.isDrawing = true;
      dr.startX = x;
      dr.startY = y;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'view') return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    const dr = drawingRef.current;

    if (!dr.isDrawing) return;

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (tool === 'rect' || tool === 'ellipse') {
      // Restore canvas to pre-draw state, then draw preview
      if (dr.undoStack.length > 0) {
        const lastState = dr.undoStack[dr.undoStack.length - 1];
        ctx.putImageData(lastState, 0, 0);
      }
      const w = x - dr.startX;
      const h = y - dr.startY;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;

      if (tool === 'rect') {
        ctx.fillRect(dr.startX, dr.startY, w, h);
        ctx.strokeRect(dr.startX, dr.startY, w, h);
      } else {
        ctx.beginPath();
        const cx = dr.startX + w / 2;
        const cy = dr.startY + h / 2;
        ctx.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'view') return;
    const dr = drawingRef.current;

    if (tool === 'pencil' || tool === 'eraser') {
      dr.isDrawing = false;
    } else if (tool === 'rect' || tool === 'ellipse') {
      if (!dr.isDrawing) return;
      dr.isDrawing = false;
      // Finalize the shape
      const ctx = getCtx();
      if (!ctx) return;
      const { x, y } = getPos(e);
      const w = x - dr.startX;
      const h = y - dr.startY;
      // Restore and redraw final
      if (dr.undoStack.length > 0) {
        const lastState = dr.undoStack[dr.undoStack.length - 1];
        ctx.putImageData(lastState, 0, 0);
      }
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;

      if (tool === 'rect') {
        ctx.fillRect(dr.startX, dr.startY, w, h);
        ctx.strokeRect(dr.startX, dr.startY, w, h);
      } else {
        ctx.beginPath();
        const cx = dr.startX + w / 2;
        const cy = dr.startY + h / 2;
        ctx.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'view') return;

    // Pin tool: place a pin at click position
    if (tool === 'pin') {
      const { x, y } = getPos(e);
      // Don't place pins too close to the edge
      if (x < 30 || x > CANVAS_W - 30 || y < 40 || y > CANVAS_H - 40) return;
      setShowPinInput({ x, y });
      setPinLabel('');
      return;
    }

    if (tool !== 'polygon') return;

    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    const dr = drawingRef.current;

    if (dr.polygonPoints.length === 0) {
      saveUndoState();
    }

    dr.polygonPoints.push(x, y);

    // Redraw polygon preview
    if (dr.undoStack.length > 0) {
      const lastState = dr.undoStack[dr.undoStack.length - 1];
      ctx.putImageData(lastState, 0, 0);
    }
    if (dr.polygonPoints.length >= 4) {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.moveTo(dr.polygonPoints[0], dr.polygonPoints[1]);
      for (let i = 2; i < dr.polygonPoints.length; i += 2) {
        ctx.lineTo(dr.polygonPoints[i], dr.polygonPoints[i + 1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw vertex dots
    ctx.fillStyle = '#ef4444';
    for (let i = 0; i < dr.polygonPoints.length; i += 2) {
      ctx.beginPath();
      ctx.arc(dr.polygonPoints[i], dr.polygonPoints[i + 1], 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'view') return;
    if (tool !== 'polygon') return;

    // Finalize polygon
    const dr = drawingRef.current;
    if (dr.polygonPoints.length < 6) {
      // Need at least 3 vertices (6 values)
      dr.polygonPoints = [];
      return;
    }

    // Redraw final
    const ctx = getCtx();
    if (!ctx) return;
    if (dr.undoStack.length > 0) {
      const lastState = dr.undoStack[dr.undoStack.length - 1];
      ctx.putImageData(lastState, 0, 0);
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(dr.polygonPoints[0], dr.polygonPoints[1]);
    for (let i = 2; i < dr.polygonPoints.length; i += 2) {
      ctx.lineTo(dr.polygonPoints[i], dr.polygonPoints[i + 1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    dr.polygonPoints = [];
  };

  /* ── Key bindings ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen || mode === 'view') return;
      if (e.key === 'Escape') {
        if (showPinInput) {
          setShowPinInput(null);
          setPinLabel('');
          return;
        }
        const dr = drawingRef.current;
        if (tool === 'polygon' && dr.polygonPoints.length > 0) {
          dr.polygonPoints = [];
          // Restore last undo state
          const ctx = getCtx();
          if (ctx && dr.undoStack.length > 0) {
            ctx.putImageData(dr.undoStack[dr.undoStack.length - 1], 0, 0);
          }
        } else {
          onClose();
        }
      }
      if (e.key === 'Enter' && tool === 'polygon') {
        handleDoubleClick({} as any);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        zoomReset();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, mode, tool, onClose, showPinInput, zoomIn, zoomOut, zoomReset]);

  /* ── Undo ── */
  const handleUndo = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const dr = drawingRef.current;
    if (dr.undoStack.length <= 1) return; // Keep at least initial state
    dr.undoStack.pop(); // Remove current state
    const prevState = dr.undoStack[dr.undoStack.length - 1];
    ctx.putImageData(prevState, 0, 0);
    // Redraw pins on top of restored state
    for (const p of pins) {
      drawPinShape(ctx, p.x, p.y, p.color);
    }
  }, [getCtx, pins, drawPinShape]);

  /* ── Clear ── */
  const handleClear = useCallback(() => {
    if (!window.confirm('确定要清空画布吗？此操作不可撤销。')) return;
    saveUndoState();
    clearCanvas();
    drawingRef.current.polygonPoints = [];
    setPins([]);
  }, [clearCanvas, saveUndoState]);

  /* ── Pin operations ── */
  const handleAddPin = useCallback(() => {
    if (!showPinInput || !pinLabel.trim()) return;
    const newPin: MapPin = {
      id: Date.now().toString(36),
      x: showPinInput.x,
      y: showPinInput.y,
      color: pinColor,
      label: pinLabel.trim(),
    };
    const updatedPins = [...pins, newPin];
    setPins(updatedPins);
    // Draw the new pin on canvas
    const ctx = getCtx();
    if (ctx) {
      drawPinShape(ctx, showPinInput.x, showPinInput.y, pinColor);
    }
    setShowPinInput(null);
    setPinLabel('');
  }, [showPinInput, pinLabel, pinColor, pins, getCtx, drawPinShape]);

  const handleRemovePin = useCallback((pinId: string) => {
    // Remove pin and redraw: restore undo state then redraw remaining pins
    const ctx = getCtx();
    if (!ctx) return;
    const dr = drawingRef.current;
    if (dr.undoStack.length > 0) {
      ctx.putImageData(dr.undoStack[dr.undoStack.length - 1], 0, 0);
    }
    const updated = pins.filter(p => p.id !== pinId);
    setPins(updated);
    for (const p of updated) {
      drawPinShape(ctx, p.x, p.y, p.color);
    }
  }, [pins, getCtx, drawPinShape]);

  /* ── Import Image ── */
  const handleImportImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImportMsg({ type: 'error', text: '请选择图片文件' });
      setTimeout(() => setImportMsg(null), 3000);
      e.target.value = '';
      return;
    }

    // Check file size (10MB limit)
    if (file.size > MAX_IMPORT_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      setImportMsg({ type: 'error', text: `图片文件过大（${sizeMB}MB），超过10MB限制，请压缩后重试` });
      setTimeout(() => setImportMsg(null), 4000);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ctx = getCtx();
        if (!ctx) return;

        saveUndoState();
        // White background first
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Scale image to fit canvas, maintaining aspect ratio
        const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
        const drawW = Math.round(img.width * scale);
        const drawH = Math.round(img.height * scale);
        const offsetX = Math.round((CANVAS_W - drawW) / 2);
        const offsetY = Math.round((CANVAS_H - drawH) / 2);

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        drawingRef.current.polygonPoints = [];
        setPins([]);

        const action = img.width > CANVAS_W || img.height > CANVAS_H ? '已缩小适配' : '已放大适配';
        setImportMsg({ type: 'success', text: `已导入图片 ${img.width}×${img.height} → ${drawW}×${drawH}（${action}）` });
        setTimeout(() => setImportMsg(null), 3000);
      };
      img.onerror = () => {
        setImportMsg({ type: 'error', text: '图片加载失败，请检查文件格式' });
        setTimeout(() => setImportMsg(null), 3000);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [getCtx, saveUndoState]);

  /* ── Random Map ── */
  const handleRandomMap = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    saveUndoState();
    generateRandomMap(ctx, CANVAS_W, CANVAS_H);
    drawingRef.current.polygonPoints = [];
    setPins([]);
    setImportMsg({ type: 'success', text: '世界地图已生成，可继续编辑或标注' });
    setTimeout(() => setImportMsg(null), 2500);
  }, [getCtx, saveUndoState]);

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    if (!mapName.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL('image/png');
    const thumb = await createThumbnail(dataURL, 300, 200);
    onSave(mapName.trim(), dataURL, thumb, pins);
    setSaveDialogOpen(false);
    setMapName('');
    onClose();
  }, [mapName, onSave, onClose, pins]);

  /* ── Render ── */
  if (!isOpen) return null;

  const isViewMode = mode === 'view';

  return (
    <div className="map-editor-overlay" onClick={isViewMode ? onClose : undefined}>
      <div
        className={`map-editor-container${isViewMode ? ' view-mode' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="map-editor-header">
          <h2>
            <Map size={18} /> {isViewMode ? '查看地图' : '新建地图'}
          </h2>
          <div className="map-zoom-controls">
            <button
              className="map-tool-btn map-zoom-btn"
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              title="缩小"
            ><Minus size={16} /></button>
            <span className="map-zoom-label">{zoom}%</span>
            <button
              className="map-tool-btn map-zoom-btn"
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              title="放大"
            ><Plus size={16} /></button>
            {zoom !== 100 && (
              <button
                className="map-tool-btn map-zoom-btn"
                onClick={zoomReset}
                title="重置缩放"
              ><RotateCcw size={16} /></button>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Toolbar */}
        {!isViewMode && (
          <div className="map-editor-toolbar">
            <div className="map-tool-group">
              <button
                className={`map-tool-btn${tool === 'pencil' ? ' active' : ''}`}
                onClick={() => { setTool('pencil'); drawingRef.current.polygonPoints = []; }}
                title="铅笔 - 自由手绘"
              ><Pencil size={14} /> 铅笔</button>
              <button
                className={`map-tool-btn${tool === 'eraser' ? ' active' : ''}`}
                onClick={() => { setTool('eraser'); drawingRef.current.polygonPoints = []; }}
                title="橡皮擦"
              ><Eraser size={14} /> 橡皮</button>
            </div>

            <div className="map-tool-divider" />

            <div className="map-tool-group">
              <button
                className={`map-tool-btn${tool === 'rect' ? ' active' : ''}`}
                onClick={() => { setTool('rect'); drawingRef.current.polygonPoints = []; }}
                title="矩形"
              ><Square size={14} /> 矩形</button>
              <button
                className={`map-tool-btn${tool === 'ellipse' ? ' active' : ''}`}
                onClick={() => { setTool('ellipse'); drawingRef.current.polygonPoints = []; }}
                title="椭圆"
              ><Circle size={14} /> 椭圆</button>
              <button
                className={`map-tool-btn${tool === 'polygon' ? ' active' : ''}`}
                onClick={() => { setTool('polygon'); drawingRef.current.polygonPoints = []; }}
                title="多边形 - 点击添加顶点，双击闭合"
              ><Hexagon size={14} /> 多边形</button>
            </div>

            <div className="map-tool-divider" />

            <div className="map-tool-group">
              <button
                className={`map-tool-btn${tool === 'bucket' ? ' active' : ''}`}
                onClick={() => { setTool('bucket'); drawingRef.current.polygonPoints = []; }}
                title="颜料桶 - 填充区域"
              ><PaintBucket size={14} /> 填充</button>
            </div>

            <div className="map-tool-divider" />

            <div className="map-tool-group">
              <button
                className={`map-tool-btn${tool === 'pin' ? ' active' : ''}`}
                onClick={() => { setTool('pin'); drawingRef.current.polygonPoints = []; }}
                title="图钉 - 点击地图放置标注"
              ><MapPinIcon size={14} /> 图钉</button>
              {tool === 'pin' && (
                <div className="map-pin-colors">
                  {PIN_COLORS.map(c => (
                    <button
                      key={c}
                      className={`map-pin-color-btn${pinColor === c ? ' active' : ''}`}
                      style={{ background: c, border: c === '#FFFFFF' ? '2px solid #d1d5db' : '2px solid transparent' }}
                      onClick={() => setPinColor(c)}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="map-tool-divider" />

            <input
              type="color"
              className="map-color-input"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="选择颜色"
            />
            <input
              type="range"
              className="map-brush-slider"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              title={`画笔大小: ${brushSize}`}
            />
            <span className="map-brush-label">{brushSize}px</span>

            <div className="map-tool-divider" />

            <button className="map-tool-btn" onClick={handleUndo} title="撤销 (Ctrl+Z)"><Undo2 size={14} /> 撤销</button>
            <button className="map-tool-btn" onClick={handleClear} title="清空画布"><Trash2 size={14} /> 清除</button>

            <div className="map-tool-divider" />

            <button
              className="map-tool-btn"
              onClick={() => fileInputRef.current?.click()}
              title="导入图片（最大10MB）"
            ><ImagePlus size={14} /> 导入图片</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImportImage}
            />

            <div style={{ flex: 1 }} />

            <button className="map-tool-btn primary-action" onClick={handleRandomMap} title="随机生成世界地图（海洋、大陆、地形）">
              <Dices size={14} /> 随机世界地图
            </button>
            <button className="map-tool-btn primary-action" onClick={() => setSaveDialogOpen(true)} title="保存地图">
              <Save size={14} /> 保存
            </button>
          </div>
        )}

        {/* Pin label input popup */}
        {showPinInput && (
          <div className="map-pin-input-overlay" onClick={() => { setShowPinInput(null); setPinLabel(''); }}>
            <div className="map-pin-input-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="map-pin-input-title">
                <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: pinColor, border: '1px solid rgba(0,0,0,0.2)', verticalAlign: 'middle', marginRight: 6 }} />
                添加图钉标注
              </div>
              <input
                className="plugin-input"
                placeholder="输入标注内容..."
                value={pinLabel}
                onChange={(e) => setPinLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPin();
                  if (e.key === 'Escape') { setShowPinInput(null); setPinLabel(''); }
                }}
                autoFocus
              />
              <div className="plugin-row-btns" style={{ marginTop: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={handleAddPin} disabled={!pinLabel.trim()}>
                  <Check size={16} /> 确认
                </button>
                <button className="btn btn-sm" onClick={() => { setShowPinInput(null); setPinLabel(''); }}>
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="map-editor-canvas-wrap">
          {importMsg && (
            <div className={`map-import-toast${importMsg.type === 'error' ? ' error' : ' success'}`}>
              {importMsg.type === 'error' ? <AlertTriangle size={14} /> : <Check size={16} />} {importMsg.text}
            </div>
          )}
          <div className="map-canvas-viewport">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{
                width: CANVAS_W * zoom / 100,
                height: CANVAS_H * zoom / 100,
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
            />
          </div>
        </div>

        {/* Footer - save dialog, pin legend & actions */}
        {!isViewMode && (
          <div className="map-editor-footer">
            {/* Pin legend */}
            {pins.length > 0 && (
              <div className="map-pin-legend">
                {pins.map(p => (
                  <div key={p.id} className="map-pin-legend-item" title={p.label}>
                    <span className="map-pin-legend-dot" style={{ background: p.color, border: p.color === '#FFFFFF' ? '2px solid #d1d5db' : '2px solid rgba(0,0,0,0.2)' }} />
                    <span className="map-pin-legend-label">{p.label}</span>
                    <button
                      className="map-pin-legend-del"
                      onClick={() => handleRemovePin(p.id)}
                      title="删除此图钉"
                    ><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="map-save-row">
              {saveDialogOpen ? (
                <div className="map-save-dialog">
                  <input
                    type="text"
                    placeholder="输入地图名称..."
                    value={mapName}
                    onChange={(e) => setMapName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveDialogOpen(false); }}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!mapName.trim()}>
                    <Check size={16} /> 确认保存
                  </button>
                  <button className="btn btn-sm" onClick={() => { setSaveDialogOpen(false); setMapName(''); }}>
                    取消
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary" onClick={() => setSaveDialogOpen(true)}>
                  <Save size={14} /> 保存地图
                </button>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {tool === 'polygon' ? '点击添加顶点 · 双击闭合 · Esc 取消' :
               tool === 'pin' ? '点击地图放置图钉 · 点击图例移除' :
               '拖拽绘制 · Ctrl+Z 撤销'}
            </span>
          </div>
        )}

        {isViewMode && (
          <div className="map-editor-footer">
            {/* Pin legend in view mode */}
            {pins.length > 0 && (
              <div className="map-pin-legend">
                {pins.map(p => (
                  <div key={p.id} className="map-pin-legend-item" title={p.label}>
                    <span className="map-pin-legend-dot" style={{ background: p.color, border: p.color === '#FFFFFF' ? '2px solid #d1d5db' : '2px solid rgba(0,0,0,0.2)' }} />
                    <span className="map-pin-legend-label">{p.label}</span>
                  </div>
                ))}
              </div>
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <MapPinIcon size={14} /> 只读模式 — 点击背景或 <X size={14} /> 关闭
            </span>
            <button className="btn" onClick={onClose}>关闭</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapEditor;
