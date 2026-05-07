"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Line, Circle, Group, Rect, Text } from "react-konva";
import Konva from "konva";

type ZoneType = "parking_zone" | "entrance_zone" | "no_smoking_zone";
type DrawMode = "idle" | "drawing";

export const ZONE_COLORS: Record<ZoneType, string> = {
   parking_zone: "#93D500",
   entrance_zone: "#22C55E",
   no_smoking_zone: "#EF4444",
};

// Points stored as normalized [0-1] coords; pixel conversion at render time only
interface CanvasZone {
   id: string;
   type: ZoneType;
   points: { x: number; y: number }[];
   selected: boolean;
}

export interface ZoneEditorProps {
   zones: CanvasZone[];
   activeZoneType: ZoneType;
   mode: DrawMode;
   onModeChange: (m: DrawMode) => void;
   onZonesChange: (zones: CanvasZone[]) => void;
   selectedId: string | null;
   onSelectId: (id: string | null) => void;
   readOnly?: boolean;
}

function normToPx(
   pts: { x: number; y: number }[],
   w: number,
   h: number,
): { x: number; y: number }[] {
   return pts.map((p) => ({ x: p.x * w, y: p.y * h }));
}

function pxToNorm(
   pts: { x: number; y: number }[],
   w: number,
   h: number,
): { x: number; y: number }[] {
   return pts.map((p) => ({ x: p.x / w, y: p.y / h }));
}

