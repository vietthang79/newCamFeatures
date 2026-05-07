"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
   MapPin,
   Tag,
   Calendar,
   Clock,
   CheckCircle2,
   XCircle,
   Activity,
   TrendingUp,
   AlertTriangle,
   Globe,
   Webhook,
   KeyRound,
   Zap,
   Link2,
   Monitor,
   BarChart2,
   ScanLine,
} from "lucide-react";
import { MOCK_CAMERAS, MOCK_ZONES } from "@/lib/mock-data";
import { formatTimeAgo, cameraStatus, cn } from "@/lib/utils";
import { StatusBadge } from "@/components/cameras/status-badge";
import { HealthBanner } from "@/components/cameras/health-banner";
import { CopyButton } from "@/components/shared/copy-button";
import { SectionCard } from "@/components/shared/section-card";
import {
   ZONE_COLORS,
   type CanvasZone,
   type ZoneType,
   type ZoneEditorProps,
} from "@/components/zones/zone-editor";
import { ZONE_LABELS } from "@/components/zones/zone-list";
import {
   RecentAlerts,
   MOCK_CAMERA_ALERTS,
} from "@/components/cameras/recent-alerts";

const API_BASE =
   process.env.NEXT_PUBLIC_API_BASE ?? "https://api.intellipark.io";

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

function generateActivityBars(lastFrameAt: Date | null) {
   return Array.from({ length: 24 }, (_, i) => {
      const hoursAgo = 23 - i;
      if (!lastFrameAt) return { fpm: 0 };
      const bucketTime = Date.now() - hoursAgo * 3600_000;
      const age = lastFrameAt.getTime() - bucketTime;
      if (age < -3600_000) return { fpm: 0 };
      return { fpm: Math.round((20 + Math.random() * 10) * 10) / 10 };
   });
}

const STATUS_CONFIG = {
   online: { icon: CheckCircle2, color: "text-green-500", label: "Online" },
   warning: { icon: Clock, color: "text-yellow-500", label: "Warning" },
   offline: { icon: XCircle, color: "text-red-500", label: "Offline" },
   pending: { icon: Activity, color: "text-gray-400", label: "Pending" },
};

