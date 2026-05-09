import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Shared Types ────────────────────────────────────────────────────────────
interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: "rect" | "rounded" | "circle" | "blob" | "network";
  color: string;
  icon?: string;
  fill?: string;
  processing?: boolean;
}

interface EdgeDef {
  id: string;
  from: string;
  to: string;
  label?: string;
  labelPos?: { x: number; y: number };
  dashed?: boolean;
  showArrow?: boolean;
  curved?: boolean;
  cp?: { x: number; y: number };
  waypoints?: Array<{ x: number; y: number }>;
}

interface StepDef {
  edgeId: string;
  desc: string;
}

export interface WorkflowConfig {
  title: string;
  subtitle: string;
  accentColor: string;
  labelScale?: number;
  width: number;
  height: number;
  nodes: NodeDef[];
  edges: EdgeDef[];
  steps: StepDef[];
  groupBox?: {
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
  };
}

// ─── Network Icon (blockchain/smart-contract node look) ──────────────────────
const NetworkIcon: React.FC<{
  cx: number;
  cy: number;
  r: number;
  color: string;
}> = ({ cx, cy, r, color }) => {
  const pts = [
    { x: cx, y: cy - r },
    { x: cx + r * 0.87, y: cy - r * 0.5 },
    { x: cx + r * 0.87, y: cy + r * 0.5 },
    { x: cx, y: cy + r },
    { x: cx - r * 0.87, y: cy + r * 0.5 },
    { x: cx - r * 0.87, y: cy - r * 0.5 },
  ];
  const edges2 = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 0],
    [0, 3],
    [1, 4],
    [2, 5],
  ];
  return (
    <g>
      {edges2.map(([a, b], i) => (
        <line
          key={i}
          x1={pts[a].x}
          y1={pts[a].y}
          x2={pts[b].x}
          y2={pts[b].y}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.9}
        />
      ))}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={r * 0.15}
          fill={color}
          opacity={0.9}
        />
      ))}
    </g>
  );
};

// Removed generic ArrowDefs since markers are generated per-edge