export function ZoneEditor({
   zones,
   activeZoneType,
   mode,
   onModeChange,
   onZonesChange,
   selectedId,
   onSelectId,
   readOnly = false,
}: ZoneEditorProps) {
   const containerRef = useRef<HTMLDivElement>(null);
   const stageRef = useRef<Konva.Stage>(null);
   // Start with 16:9 1280×720 (HD); ResizeObserver will correct immediately
   const [size, setSize] = useState({ w: 1280, h: 720 });
   const [inProgress, setInProgress] = useState<{ x: number; y: number }[]>(
      [],
   ); // pixel while drawing
   const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
      null,
   ); // pixel

   // Resize observer — no coordinate conversion needed; points stay normalized
   useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new ResizeObserver((entries) => {
         for (const entry of entries) {
            const { width } = entry.contentRect;
            if (width > 0) {
               setSize({ w: Math.round(width), h: Math.round(width * (9 / 16)) });
            }
         }
      });
      observer.observe(el);
      return () => observer.disconnect();
   }, []);

   const handleStageClick = useCallback(
      (_e: Konva.KonvaEventObject<MouseEvent>) => {
         if (mode !== "drawing") return;
         const stage = stageRef.current;
         if (!stage) return;
         const pos = stage.getPointerPosition();
         if (!pos) return;

         if (inProgress.length >= 3) {
            const first = inProgress[0];
            const dist = Math.sqrt(
               (pos.x - first.x) ** 2 + (pos.y - first.y) ** 2,
            );
            if (dist < 12) {
               const newZone: CanvasZone = {
                  id: crypto.randomUUID(),
                  type: activeZoneType,
                  points: pxToNorm(inProgress, size.w, size.h),
                  selected: true,
               };
               onZonesChange([
                  ...zones.map((z) => ({ ...z, selected: false })),
                  newZone,
               ]);
               onSelectId(newZone.id);
               setInProgress([]);
               setMousePos(null);
               onModeChange("idle");
               return;
            }
         }
         setInProgress((prev) => [...prev, pos]);
      },
      [mode, inProgress, activeZoneType, onModeChange, onSelectId, onZonesChange, zones, size.w, size.h],
   );

   const handleMouseMove = useCallback(() => {
      if (mode !== "drawing") return;
      const stage = stageRef.current;
      if (!stage) return;
      setMousePos(stage.getPointerPosition());
   }, [mode]);

   const handleStageMouseDown = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
         if (e.target === e.target.getStage() && mode === "idle") {
            onZonesChange(zones.map((z) => ({ ...z, selected: false })));
            onSelectId(null);
         }
      },
      [mode, onSelectId, onZonesChange, zones],
   );

   const handlePolygonClick = useCallback(
      (id: string) => {
         if (mode !== "idle") return;
         onZonesChange(zones.map((z) => ({ ...z, selected: z.id === id })));
         onSelectId(id);
      },
      [mode, onSelectId, onZonesChange, zones],
   );

   // pointIdx drag: pixel → normalize before storing
   const updatePoint = useCallback(
      (zoneId: string, pointIdx: number, px: number, py: number) => {
         const nx = px / size.w;
         const ny = py / size.h;
         onZonesChange(
            zones.map((z) =>
               z.id === zoneId
                  ? {
                       ...z,
                       points: z.points.map((p, i) =>
                          i === pointIdx ? { x: nx, y: ny } : p,
                       ),
                    }
                  : z,
            ),
         );
      },
      [size.w, size.h, onZonesChange, zones],
   );

   // Whole-zone drag: pixel delta → normalized delta before storing
   const moveZone = useCallback(
      (zoneId: string, dxPx: number, dyPx: number) => {
         const dx = dxPx / size.w;
         const dy = dyPx / size.h;
         onZonesChange(
            zones.map((z) =>
               z.id === zoneId
                  ? {
                       ...z,
                       points: z.points.map((p) => ({
                          x: Math.min(1, Math.max(0, p.x + dx)),
                          y: Math.min(1, Math.max(0, p.y + dy)),
                       })),
                    }
                  : z,
            ),
         );
      },
      [size.w, size.h, onZonesChange, zones],
   );

   const flatPx = (pts: { x: number; y: number }[]) =>
      pts.flatMap((p) => [p.x, p.y]);

   return (
      <div
         ref={containerRef}
         style={{
            width: "100%",
            height: size.h,
            cursor: !readOnly && mode === "drawing" ? "crosshair" : "default",
         }}
         className="rounded-lg overflow-hidden border border-gray-200"
      >
         <Stage
            ref={stageRef}
            width={size.w}
            height={size.h}
            onClick={readOnly ? undefined : handleStageClick}
            onMouseMove={readOnly ? undefined : handleMouseMove}
            onMouseDown={readOnly ? undefined : handleStageMouseDown}
         >
            {/* Background layer: fake HD parking lot scene */}
            <Layer listening={false}>
               <ParkingLotBackground w={size.w} h={size.h} />
            </Layer>

            {/* Zone drawing layer */}
            <Layer>
               {zones.map((zone) => {
                  const color = ZONE_COLORS[zone.type];
                  const isSelected = zone.id === selectedId;
                  const fillColor = isSelected ? `${color}59` : `${color}26`;
                  const pxPts = normToPx(zone.points, size.w, size.h);

                  return (
                     <Group
                        key={zone.id}
                        draggable={!readOnly && isSelected}
                        onDragEnd={readOnly ? undefined : (e) => {
                           if (!(e.target instanceof Konva.Group)) return;
                           const g = e.target;
                           moveZone(zone.id, g.x(), g.y());
                           g.position({ x: 0, y: 0 });
                        }}
                        onClick={readOnly ? undefined : () => handlePolygonClick(zone.id)}
                     >
                        <Line
                           points={flatPx(pxPts)}
                           closed
                           fill={fillColor}
                           stroke={color}
                           strokeWidth={isSelected ? 2.5 : 1.5}
                           opacity={isSelected ? 1 : 0.7}
                           hitStrokeWidth={8}
                        />
                        {!readOnly && isSelected &&
                           pxPts.map((pt, i) => (
                              <Circle
                                 key={i}
                                 x={pt.x}
                                 y={pt.y}
                                 radius={6}
                                 fill="white"
                                 stroke={color}
                                 strokeWidth={2}
                                 draggable
                                 onMouseEnter={(e) => {
                                    e.target.to({ radius: 9, duration: 0.12 });
                                 }}
                                 onMouseLeave={(e) => {
                                    e.target.to({ radius: 6, duration: 0.12 });
                                 }}
                                 // Stop bubbling so Group.onDragEnd doesn't fire
                                 onDragStart={(e) => { e.cancelBubble = true; }}
                                 onDragMove={(e) => {
                                    e.cancelBubble = true;
                                    updatePoint(
                                       zone.id,
                                       i,
                                       e.target.x(),
                                       e.target.y(),
                                    );
                                 }}
                                 onDragEnd={(e) => { e.cancelBubble = true; }}
                              />
                           ))}
                     </Group>
                  );
               })}

               {/* In-progress polygon */}
               {inProgress.length > 0 &&
                  (() => {
                     const color = ZONE_COLORS[activeZoneType];
                     const pts = flatPx(inProgress);
                     return (
                        <>
                           <Line
                              points={pts}
                              stroke={color}
                              strokeWidth={2}
                              opacity={0.9}
                           />
                           {mousePos && (
                              <Line
                                 points={[
                                    inProgress[inProgress.length - 1].x,
                                    inProgress[inProgress.length - 1].y,
                                    mousePos.x,
                                    mousePos.y,
                                 ]}
                                 stroke={color}
                                 strokeWidth={1.5}
                                 dash={[6, 4]}
                                 opacity={0.6}
                              />
                           )}
                           {inProgress.slice(1).map((pt, i) => (
                              <Circle
                                 key={i + 1}
                                 x={pt.x}
                                 y={pt.y}
                                 radius={5}
                                 fill="white"
                                 stroke={color}
                                 strokeWidth={2}
                              />
                           ))}
                           <Circle
                              x={inProgress[0].x}
                              y={inProgress[0].y}
                              radius={7}
                              fill="white"
                              stroke={color}
                              strokeWidth={2}
                           />
                           <PulseRing
                              x={inProgress[0].x}
                              y={inProgress[0].y}
                              color={color}
                           />
                        </>
                     );
                  })()}
            </Layer>
         </Stage>
      </div>
   );
}

