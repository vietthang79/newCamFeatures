"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { MOCK_CAMERAS, MOCK_ZONES } from "@/lib/mock-data";
import { ZoneToolbar } from "@/components/zones/zone-toolbar";
import { ZoneList } from "@/components/zones/zone-list";
import { toast } from "sonner";
import type {
   CanvasZone,
   ZoneType,
   ZoneEditorProps,
} from "@/components/zones/zone-editor";

function toCanvasZones(rawZones: typeof MOCK_ZONES): CanvasZone[] {
   return rawZones.map((z) => ({
      id: z.id,
      type: z.type,
      points: z.points,
      selected: false,
   }));
}

const ZoneEditor = dynamic<ZoneEditorProps>(
   () =>
      import("@/components/zones/zone-editor").then((m) => ({
         default: m.ZoneEditor,
      })),
   {
      ssr: false,
      loading: () => (
         <div className="aspect-video w-full rounded-lg border border-gray-200 bg-gray-100 animate-pulse" />
      ),
   },
);

type DrawMode = "idle" | "drawing";

export default function ZonesPage({ params }: { params: { id: string } }) {
   const camera =
      MOCK_CAMERAS.find((c) => c.id === params.id) ?? MOCK_CAMERAS[0];

   const [zoneType, setZoneType] = useState<ZoneType>("parking_zone");
   const [mode, setMode] = useState<DrawMode>("idle");
   const [zones, setZones] = useState<CanvasZone[]>(() =>
      toCanvasZones(MOCK_ZONES.filter((z) => z.camera_id === camera.id)),
   );
   const [selectedId, setSelectedId] = useState<string | null>(null);
   const [refreshing, setRefreshing] = useState(false);
   const [saving, setSaving] = useState(false);

   const handleZonesChange = useCallback((updated: CanvasZone[]) => {
      setZones(updated);
      setSelectedId((prev) =>
         prev && updated.some((z) => z.id === prev) ? prev : null,
      );
   }, []);

   const handleToggleDraw = () => {
      setMode((m) => (m === "drawing" ? "idle" : "drawing"));
   };

   const handleRefresh = async () => {
      setRefreshing(true);
      await new Promise((r) => setTimeout(r, 1500));
      setRefreshing(false);
      toast.success("Snapshot refreshed");
   };

   const handleSave = async () => {
      setSaving(true);
      await new Promise((r) => setTimeout(r, 1000));
      setSaving(false);
      toast.success(
         `${zones.length} zone${zones.length !== 1 ? "s" : ""} saved`,
      );
   };

   const handleDeleteSelected = () => {
      if (!selectedId) return;
      setZones((prev) => prev.filter((z) => z.id !== selectedId));
      setSelectedId(null);
      toast.success("Zone deleted");
   };

   const handleDeleteById = (id: string) => {
      setZones((prev) => prev.filter((z) => z.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success("Zone deleted");
   };

   const hasSelected = zones.some((z) => z.id === selectedId);

   return (
      <div className="space-y-4">
         <ZoneToolbar
            zoneType={zoneType}
            onZoneTypeChange={setZoneType}
            mode={mode}
            onToggleDraw={handleToggleDraw}
            onRefresh={handleRefresh}
            onSave={handleSave}
            onDeleteSelected={handleDeleteSelected}
            hasSelectedZone={hasSelected}
            hasZones={zones.length > 0}
            refreshing={refreshing}
            saving={saving}
         />

         <ZoneEditor
            zones={zones}
            activeZoneType={zoneType}
            mode={mode}
            onModeChange={setMode}
            onZonesChange={handleZonesChange}
            selectedId={selectedId}
            onSelectId={setSelectedId}
         />

         <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">
               Zones ({zones.length})
            </h3>
            <ZoneList
               zones={zones}
               selectedId={selectedId}
               onSelect={(id) => {
                  setSelectedId(id);
                  setZones((prev) =>
                     prev.map((z) => ({ ...z, selected: z.id === id })),
                  );
               }}
               onDelete={handleDeleteById}
            />
         </div>
      </div>
   );
}