// ─── Single node renderer ─────────────────────────────────────────────────────
const WorkflowNode: React.FC<{
  node: NodeDef;
  active?: boolean;
  visited?: boolean;
  labelScale?: number;
}> = ({ node, active, visited, labelScale = 1 }) => {
  const {
    x,
    y,
    w,
    h,
    shape = "rounded",
    color,
    label,
    icon,
    fill,
    processing,
  } = node;

  const nodeOpacity = visited ? 1 : 0.4;
  const strokeWidth = active ? 3 : 2;
  const labelFontSize = 11 * labelScale;
  const multiLineOffset = 12 * labelScale;

  if (shape === "network") {
    return (
      <g style={{ opacity: nodeOpacity }}>
        <NetworkIcon cx={x} cy={y} r={w / 2} color={color} />
        <text
          x={x}
          y={y + w / 2 + 14}
          textAnchor="middle"
          fontSize={labelFontSize}
          fill={color}
          fontFamily="'JetBrains Mono',monospace"
          fontWeight="500"
        >
          {label}
        </text>
      </g>
    );
  }

  if (shape === "circle") {
    return (
      <g style={{ opacity: nodeOpacity }}>
        <circle
          cx={x}
          cy={y}
          r={w / 2}
          fill={fill || `${color}14`}
          stroke={color}
          strokeWidth={strokeWidth}
        />
        {icon && (
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={18}
          >
            {icon}
          </text>
        )}
        <text
          x={x}
          y={y + w / 2 + 14}
          textAnchor="middle"
          fontSize={labelFontSize}
          fill={color}
          fontFamily="'JetBrains Mono',monospace"
          fontWeight="500"
        >
          {label}
        </text>
      </g>
    );
  }

  // rect / rounded (default)
  const rx = shape === "rounded" ? 10 : 4;
  const lines = label.split("\n");

  return (
    <g style={{ opacity: nodeOpacity }}>
      {fill && (
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={rx}
          fill={fill}
          opacity={0.25}
        />
      )}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={rx}
        fill={fill ? "transparent" : `${color}0d`}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      {icon && (
        <text
          x={x + w / 2 - 8}
          y={y - h / 2 + 16}
          textAnchor="middle"
          fontSize={13}
          opacity={0.8}
        >
          {icon}
        </text>
      )}
      {processing && (
        <text
          x={x + w / 2 - 24}
          y={y - h / 2 + 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={14}
          fill={fill ? "#ffffff" : color}
          opacity={0.95}
        >
          ⚙
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${x + w / 2 - 24} ${y - h / 2 + 16}`}
            to={`360 ${x + w / 2 - 24} ${y - h / 2 + 16}`}
            dur="1.6s"
            repeatCount="indefinite"
          />
        </text>
      )}
      {lines.map((ln, i) => (
        <text
          key={i}
          x={x}
          y={
            y +
            (lines.length === 1
              ? 0
              : (i - (lines.length - 1) / 2) * multiLineOffset)
          }
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={labelFontSize}
          fill={color}
          fontFamily="'JetBrains Mono',monospace"
          fontWeight="600"
        >
          {ln}
        </text>
      ))}
    </g>
  );
};

// ─── Edge renderer ────────────────────────────────────────────────────────────
function getShapeOffset(node: NodeDef, targetX: number, targetY: number) {
  const dx = targetX - node.x;
  const dy = targetY - node.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  if (node.shape === "circle" || node.shape === "network") {
    const r = node.w / 2 + 2;
    return { dx: ux * r, dy: uy * r };
  } else {
    const hw = node.w / 2 + 2;
    const hh = node.h / 2 + 2;
    const off = Math.min(
      Math.abs(hw / (ux === 0 ? 0.001 : ux)),
      Math.abs(hh / (uy === 0 ? 0.001 : uy)),
    );
    return { dx: ux * off, dy: uy * off };
  }
}

function computeEdgePath(
  fromNode: NodeDef,
  toNode: NodeDef,
  edge: EdgeDef,
): { d: string; midX: number; midY: number } {
  if (edge.waypoints && edge.waypoints.length > 0) {
    const firstPoint = edge.waypoints[0];
    const lastPoint = edge.waypoints[edge.waypoints.length - 1];
    if (!firstPoint || !lastPoint) {
      return { d: "", midX: fromNode.x, midY: fromNode.y };
    }

    const fromOffset = getShapeOffset(fromNode, firstPoint.x, firstPoint.y);
    const toOffset = getShapeOffset(toNode, lastPoint.x, lastPoint.y);
    const start = {
      x: fromNode.x + fromOffset.dx,
      y: fromNode.y + fromOffset.dy,
    };
    const end = { x: toNode.x + toOffset.dx, y: toNode.y + toOffset.dy };
    const points = [start, ...edge.waypoints, end];

    const segments = points.slice(1).map((point, index) => {
      const prev = points[index];
      return Math.hypot(point.x - prev.x, point.y - prev.y);
    });
    const totalLength =
      segments.reduce((sum, segment) => sum + segment, 0) || 1;
    let distance = 0;
    const half = totalLength / 2;
    let midX = (start.x + end.x) / 2;
    let midY = (start.y + end.y) / 2;

    for (let i = 0; i < segments.length; i += 1) {
      const prev = points[i];
      const next = points[i + 1];
      const segmentLength = segments[i];
      if (!prev || !next || segmentLength === undefined) continue;
      if (distance + segmentLength >= half) {
        const t = (half - distance) / segmentLength;
        midX = prev.x + (next.x - prev.x) * t;
        midY = prev.y + (next.y - prev.y) * t;
        break;
      }
      distance += segmentLength;
    }

    return {
      d: points
        .map(
          (point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
        )
        .join(" "),
      midX,
      midY,
    };
  }

  if (edge.curved && edge.cp) {
    const { cp } = edge;
    const fOff = getShapeOffset(fromNode, cp.x, cp.y);
    const sx = fromNode.x + fOff.dx;
    const sy = fromNode.y + fOff.dy;

    const tOff = getShapeOffset(toNode, cp.x, cp.y);
    const ex = toNode.x + tOff.dx;
    const ey = toNode.y + tOff.dy;

    const d = `M ${sx} ${sy} Q ${cp.x} ${cp.y} ${ex} ${ey}`;
    const midX = (sx + 2 * cp.x + ex) / 4;
    const midY = (sy + 2 * cp.y + ey) / 4;
    return { d, midX, midY };
  }

  const fOff = getShapeOffset(fromNode, toNode.x, toNode.y);
  const tOff = getShapeOffset(toNode, fromNode.x, fromNode.y);

  const sx = fromNode.x + fOff.dx;
  const sy = fromNode.y + fOff.dy;
  const ex = toNode.x + tOff.dx;
  const ey = toNode.y + tOff.dy;

  return {
    d: `M ${sx} ${sy} L ${ex} ${ey}`,
    midX: (sx + ex) / 2,
    midY: (sy + ey) / 2,
  };
}

interface AnimatedEdgeProps {
  edge: EdgeDef;
  fromNode: NodeDef;
  toNode: NodeDef;
  active: boolean;
  visited: boolean;
  accentColor: string;
  diagramId: string;
  labelScale?: number;
}

const AnimatedEdge: React.FC<AnimatedEdgeProps> = ({
  edge,
  fromNode,
  toNode,
  active,
  diagramId,
  labelScale = 1,
}) => {
  const { d, midX, midY } = computeEdgePath(fromNode, toNode, edge);
  const color = fromNode.color;
  const markerId = `ah-${diagramId}-${edge.id}`;
  const showArrow = edge.showArrow ?? true;

  const labelX = edge.labelPos?.x ?? midX;
  const labelY = edge.labelPos?.y ?? midY;

  return (
    <g className="transition-all duration-300">
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="3.5"
          orient="auto"
        >
          <path
            d="M0,0 L0,7 L8,3.5 z"
            fill={color}
            opacity={active ? 1 : 0.6}
          />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={active ? 2 : 1.5}
        strokeDasharray={edge.dashed ? "5,4" : undefined}
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
        opacity={active ? 1 : 0.6}
        className="transition-all duration-300"
      />
      <circle r={3} fill="#fff" filter={`drop-shadow(0 0 6px ${color})`}>
        <animateMotion dur="1.5s" repeatCount="indefinite" path={d} />
      </circle>
      {edge.label && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontSize={10 * labelScale}
          fill={active ? "#e5e7eb" : "#888"}
          fontFamily="'JetBrains Mono',monospace"
          fontWeight={active ? "700" : "500"}
          className="transition-all duration-300"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
};

// ─── Generic Animated Workflow Diagram ────────────────────────────────────────
const WorkflowDiagram: React.FC<{
  config: WorkflowConfig;
  onReset: () => void;
  step: number;
  diagramId: string;
  instantDesktopPan?: boolean;
}> = ({ config, onReset, step, diagramId, instantDesktopPan = false }) => {
  const { width, height, nodes, edges, steps, groupBox, accentColor } = config;
  const labelScale = config.labelScale ?? 1;
  const minZoom = 1;
  const maxZoom = 2.5;
  const zoomStep = 0.03;
  const holdToPanMouseMs = 180;
  const holdToPanMs = 220;

  const visitedEdgeIds = new Set(edges.map((e) => e.id));
  const activeEdgeId =
    step >= 0 && step < steps.length ? steps[step].edgeId : null;

  const visitedNodeIds = new Set(nodes.map((n) => n.id));
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoldPending, setIsHoldPending] = useState(false);
  const [lastPointerType, setLastPointerType] = useState<
    "mouse" | "touch" | "pen"
  >("touch");
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);
  const holdDraftRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [dragStart, setDragStart] = useState<{
    pointerId: number;
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const viewBoxWidth = width / zoom;
  const viewBoxHeight = height / zoom;
  const maxPanX = Math.max(0, (width - viewBoxWidth) / 2);
  const maxPanY = Math.max(0, (height - viewBoxHeight) / 2);
  const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  const viewBoxMinX = width / 2 - viewBoxWidth / 2 - clampedPanX;
  const viewBoxMinY = height / 2 - viewBoxHeight / 2 - clampedPanY;

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const stopDragging = () => {
    clearHoldTimer();
    holdDraftRef.current = null;
    pinchRef.current = null;
    setIsDragging(false);
    setIsHoldPending(false);
    setDragStart(null);
  };

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, []);

  const updateZoom = useCallback((next: number) => {
    setZoom(() => {
      const z = Math.max(minZoom, Math.min(maxZoom, next));
      if (z === minZoom) {
        setPanX(0);
        setPanY(0);
        setIsDragging(false);
        setIsHoldPending(false);
        setDragStart(null);
        holdDraftRef.current = null;
        clearHoldTimer();
      }
      return z;
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY > 0 ? -zoomStep : zoomStep;
      updateZoom(zoom + delta);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [updateZoom, zoom]);

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const first = touches[0];
    const second = touches[1];
    if (!first || !second) return 0;
    const dx = second.clientX - first.clientX;
    const dy = second.clientY - first.clientY;
    return Math.hypot(dx, dy);
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/5"
      style={{
        background: "linear-gradient(160deg, #08090D 0%, #0d0f18 100%)",
        fontFamily: "'JetBrains Mono','Fira Mono',monospace",
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between border-b border-white/5 px-5 py-3"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
          </div>
          <span className="text-[11px] tracking-wider text-gray-400">
            <span style={{ fontSize: `${11 * labelScale}px` }}></span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onReset();
              updateZoom(1);
            }}
            className="rounded border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-gray-200 transition-colors hover:bg-white/10"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => updateZoom(zoom - zoomStep)}
            className="rounded border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-gray-200 transition-colors hover:bg-white/10"
          >
            -
          </button>
          <span className="w-[44px] text-center font-mono text-[10px] text-gray-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => updateZoom(zoom + zoomStep)}
            className="rounded border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-gray-200 transition-colors hover:bg-white/10"
          >
            +
          </button>
        </div>
      </div>

      {/* Diagram SVG */}
      <div
        ref={viewportRef}
        className={[
          "flex w-full items-center justify-center p-6 select-none",
          zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={(event) => {
          if (zoom <= 1) return;
          if (event.pointerType === "touch") return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          setLastPointerType(
            event.pointerType === "mouse" || event.pointerType === "pen"
              ? event.pointerType
              : "touch",
          );
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);

          clearHoldTimer();
          if (instantDesktopPan && event.pointerType === "mouse") {
            setIsDragging(true);
            setIsHoldPending(false);
            setDragStart({
              pointerId: event.pointerId,
              mouseX: event.clientX,
              mouseY: event.clientY,
              panX: clampedPanX,
              panY: clampedPanY,
            });
            return;
          }

          setIsHoldPending(true);
          holdDraftRef.current = {
            pointerId: event.pointerId,
            lastX: event.clientX,
            lastY: event.clientY,
            panX: clampedPanX,
            panY: clampedPanY,
          };

          holdTimerRef.current = setTimeout(
            () => {
              const draft = holdDraftRef.current;
              if (!draft || draft.pointerId !== event.pointerId) return;

              setIsDragging(true);
              setIsHoldPending(false);
              setDragStart({
                pointerId: draft.pointerId,
                mouseX: draft.lastX,
                mouseY: draft.lastY,
                panX: draft.panX,
                panY: draft.panY,
              });
            },
            event.pointerType === "mouse" ? holdToPanMouseMs : holdToPanMs,
          );
        }}
        onPointerMove={(event) => {
          const holdDraft = holdDraftRef.current;
          if (holdDraft && holdDraft.pointerId === event.pointerId) {
            holdDraft.lastX = event.clientX;
            holdDraft.lastY = event.clientY;
          }

          if (!isDragging || !dragStart || !viewportRef.current) return;
          if (event.pointerId !== dragStart.pointerId) return;
          const rect = viewportRef.current.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          const deltaX =
            ((event.clientX - dragStart.mouseX) / rect.width) * viewBoxWidth;
          const deltaY =
            ((event.clientY - dragStart.mouseY) / rect.height) * viewBoxHeight;

          setPanX(dragStart.panX + deltaX);
          setPanY(dragStart.panY + deltaY);
        }}
        onPointerUp={(event) => {
          if (dragStart && event.pointerId === dragStart.pointerId) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          stopDragging();
        }}
        onPointerCancel={(event) => {
          if (dragStart && event.pointerId === dragStart.pointerId) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          stopDragging();
        }}
        onPointerLeave={(event) => {
          if (dragStart && event.pointerId === dragStart.pointerId) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          stopDragging();
        }}
        onTouchStart={(event) => {
          setLastPointerType("touch");
          if (event.touches.length === 2) {
            const distance = getTouchDistance(event.touches);
            if (distance > 0) {
              event.preventDefault();
              stopDragging();
              pinchRef.current = {
                startDistance: distance,
                startZoom: zoom,
              };
            }
            return;
          }

          if (event.touches.length !== 1 || zoom <= 1) return;
          const touch = event.touches[0];
          if (!touch) return;

          event.preventDefault();
          setIsDragging(true);
          setDragStart({
            pointerId: -1,
            mouseX: touch.clientX,
            mouseY: touch.clientY,
            panX: clampedPanX,
            panY: clampedPanY,
          });
        }}
        onTouchMove={(event) => {
          if (!viewportRef.current) return;

          if (event.touches.length === 2) {
            const pinch = pinchRef.current;
            if (!pinch || pinch.startDistance <= 0) return;

            const currentDistance = getTouchDistance(event.touches);
            if (currentDistance <= 0) return;

            event.preventDefault();
            updateZoom(
              (pinch.startZoom * currentDistance) / pinch.startDistance,
            );
            return;
          }

          const touch = event.touches[0];
          if (!touch) return;
          if (zoom <= 1) return;
          if (!isDragging || !dragStart || dragStart.pointerId !== -1) return;
          event.preventDefault();
          const rect = viewportRef.current.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          const deltaX =
            ((touch.clientX - dragStart.mouseX) / rect.width) * viewBoxWidth;
          const deltaY =
            ((touch.clientY - dragStart.mouseY) / rect.height) * viewBoxHeight;
          setPanX(dragStart.panX + deltaX);
          setPanY(dragStart.panY + deltaY);
        }}
        onTouchEnd={(event) => {
          if (event.touches.length === 1 && zoom > 1) {
            pinchRef.current = null;
            const touch = event.touches[0];
            if (!touch) return;
            setIsDragging(true);
            setDragStart({
              pointerId: -1,
              mouseX: touch.clientX,
              mouseY: touch.clientY,
              panX: clampedPanX,
              panY: clampedPanY,
            });
            return;
          }
          stopDragging();
        }}
        onTouchCancel={() => {
          stopDragging();
        }}
        style={{
          touchAction: zoom > 1 ? "none" : "pan-y",
          overscrollBehavior: "contain",
        }}
      >
        <div className="relative w-full max-w-full">
          {zoom > 1 && !isDragging ? (
            <div className="pointer-events-none absolute top-2 right-2 z-10 rounded bg-black/45 px-2 py-1 font-mono text-[10px] text-gray-200">
              {isHoldPending
                ? "Hold..."
                : lastPointerType === "mouse" && !instantDesktopPan
                  ? "Hold left click to pan"
                  : lastPointerType === "mouse"
                    ? "Scroll to zoom · Drag to pan"
                    : "Pinch to zoom · Drag to pan"}
            </div>
          ) : null}
          <svg
            width="100%"
            height="100%"
            viewBox={`${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}`}
            style={{ display: "block", height: "auto" }}
          >
            {/* (Markers are now defined per-edge) */}

            {/* Group box */}
            {groupBox && (
              <g>
                <rect
                  x={groupBox.x}
                  y={groupBox.y}
                  width={groupBox.w}
                  height={groupBox.h}
                  rx={14}
                  fill={`${groupBox.color}05`}
                  stroke={`${groupBox.color}30`}
                  strokeWidth={1.5}
                />
                <text
                  x={groupBox.x + 24}
                  y={groupBox.y + 28}
                  textAnchor="start"
                  fontSize={14 * labelScale}
                  fill={groupBox.color}
                  fontFamily="'JetBrains Mono',monospace"
                  fontWeight="700"
                  opacity={0.8}
                >
                  {groupBox.label}
                </text>
              </g>
            )}

            {/* Edges */}
            {edges.map((edge) => {
              const fn = nodeMap[edge.from];
              const tn = nodeMap[edge.to];
              if (!fn || !tn) return null;
              return (
                <AnimatedEdge
                  key={edge.id}
                  edge={edge}
                  fromNode={fn}
                  toNode={tn}
                  active={edge.id === activeEdgeId}
                  visited={visitedEdgeIds.has(edge.id)}
                  accentColor={accentColor}
                  diagramId={diagramId}
                  labelScale={labelScale}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <WorkflowNode
                key={node.id}
                node={node}
                active={
                  activeEdgeId !== null &&
                  edges.some(
                    (e) =>
                      e.id === activeEdgeId &&
                      (e.from === node.id || e.to === node.id),
                  )
                }
                visited={visitedNodeIds.has(node.id) || step === -1}
                labelScale={labelScale}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PRICE INTEGRITY CRE WORKFLOW
// Image layout:
//   Top-right (outside group): Chainlink Price Stream → Real-time price streaming
//   Real-time price streaming → In-app ledger (sync, going down)
//   Inside group (left): Chainlink Price Stream (monitor icon)
//   In-app ledger → Compare prices in a window (center of group)
//   Chainlink Price Stream → Compare prices in a window
//   Compare prices → Price matching score → Blockchain
// ═══════════════════════════════════════════════════════════════════════════════
export const PRICE_INTEGRITY_CONFIG: WorkflowConfig = {
  title: "Price Integrity CRE Workflow",
  subtitle: "price-integrity-cre.workflow",
  accentColor: "#A78BFA",
  labelScale: 1.1,
  width: 1480,
  height: 860,
  groupBox: {
    label: "Switchboard TEE",
    x: 388,
    y: 20,
    w: 530,
    h: 820,
    color: "#D1D5DB",
  },
  nodes: [
    // Left source nodes (outside group)
    {
      id: "chainlink_feed",
      label: "Binance/Chainlink\nData Feeds\n\n⬡",
      x: 170,
      y: 148,
      w: 280,
      h: 200,
      shape: "rounded",
      color: "#D1D5DB",
    },
    {
      id: "tickx_api",
      label: "TickX price API\n\n↙",
      x: 170,
      y: 430,
      w: 280,
      h: 200,
      shape: "rounded",
      color: "#D1D5DB",
    },

    // Switchboard TEE — vertical task chain (inside group)
    {
      id: "http_task_1",
      label: "HTTP Task",
      x: 653,
      y: 148,
      w: 220,
      h: 88,
      shape: "rounded",
      color: "#D1D5DB",
    },
    {
      id: "http_task_2",
      label: "HTTP Task",
      x: 653,
      y: 310,
      w: 220,
      h: 88,
      shape: "rounded",
      color: "#D1D5DB",
    },
    {
      id: "comparison_task",
      label: "Comparision Task",
      x: 653,
      y: 472,
      w: 220,
      h: 88,
      shape: "rounded",
      color: "#D1D5DB",
    },
    // Score payload (purple, inside group, bottom)
    {
      id: "score_payload",
      label:
        "6 Switchboard feeds\n1 ohlc_mae_bps\n2 ohlc_p95_bps\n3 ohlc_max_bps\n4 direction_match_bps\n5 outlier_count\n6 score_bps",
      x: 653,
      y: 680,
      w: 232,
      h: 230,
      shape: "rounded",
      color: "#A78BFA",
      fill: "#A78BFA",
    },

    // Price Integrity Contract — outer frame (right, outside group)
    {
      id: "contract_box",
      label: "Price Integrity Contract\n\n\n\n\n\n\n\n\n",
      x: 1270,
      y: 250,
      w: 400,
      h: 380,
      shape: "rounded",
      color: "#D1D5DB",
    },
    // Report payload — green box inside contract frame
    {
      id: "report_payload",
      label:
        "Report\nepoch_id\nwindow_start\nscore_bps\nis_passed\nfailure_flags",
      x: 1330,
      y: 260,
      w: 200,
      h: 195,
      shape: "rounded",
      color: "#00D084",
      fill: "#00D084",
    },
  ],
  edges: [
    // Chainlink → HTTP Task 1 (horizontal arrow, "ohlc source of truth")
    {
      id: "e1",
      from: "chainlink_feed",
      to: "http_task_1",
      label: "ohlc source of truth",
      labelPos: { x: 460, y: 130 },
    },
    // TickX API → HTTP Task 2 ("attested OHLC") — goes right then up to task 2
    {
      id: "e2",
      from: "tickx_api",
      to: "http_task_2",
      label: "attested OHLC",
      labelPos: { x: 468, y: 296 },
      waypoints: [
        { x: 388, y: 430 },
        { x: 388, y: 310 },
      ],
    },
    // HTTP Task 1 → HTTP Task 2 (straight down)
    {
      id: "e3",
      from: "http_task_1",
      to: "http_task_2",
      label: "",
    },
    // HTTP Task 2 → Comparison Task (straight down)
    {
      id: "e4",
      from: "http_task_2",
      to: "comparison_task",
      label: "",
    },
    // Comparison Task → Score payload (straight down)
    {
      id: "e5",
      from: "comparison_task",
      to: "score_payload",
      label: "",
    },
    // Score payload → Report payload (L-shape: right then up, arrow at end)
    {
      id: "e6",
      from: "score_payload",
      to: "report_payload",
      label: "",
      waypoints: [
        { x: 918, y: 680 },
        { x: 1060, y: 680 },
        { x: 1060, y: 430 },
      ],
    },
  ],
  steps: [
    {
      edgeId: "e1",
      desc: "Binance/Chainlink Data Feeds provide the OHLC source of truth to the first HTTP Task in Switchboard TEE.",
    },
    {
      edgeId: "e2",
      desc: "TickX price API sends attested OHLC data into the second HTTP Task.",
    },
    {
      edgeId: "e3",
      desc: "The first HTTP Task forwards normalized data to the second HTTP Task.",
    },
    {
      edgeId: "e4",
      desc: "The second HTTP Task sends combined input into the Comparison Task.",
    },
    {
      edgeId: "e5",
      desc: "The Comparison Task computes scoring metrics and produces the payload fields including score_bps.",
    },
    {
      edgeId: "e6",
      desc: "The scoring payload is routed to the Price Integrity Contract report node.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PROOF OF RESERVE WORKFLOW
// Image layout:
//   Outside group top-right: Vault contract (network), top
//   Outside group left: Balance engine
//   Balance engine → Vault contract (sync deposits/withdrawals, curved)
//   Balance engine → Accounting data (provide)
//   Inside group (large rounded box):
//     Left: Accounting data
//     Right: On-chain liquidity ← Vault contract (network, far right)
//     Bottom center: Reconciliation job (with CRE icon)
//     Reconciliation job → Proof of Reserve → Smart contracts (network)
// ═══════════════════════════════════════════════════════════════════════════════
export const PROOF_OF_RESERVE_CONFIG: WorkflowConfig = {
  title: "Proof of Reserve Workflow",
  subtitle: "proof-of-reserve.workflow",
  accentColor: "#6EE7B7",
  width: 660,
  height: 540,
  groupBox: {
    label: "Proof of Reserve workflow",
    x: 20,
    y: 255,
    w: 620,
    h: 265,
    color: "#6EE7B7",
  },
  nodes: [
    // Outside group
    {
      id: "vault_top",
      label: "Vault contract",
      x: 545,
      y: 65,
      w: 42,
      h: 42,
      shape: "network",
      color: "#818CF8",
    },
    {
      id: "balance",
      label: "Balance engine",
      x: 160,
      y: 145,
      w: 150,
      h: 50,
      shape: "rounded",
      color: "#F6AD55",
    },
    // Inside group
    {
      id: "accounting",
      label: "Accounting data",
      x: 155,
      y: 325,
      w: 145,
      h: 48,
      shape: "rect",
      color: "#F472B6",
    },
    {
      id: "vault_right",
      label: "Vault contract",
      x: 590,
      y: 325,
      w: 42,
      h: 42,
      shape: "network",
      color: "#818CF8",
    },
    {
      id: "liquidity",
      label: "On-chain\nliquidity",
      x: 445,
      y: 325,
      w: 135,
      h: 48,
      shape: "rect",
      color: "#60A5FA",
    },
    {
      id: "recon",
      label: "Reconciliation\njob",
      x: 270,
      y: 420,
      w: 155,
      h: 56,
      shape: "rounded",
      color: "#6EE7B7",
      icon: "〜",
    },
    {
      id: "por",
      label: "Proof of Reserve",
      x: 455,
      y: 450,
      w: 135,
      h: 46,
      shape: "rect",
      color: "#FB923C",
    },
    {
      id: "smarts",
      label: "Smart contracts",
      x: 600,
      y: 450,
      w: 42,
      h: 42,
      shape: "network",
      color: "#E879F9",
    },
  ],
  edges: [
    // Balance engine → Vault contract top (sync deposits/withdrawals)
    {
      id: "e1",
      from: "balance",
      to: "vault_top",
      label: "sync deposits/withdrawals",
      labelPos: { x: 395, y: 82 },
      curved: true,
      cp: { x: 395, y: 68 },
    },
    // Balance engine → Accounting data (provide)
    {
      id: "e2",
      from: "balance",
      to: "accounting",
      label: "provide",
      labelPos: { x: 120, y: 235 },
    },
    // Vault contract (right) → On-chain liquidity
    {
      id: "e3",
      from: "vault_right",
      to: "liquidity",
      label: "",
    },
    // Accounting data → Reconciliation job
    {
      id: "e4",
      from: "accounting",
      to: "recon",
      label: "",
    },
    // On-chain liquidity → Reconciliation job
    {
      id: "e5",
      from: "liquidity",
      to: "recon",
      label: "",
    },
    // Reconciliation job → Proof of Reserve
    {
      id: "e6",
      from: "recon",
      to: "por",
      label: "",
    },
    // Proof of Reserve → Smart contracts
    {
      id: "e7",
      from: "por",
      to: "smarts",
      label: "",
    },
  ],
  steps: [
    {
      edgeId: "e1",
      desc: "Balance engine syncs deposit and withdrawal events to the Vault contract on-chain.",
    },
    {
      edgeId: "e2",
      desc: "Balance engine provides off-chain accounting data into the reconciliation pipeline.",
    },
    {
      edgeId: "e3",
      desc: "The on-chain Vault contract reports its liquidity state to the On-chain liquidity node.",
    },
    {
      edgeId: "e4",
      desc: "Accounting data is fed into the Reconciliation job (CRE DON) for cross-checking.",
    },
    {
      edgeId: "e5",
      desc: "On-chain liquidity data is also fed into the Reconciliation job for cross-validation.",
    },
    {
      edgeId: "e6",
      desc: "The Reconciliation job produces a Proof of Reserve attestation.",
    },
    {
      edgeId: "e7",
      desc: "Proof of Reserve is committed to Smart Contracts for trustless solvency verification.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. REGIME MODEL CRE WORKFLOW
// Image layout:
//   Outside group top-left: Chainlink Price Stream
//   Outside group top-right: Real-time price & grid
//   Chainlink Price Stream → Real-time price & grid (price input)
//   Inside group (large box):
//     Left: Blockchain (network icon)
//     Center: Regime Models (pink/red box with gear icon)
//     Right outside group: Volume data
//   Blockchain → Regime Models (get params, curved upward)
//   Regime Models → Blockchain (grid params, short arrow)
//   Volume data → Regime Models (input)
//   Regime Models → Real-time price & grid (calculate grid values, curved up to top)
// ═══════════════════════════════════════════════════════════════════════════════
export const REGIME_MODEL_CONFIG: WorkflowConfig = {
  title: "Regime Model CRE Workflow",
  subtitle: "regime-model-cre.workflow",
  accentColor: "#FB923C",
  labelScale: 1.3,
  width: 1000,
  height: 650,
  groupBox: {
    label: "Regime Model CRE workflow",
    x: 180,
    y: 280,
    w: 640,
    h: 330,
    color: "#FB923C",
  },
  nodes: [
    // Outside group – top
    {
      id: "cps",
      label: "Chainlink Price\nStream",
      x: 180,
      y: 150,
      w: 190,
      h: 64,
      shape: "rounded",
      color: "#F472B6",
    },
    {
      id: "rtgrid",
      label: "Real-time price\n& grid",
      x: 800,
      y: 150,
      w: 194,
      h: 64,
      shape: "rounded",
      color: "#60A5FA",
    },
    // Outside group – right
    {
      id: "volume",
      label: "Volume data",
      x: 880,
      y: 460,
      w: 150,
      h: 56,
      shape: "rounded",
      color: "#FBBF24",
      fill: "#FBBF24",
    },
    // Inside group
    {
      id: "blockchain",
      label: "Blockchain",
      x: 320,
      y: 460,
      w: 52,
      h: 52,
      shape: "network",
      color: "#818CF8",
    },
    {
      id: "regime",
      label: "Regime Models",
      x: 620,
      y: 460,
      w: 184,
      h: 70,
      shape: "rounded",
      color: "#FB923C",
      fill: "#FB923C",
    },
  ],
  edges: [
    // Chainlink Price Stream → Real-time price & grid
    {
      id: "e1",
      from: "cps",
      to: "rtgrid",
      label: "price input",
      labelPos: { x: 480, y: 130 },
    },
    // Volume data → Regime Models (input, from right)
    {
      id: "e2",
      from: "volume",
      to: "regime",
      label: "input",
      labelPos: { x: 760, y: 440 },
    },
    // Blockchain → Regime Models (get params, curved)
    {
      id: "e3",
      from: "blockchain",
      to: "regime",
      label: "get params",
      labelPos: { x: 442, y: 380 },
      curved: true,
      cp: { x: 450, y: 400 },
    },
    // Regime Models → Real-time price & grid (calculate grid values, curved up)
    {
      id: "e4",
      from: "regime",
      to: "rtgrid",
      label: "calculate grid values",
      labelPos: { x: 745, y: 270 },
      curved: true,
      cp: { x: 670, y: 330 },
    },
    // Regime Models → Blockchain (grid params)
    {
      id: "e5",
      from: "regime",
      to: "blockchain",
      label: "grid params",
      labelPos: { x: 460, y: 510 },
      curved: true,
      cp: { x: 470, y: 470 }, // Slightly offset it downwards so it doesn't overlap completely with the other path
    },
  ],
  steps: [
    {
      edgeId: "e1",
      desc: "Chainlink Price Stream delivers real-time price input to the Real-time price & grid engine at the top.",
    },
    {
      edgeId: "e2",
      desc: "Volume data is fed as input into the Regime Models to detect the current market regime.",
    },
    {
      edgeId: "e3",
      desc: "The Blockchain provides existing grid parameters to the Regime Models via the Chainlink CRE DON.",
    },
    {
      edgeId: "e4",
      desc: "Regime Models calculate new grid values and output them to the Real-time price & grid system.",
    },
    {
      edgeId: "e5",
      desc: "Updated grid parameters are committed back to the Blockchain for on-chain storage and retrieval.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SETTLEMENT CRE WORKFLOW
// Image layout:
//   Outside group top-left: User → Order engine (place bet)
//   Outside group top-right: Balance engine
//   Outside group left: Regime Models (gear icon)
//   Center: Settlements & Payouts
//   Order engine → Settlements & Payouts (calculate)
//   Balance engine → Settlements & Payouts (account)
//   Regime Models → Settlements & Payouts (input, long curved)
//   Inside group (right box):
//     Settlement batching & Aggregate payouts (top)
//     → Settlement Proof + User withdrawable amounts
//   Settlement Proof → Smart contracts (commit)
//   User withdrawable amounts → Smart contracts (commit)
// ═══════════════════════════════════════════════════════════════════════════════
export const SETTLEMENT_CONFIG: WorkflowConfig = {
  title: "Settlement CRE Workflow",
  subtitle: "settlement-cre.workflow",
  accentColor: "#818CF8",
  width: 780,
  height: 560,
  groupBox: {
    label: "Settlement CRE workflow",
    x: 360,
    y: 215,
    w: 420,
    h: 325,
    color: "#818CF8",
  },
  nodes: [
    // Outside group – top
    {
      id: "user",
      label: "User",
      x: 38,
      y: 48,
      w: 38,
      h: 38,
      shape: "circle",
      color: "#60A5FA",
      icon: "👤",
    },
    {
      id: "order",
      label: "Order engine",
      x: 235,
      y: 48,
      w: 145,
      h: 48,
      shape: "rounded",
      color: "#34D399",
    },
    {
      id: "balance",
      label: "Balance engine",
      x: 690,
      y: 48,
      w: 145,
      h: 48,
      shape: "rounded",
      color: "#F6AD55",
    },
    // Outside group – left (Regime Models)
    {
      id: "regime",
      label: "Regime\nModels",
      x: 105,
      y: 390,
      w: 95,
      h: 88,
      shape: "rounded",
      color: "#FB923C",
    },
    // Smart contracts (outside group, far right)
    {
      id: "smarts",
      label: "Smart\ncontracts",
      x: 726,
      y: 440,
      w: 42,
      h: 42,
      shape: "network",
      color: "#E879F9",
    },
    // Settlements & Payouts – center entry point (above group)
    {
      id: "settle",
      label: "Settlements &\nPayouts",
      x: 510,
      y: 155,
      w: 150,
      h: 54,
      shape: "rounded",
      color: "#818CF8",
    },
    // Inside group
    {
      id: "batching",
      label: "Settlement batching &\nAggregate payouts",
      x: 510,
      y: 305,
      w: 192,
      h: 56,
      shape: "rect",
      color: "#6EE7B7",
    },
    {
      id: "proof",
      label: "Settlement Proof",
      x: 478,
      y: 400,
      w: 145,
      h: 44,
      shape: "rect",
      color: "#F472B6",
    },
    {
      id: "withdraw",
      label: "User withdrawable\namounts",
      x: 478,
      y: 475,
      w: 158,
      h: 46,
      shape: "rect",
      color: "#FBBF24",
    },
  ],
  edges: [
    // User → Order engine (place trade)
    {
      id: "e1",
      from: "user",
      to: "order",
      label: "place trade",
      labelPos: { x: 138, y: 33 },
    },
    // Order engine → Settlements & Payouts (calculate)
    {
      id: "e2",
      from: "order",
      to: "settle",
      label: "calculate",
      labelPos: { x: 363, y: 84 },
      curved: true,
      cp: { x: 363, y: 62 },
    },
    // Balance engine → Settlements & Payouts (account)
    {
      id: "e3",
      from: "balance",
      to: "settle",
      label: "account",
      labelPos: { x: 615, y: 84 },
    },
    // Regime Models → Settlements & Payouts (input, long curved)
    {
      id: "e4",
      from: "regime",
      to: "settle",
      label: "input",
      labelPos: { x: 285, y: 238 },
      curved: true,
      cp: { x: 262, y: 160 },
    },
    // Settlements & Payouts → Settlement batching
    {
      id: "e5",
      from: "settle",
      to: "batching",
      label: "",
    },
    // Settlement batching → Settlement Proof
    {
      id: "e6",
      from: "batching",
      to: "proof",
      label: "",
    },
    // Settlement batching → User withdrawable amounts
    {
      id: "e7",
      from: "batching",
      to: "withdraw",
      label: "",
    },
    // Settlement Proof → Smart contracts (commit)
    {
      id: "e8",
      from: "proof",
      to: "smarts",
      label: "commit",
      labelPos: { x: 648, y: 400 },
    },
    // User withdrawable amounts → Smart contracts (commit)
    {
      id: "e9",
      from: "withdraw",
      to: "smarts",
      label: "commit",
      labelPos: { x: 645, y: 473 },
    },
  ],
  steps: [
    {
      edgeId: "e1",
      desc: "User places a trade, which is routed to the Order engine for processing.",
    },
    {
      edgeId: "e3",
      desc: "Balance engine provides account balances and context to the Settlements & Payouts system.",
    },
    {
      edgeId: "e4",
      desc: "Regime Models feed current market regime data as input into Settlements & Payouts.",
    },
    {
      edgeId: "e2",
      desc: "Order engine forwards the trade details to Settlements & Payouts for final calculation.",
    },
    {
      edgeId: "e5",
      desc: "Settlements & Payouts triggers the Settlement batching & Aggregate payout computation.",
    },
    {
      edgeId: "e6",
      desc: "Settlement batching produces a Settlement Proof for on-chain commitment.",
    },
    {
      edgeId: "e7",
      desc: "Settlement batching calculates the user-withdrawable amounts.",
    },
    {
      edgeId: "e8",
      desc: "Settlement Proof is committed to Smart Contracts for trustless verification.",
    },
    {
      edgeId: "e9",
      desc: "User withdrawable amounts are committed to Smart Contracts, enabling user withdrawals.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Wrapper with local play state
// ═══════════════════════════════════════════════════════════════════════════════
export const WorkflowPlayer: React.FC<{
  config: WorkflowConfig;
  diagramId: string;
  instantDesktopPan?: boolean;
}> = ({ config, diagramId, instantDesktopPan = false }) => {
  const [step, setStep] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setStep((p) => (p >= config.steps.length - 1 ? -1 : p + 1));
    }, 1800);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [config.steps.length]);

  return (
    <WorkflowDiagram
      config={config}
      onReset={() => {
        setStep(-1);
      }}
      step={step}
      diagramId={diagramId}
      instantDesktopPan={instantDesktopPan}
    />
  );
};