// Fake parking lot background — simulates an HD overhead camera feed
function ParkingLotBackground({ w, h }: { w: number; h: number }) {
   const slotW = w * 0.085;
   const slotH = h * 0.18;
   const rowY1 = h * 0.08;
   const rowY2 = h * 0.52;
   const cols = 10;
   const marginX = w * 0.04;

   // Simulate "occupied" slots with a fixed pattern
   const occupied = new Set([1, 3, 4, 6, 8, 11, 12, 14, 17, 18]);

   const carColors = ["#1a1a2e", "#16213e", "#2c3e50", "#4a4a4a", "#2d4a22"];

   return (
      <>
         {/* Asphalt */}
         <Rect x={0} y={0} width={w} height={h} fill="#2a2a2a" />

         {/* Lane dividers */}
         <Rect x={0} y={h * 0.28} width={w} height={h * 0.22} fill="#313131" />
         <Rect x={0} y={h * 0.72} width={w} height={h * 0.28} fill="#313131" />

         {/* Lane markings */}
         {Array.from({ length: 20 }).map((_, i) => (
            <Rect
               key={`dash-${i}`}
               x={w * 0.04 + i * (w * 0.05)}
               y={h * 0.375}
               width={w * 0.03}
               height={h * 0.008}
               fill="#f0c030"
               opacity={0.75}
            />
         ))}

         {/* Parking slot lines — Row 1 */}
         {Array.from({ length: cols + 1 }).map((_, i) => (
            <Line
               key={`r1v-${i}`}
               points={[
                  marginX + i * slotW,
                  rowY1,
                  marginX + i * slotW,
                  rowY1 + slotH,
               ]}
               stroke="#ffffff"
               strokeWidth={Math.max(1, w * 0.0012)}
               opacity={0.6}
            />
         ))}
         <Line
            points={[marginX, rowY1, marginX + cols * slotW, rowY1]}
            stroke="#ffffff"
            strokeWidth={Math.max(1, w * 0.0012)}
            opacity={0.6}
         />
         <Line
            points={[
               marginX,
               rowY1 + slotH,
               marginX + cols * slotW,
               rowY1 + slotH,
            ]}
            stroke="#ffffff"
            strokeWidth={Math.max(1, w * 0.0012)}
            opacity={0.6}
         />

         {/* Parking slot lines — Row 2 */}
         {Array.from({ length: cols + 1 }).map((_, i) => (
            <Line
               key={`r2v-${i}`}
               points={[
                  marginX + i * slotW,
                  rowY2,
                  marginX + i * slotW,
                  rowY2 + slotH,
               ]}
               stroke="#ffffff"
               strokeWidth={Math.max(1, w * 0.0012)}
               opacity={0.6}
            />
         ))}
         <Line
            points={[marginX, rowY2, marginX + cols * slotW, rowY2]}
            stroke="#ffffff"
            strokeWidth={Math.max(1, w * 0.0012)}
            opacity={0.6}
         />
         <Line
            points={[
               marginX,
               rowY2 + slotH,
               marginX + cols * slotW,
               rowY2 + slotH,
            ]}
            stroke="#ffffff"
            strokeWidth={Math.max(1, w * 0.0012)}
            opacity={0.6}
         />

         {/* Cars in occupied slots */}
         {Array.from({ length: cols }).map((_, i) => {
            const idx1 = i;
            const idx2 = cols + i;
            const car1 = occupied.has(idx1);
            const car2 = occupied.has(idx2);
            const cx1 = marginX + i * slotW + slotW * 0.1;
            const cy1 = rowY1 + slotH * 0.12;
            const cx2 = marginX + i * slotW + slotW * 0.1;
            const cy2 = rowY2 + slotH * 0.12;
            const carW = slotW * 0.8;
            const carH = slotH * 0.76;
            const c1 = carColors[idx1 % carColors.length];
            const c2 = carColors[idx2 % carColors.length];
            return (
               <>
                  {car1 && (
                     <Rect
                        key={`car1-${i}`}
                        x={cx1}
                        y={cy1}
                        width={carW}
                        height={carH}
                        fill={c1}
                        cornerRadius={Math.max(2, w * 0.004)}
                        opacity={0.9}
                     />
                  )}
                  {car2 && (
                     <Rect
                        key={`car2-${i}`}
                        x={cx2}
                        y={cy2}
                        width={carW}
                        height={carH}
                        fill={c2}
                        cornerRadius={Math.max(2, w * 0.004)}
                        opacity={0.9}
                     />
                  )}
               </>
            );
         })}

         {/* Camera OSD overlay */}
         <Rect x={0} y={0} width={w} height={h * 0.045} fill="rgba(0,0,0,0.55)" />
         <Text
            x={w * 0.012}
            y={h * 0.008}
            text="CAM-01 | GATE A | 1920×1080 | 25fps"
            fontSize={Math.max(10, w * 0.012)}
            fill="#00ff88"
            fontFamily="monospace"
         />
         <Text
            x={w * 0.72}
            y={h * 0.008}
            text="2025-05-05  14:32:07"
            fontSize={Math.max(10, w * 0.012)}
            fill="#00ff88"
            fontFamily="monospace"
         />

         {/* REC indicator */}
         <Circle
            x={w * 0.965}
            y={h * 0.022}
            radius={Math.max(4, w * 0.005)}
            fill="#ff2020"
            opacity={0.9}
         />
         <Text
            x={w * 0.972}
            y={h * 0.009}
            text="REC"
            fontSize={Math.max(9, w * 0.011)}
            fill="#ff2020"
            fontFamily="monospace"
         />
      </>
   );
}

function PulseRing({ x, y, color }: { x: number; y: number; color: string }) {
   const circleRef = useRef<Konva.Circle | null>(null);

   useEffect(() => {
      const node = circleRef.current;
      if (!node) return;
      let startTime: number | null = null;
      const anim = new Konva.Animation((frame) => {
         if (!frame) return;
         if (startTime === null) startTime = frame.time;
         const t = ((frame.time - startTime) % 1500) / 1500;
         node.radius(7 + t * 10);
         node.opacity(0.6 * (1 - t));
      }, node.getLayer());
      anim.start();
      return () => { anim.stop(); };
   }, []);

   return (
      <Circle
         ref={circleRef}
         x={x}
         y={y}
         radius={7}
         fill="transparent"
         stroke={color}
         strokeWidth={1.5}
         opacity={0.6}
         listening={false}
      />
   );
}

export type { CanvasZone, ZoneType };
