"use client";
import { useMemo } from "react";
import {
   CheckCircle2,
   Clock,
   XCircle,
   Activity,
   TrendingUp,
   AlertTriangle,
} from "lucide-react";
import { MOCK_CAMERAS } from "@/lib/mock-data";
import { formatTimeAgo, cameraStatus } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/cameras/status-badge";
import { HealthBanner } from "@/components/cameras/health-banner";
import { cn } from "@/lib/utils";

// Generate mock activity bars (last 12h, 24 x 30min buckets)
function generateActivityBars(lastFrameAt: Date | null) {
   return Array.from({ length: 24 }, (_, i) => {
      const hoursAgo = 12 - i * 0.5;
      if (!lastFrameAt) return { fpm: 0, label: `${Math.floor(hoursAgo)}h` };
      const bucketTime = Date.now() - hoursAgo * 3600_000;
      const age = lastFrameAt.getTime() - bucketTime;
      if (age < -600_000) return { fpm: 0, label: `${i}` };
      const base = 20 + Math.random() * 10;
      return { fpm: Math.round(base * 10) / 10, label: `${i}` };
   });
}

const STATUS_ICONS = {
   online: { icon: CheckCircle2, color: "text-green-500", label: "Online" },
   warning: { icon: Clock, color: "text-yellow-500", label: "Warning" },
   offline: { icon: XCircle, color: "text-red-500", label: "Offline" },
   pending: { icon: Activity, color: "text-gray-400", label: "Pending" },
};

export default function HealthPage({ params }: { params: { id: string } }) {
   const camera =
      MOCK_CAMERAS.find((c) => c.id === params.id) ?? MOCK_CAMERAS[0];
   const status = cameraStatus(camera.last_frame_at);
   const { icon: StatusIcon, color, label } = STATUS_ICONS[status];
   const bars = useMemo(
      () => generateActivityBars(camera.last_frame_at),
      [camera.last_frame_at],
   );
   const maxFpm = Math.max(...bars.map((b) => b.fpm), 1);

   const metrics = [
      {
         label: "Frames/min (5m)",
         value: camera.last_frame_at ? "24.6" : "0",
         unit: "FPS",
         icon: Activity,
         color: "text-pri-text",
      },
      {
         label: "Uptime Today",
         value: camera.last_frame_at ? "98.2" : "0",
         unit: "%",
         icon: TrendingUp,
         color: "text-green-500",
      },
      {
         label: "Errors (24h)",
         value: "3",
         unit: "",
         icon: AlertTriangle,
         color: "text-yellow-500",
      },
   ];

   return (
      <div className="space-y-5 max-w-3xl">
         {/* Health banner */}
         <HealthBanner lastFrameAt={camera.last_frame_at} />

         {/* Status card */}
         <Card>
            <CardContent className="pt-6">
               <div className="flex items-center gap-4">
                  <StatusIcon className={cn("h-10 w-10", color)} />
                  <div>
                     <p className={cn("text-2xl font-bold", color)}>{label}</p>
                     <p
                        className="text-sm text-gray-500"
                        suppressHydrationWarning
                     >
                        Last frame: {formatTimeAgo(camera.last_frame_at)}
                     </p>
                  </div>
                  <div className="ml-auto">
                     <StatusBadge status={status} />
                  </div>
               </div>
               {/* Progress bar cycling (30s poll simulation) */}
               <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-xs text-gray-400">
                     <span>Auto-refreshes every 30 seconds</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
                     <div
                        className="h-full rounded-full bg-primary animate-[progress_30s_linear_infinite] w-full"
                        style={{
                           transformOrigin: "left",
                           animation: "progress 30s linear infinite",
                        }}
                     />
                  </div>
               </div>
            </CardContent>
         </Card>

         {/* Metrics */}
         <div className="grid grid-cols-3 gap-4">
            {metrics.map(({ label, value, unit, icon: Icon, color: c }) => (
               <Card key={label}>
                  <CardContent className="pt-5 pb-4">
                     <div className="flex items-start justify-between">
                        <div>
                           <p className="text-xs text-gray-500">{label}</p>
                           <p className={cn("mt-1 text-2xl font-bold", c)}>
                              {value}
                              <span className="ml-1 text-sm font-normal text-gray-400">
                                 {unit}
                              </span>
                           </p>
                        </div>
                        <Icon className={cn("h-5 w-5", c)} />
                     </div>
                  </CardContent>
               </Card>
            ))}
         </div>

         {/* Activity chart */}
         <Card>
            <CardHeader>
               <CardTitle className="text-sm">
                  Frame Activity — Last 12 Hours
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex items-end gap-0.5 h-24">
                  {bars.map((bar, i) => {
                     const pct = bar.fpm / maxFpm;
                     return (
                        <div
                           key={i}
                           className="flex flex-1 flex-col items-center gap-0.5"
                        >
                           <div
                              className="w-full rounded-sm"
                              style={{
                                 height: `${Math.max(pct * 88, 2)}px`,
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
               <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>12h ago</span>
                  <span>Now</span>
               </div>
            </CardContent>
         </Card>
      </div>
   );
}