export default function OverviewPage({ params }: { params: { id: string } }) {
   const camera =
      MOCK_CAMERAS.find((c) => c.id === params.id) ?? MOCK_CAMERAS[0];

   const status = cameraStatus(camera.last_frame_at);
   const {
      icon: StatusIcon,
      color,
      label: statusLabel,
   } = STATUS_CONFIG[status];

   const bars = useMemo(
      () => generateActivityBars(camera.last_frame_at),
      [camera.last_frame_at],
   );
   const maxFpm = Math.max(...bars.map((b) => b.fpm), 1);
   const endpointUrl = `${API_BASE}/ingest/${camera.id}`;

   const cameraZones = useMemo<CanvasZone[]>(
      () =>
         MOCK_ZONES.filter((z) => z.camera_id === camera.id).map((z) => ({
            id: z.id,
            type: z.type as ZoneType,
            points: z.points,
            selected: false,
         })),
      [camera.id],
   );

   const uniqueZoneTypes = useMemo(
      () => [...new Set(cameraZones.map((z) => z.type))],
      [cameraZones],
   );

   const details = [
      { icon: Tag, label: "Model", value: camera.model },
      { icon: MapPin, label: "Location", value: camera.location || "—" },
      { icon: Calendar, label: "Registered", value: camera.created_at },
      {
         icon: Clock,
         label: "Last Frame",
         value: formatTimeAgo(camera.last_frame_at),
      },
      {
         icon: Globe,
         label: "Address",
         value: `${camera.ip}:${camera.port}`,
         mono: true,
      },
   ];

   const configFields = [
      { icon: KeyRound, label: "Site Key", value: camera.id, mono: true },
      { icon: Zap, label: "Trigger Interval", value: "500ms", mono: true },
      {
         icon: Link2,
         label: "Endpoint URL",
         value: endpointUrl,
         mono: true,
         fullWidth: true,
      },
   ];

   const metrics = [
      {
         label: "FPS (5s)",
         value: camera.last_frame_at ? "24.6" : "0",
         icon: Activity,
         color: "text-pri-text",
      },
      {
         label: "Uptime",
         value: camera.last_frame_at ? "98.2%" : "0%",
         icon: TrendingUp,
         color: "text-green-500",
      },
      {
         label: "Errors (24h)",
         value: "3",
         icon: AlertTriangle,
         color: "text-yellow-500",
      },
   ];

   return (
      <div className="space-y-4">
         {/* Health alert banner */}
         <HealthBanner lastFrameAt={camera.last_frame_at} />

         {/* Main 2-column layout */}
         <div className="grid gap-4 lg:grid-cols-5">
            {/* Left: Zone preview + Frame Activity */}
            <div className="space-y-3 lg:col-span-3">
               <SectionCard
                  icon={ScanLine}
                  iconColor="text-violet-500"
                  iconBg="bg-violet-50"
                  title="Geo-zone Preview"
                  subtitle="Active detection geo-zones"
                  contentClassName="p-3 space-y-2"
               >
                  <ZoneEditor
                     readOnly
                     zones={cameraZones}
                     activeZoneType="parking_zone"
                     mode="idle"
                     onModeChange={() => {}}
                     onZonesChange={() => {}}
                     selectedId={null}
                     onSelectId={() => {}}
                  />
                  {uniqueZoneTypes.length > 0 && (
                     <div className="flex flex-wrap gap-4 pt-1">
                        {uniqueZoneTypes.map((type) => (
                           <div
                              key={type}
                              className="flex items-center gap-1.5"
                           >
                              <div
                                 className="h-3 w-3 rounded-sm opacity-80"
                                 style={{ backgroundColor: ZONE_COLORS[type] }}
                              />
                              <span className="text-xs text-gray-600">
                                 {ZONE_LABELS[type]}
                              </span>
                           </div>
                        ))}
                     </div>
                  )}
               </SectionCard>
            </div>

            {/* Right: Status + Metrics + Details */}
            <div className="flex flex-col gap-3 lg:col-span-2">
               {/* Camera Status card */}
               <SectionCard
                  icon={Monitor}
                  iconColor="text-gray-500"
                  iconBg="bg-gray-100"
                  title="Camera Status"
                  subtitle={
                     <span className="truncate font-mono">{camera.id}</span>
                  }
                  trailing={<StatusBadge status={status} />}
               >
                  <div className="space-y-4">
                     {/* Status row */}
                     <div className="flex items-center gap-3">
                        <StatusIcon className={cn("h-7 w-7 shrink-0", color)} />
                        <div className="min-w-0 flex-1">
                           <p className={cn("font-bold leading-none", color)}>
                              {statusLabel}
                           </p>
                           <p
                              className="mt-0.5 font-mono text-xs text-gray-400"
                              suppressHydrationWarning
                           >
                              {formatTimeAgo(camera.last_frame_at)}
                           </p>
                        </div>
                     </div>

                     {/* Metrics */}
                     <div className="grid grid-cols-3 gap-2">
                        {metrics.map(
                           ({ label, value, icon: Icon, color: c }) => (
                              <div
                                 key={label}
                                 className="rounded-md bg-gray-50 px-2 py-2.5 text-center"
                              >
                                 <Icon
                                    className={cn(
                                       "mx-auto mb-1 h-3.5 w-3.5",
                                       c,
                                    )}
                                 />
                                 <p
                                    className={cn(
                                       "text-sm font-bold leading-none",
                                       c,
                                    )}
                                 >
                                    {value}
                                 </p>
                                 <p className="mt-1 text-xs text-gray-400">
                                    {label}
                                 </p>
                              </div>
                           ),
                        )}
                     </div>

                     <div className="border-t border-gray-200" />

                     {/* Camera details */}
                     <div className="grid grid-cols-2 gap-2">
                        {details.map(({ icon: Icon, label, value, mono }) => (
                           <div
                              key={label}
                              className="flex items-start gap-2 rounded-lg bg-gray-50 p-2.5"
                           >
                              <div className="mt-0.5 shrink-0 rounded-md bg-white p-1 shadow-sm ring-1 ring-gray-100">
                                 <Icon className="h-3 w-3 text-gray-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                 <p className="text-[10px] leading-none text-gray-400">
                                    {label}
                                 </p>
                                 <p
                                    className={cn(
                                       "mt-1 truncate text-xs font-semibold text-gray-700",
                                       mono && "font-mono",
                                    )}
                                 >
                                    {value}
                                 </p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </SectionCard>

               {/* HTTP Push Configuration */}
               <SectionCard
                  icon={Webhook}
                  iconColor="text-blue-500"
                  iconBg="bg-blue-50"
                  title="HTTP Push Configuration"
                  subtitle="Milesight → Event → HTTP Notification"
                  contentClassName="space-y-2 p-3"
               >
                  <div className="grid grid-cols-2 gap-2">
                     {configFields.map(
                        ({ icon: Icon, label, value, mono, fullWidth }) => (
                           <div
                              key={label}
                              className={cn(
                                 "flex items-start gap-2 rounded-lg bg-gray-50 p-2.5",
                                 fullWidth && "col-span-2",
                              )}
                           >
                              <div className="mt-0.5 shrink-0 rounded-md bg-white p-1 shadow-sm ring-1 ring-gray-100">
                                 <Icon className="h-3 w-3 text-gray-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                 <p className="text-[10px] leading-none text-gray-400">
                                    {label}
                                 </p>
                                 <div className="mt-1 flex items-center justify-between gap-2">
                                    <p
                                       className={cn(
                                          "truncate text-xs font-semibold text-gray-700",
                                          mono && "font-mono",
                                       )}
                                    >
                                       {value}
                                    </p>
                                    <CopyButton value={value} />
                                 </div>
                              </div>
                           </div>
                        ),
                     )}
                  </div>
               </SectionCard>
            </div>
         </div>

         {/* Frame Activity */}
         <SectionCard
            icon={BarChart2}
            iconColor="text-green-500"
            iconBg="bg-green-50"
            title="Frame Activity"
            subtitle="Last 24 hours — 1h buckets"
            contentClassName="p-3"
         >
            <div className="overflow-x-auto">
               <div
                  className="flex h-16 items-end gap-1"
                  style={{ minWidth: "560px" }}
               >
                  {bars.map((bar, i) => {
                     const pct = bar.fpm / maxFpm;
                     return (
                        <div
                           key={i}
                           className="flex h-full flex-1 flex-col justify-end"
                        >
                           <div
                              className="w-full rounded-sm"
                              style={{
                                 height: `${Math.max(pct * 60, 2)}px`,
                                 backgroundColor:
                                    bar.fpm === 0
                                       ? "#E5E7EB"
                                       : bar.fpm > 15
                                         ? "#22C55E"
                                         : bar.fpm > 5
                                           ? "#EAB308"
                                           : "#EF4444",
                              }}
                           />
                        </div>
                     );
                  })}
               </div>
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-400">
               <span>24h ago</span>
               <span>Now</span>
            </div>
         </SectionCard>
         {/* Recent alerts */}
         <RecentAlerts
            alerts={camera.last_frame_at ? MOCK_CAMERA_ALERTS : []}
         />
      </div>
   );
}
