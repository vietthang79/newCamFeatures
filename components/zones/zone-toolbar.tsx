"use client";
import { Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/shared/loading-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

type ZoneType = "parking_zone" | "entrance_zone" | "no_smoking_zone";
type DrawMode = "idle" | "drawing";

interface ZoneToolbarProps {
   zoneType: ZoneType;
   onZoneTypeChange: (t: ZoneType) => void;
   mode: DrawMode;
   onToggleDraw: () => void;
   onRefresh: () => void;
   onSave: () => void;
   onDeleteSelected: () => void;
   hasSelectedZone: boolean;
   hasZones: boolean;
   refreshing: boolean;
   saving: boolean;
}

const ZONE_LABELS: Record<ZoneType, string> = {
   parking_zone: "Parking Zone",
   entrance_zone: "Entrance Zone",
   no_smoking_zone: "No Smoking Zone",
};

export function ZoneToolbar({
   zoneType,
   onZoneTypeChange,
   mode,
   onToggleDraw,
   onRefresh,
   onSave,
   onDeleteSelected,
   hasSelectedZone,
   hasZones,
   refreshing,
   saving,
}: ZoneToolbarProps) {
   return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
         {/* Zone type */}
         <Select
            value={zoneType}
            onValueChange={(v) => {
               onZoneTypeChange(v as ZoneType);
               if (mode === "idle") onToggleDraw();
            }}
         >
            <SelectTrigger className="w-44">
               <SelectValue />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="parking_zone">Parking Zone</SelectItem>
               <SelectItem value="entrance_zone">Entrance Zone</SelectItem>
               <SelectItem value="no_smoking_zone">No Smoking Zone</SelectItem>
            </SelectContent>
         </Select>

         {/* Draw toggle */}
         <Button
            variant={mode === "drawing" ? "default" : "outline"}
            size="sm"
            onClick={onToggleDraw}
            className={cn(mode === "drawing" && "ring-2 ring-primary/50")}
         >
            <Pencil className="h-3.5 w-3.5" />
            {mode === "drawing" ? "Drawing…" : "Draw Polygon"}
         </Button>

         {/* Delete selected */}
         {hasSelectedZone && (
            <ConfirmDialog
               trigger={
                  <Button variant="destructive" size="sm">
                     <Trash2 className="h-3.5 w-3.5" />
                     Delete Zone
                  </Button>
               }
               title="Delete Zone"
               description="This zone will be permanently removed. This cannot be undone."
               confirmLabel="Delete Zone"
               onConfirm={onDeleteSelected}
            />
         )}

         {/* Spacer */}
         <div className="flex-1" />

         {/* Refresh */}
         <LoadingButton
            variant="outline"
            size="sm"
            loading={refreshing}
            loadingText="Refreshing…"
            onClick={onRefresh}
         >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Snapshot
         </LoadingButton>

         {/* Save */}
         <LoadingButton
            size="sm"
            loading={saving}
            loadingText="Saving…"
            onClick={onSave}
            disabled={!hasZones}
         >
            <Save className="h-3.5 w-3.5" />
            Save Zones
         </LoadingButton>
      </div>
   );
}
