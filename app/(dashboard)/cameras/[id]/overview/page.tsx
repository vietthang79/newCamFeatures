"use client";
import { useState, useEffect } from "react";
import { RefreshCw, MapPin, Tag, Calendar, Clock } from "lucide-react";
import { MOCK_CAMERAS } from "@/lib/mock-data";
import { formatTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/cameras/status-badge";
import { SnapshotPlaceholder } from "@/components/cameras/snapshot-placeholder";
import { LoadingButton } from "@/components/shared/loading-button";

export default function OverviewPage({ params }: { params: { id: string } }) {
   const camera =
      MOCK_CAMERAS.find((c) => c.id === params.id) ?? MOCK_CAMERAS[0];
   const [refreshing, setRefreshing] = useState(false);
   const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

   useEffect(() => {
      setLastRefresh(new Date());
   }, []);

   const handleRefresh = async () => {
      setRefreshing(true);
      await new Promise((r) => setTimeout(r, 1500));
      setRefreshing(false);
      setLastRefresh(new Date());
   };

   const detail = [
      { icon: Tag, label: "Model", value: camera.model },
      { icon: MapPin, label: "Location", value: camera.location || "—" },
      { icon: Calendar, label: "Registered", value: camera.created_at },
      {
         icon: Clock,
         label: "Last Frame",
         value: formatTimeAgo(camera.last_frame_at),
      },
   ];

   return (
      <div className="grid gap-6 lg:grid-cols-2">
         {/* Snapshot panel */}
         <div className="space-y-3">
            <SnapshotPlaceholder
               label={lastRefresh ? `Last snapshot — ${formatTimeAgo(lastRefresh)}` : "Last snapshot"}
            />
            <LoadingButton
               variant="outline"
               size="sm"
               loading={refreshing}
               loadingText="Refreshing…"
               onClick={handleRefresh}
               className="w-full"
            >
               <RefreshCw className="h-3.5 w-3.5" />
               Refresh Snapshot
            </LoadingButton>
            <p className="text-center text-xs text-gray-400">
               {lastRefresh ? `Last snapshot: ${formatTimeAgo(lastRefresh)}` : "Last snapshot: —"}
            </p>
         </div>

         {/* Camera details */}
         <Card>
            <CardHeader>
               <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{camera.name}</CardTitle>
                  <StatusBadge status={camera.status} />
               </div>
               <p className="font-mono text-sm text-gray-500">
                  {camera.ip}:{camera.port}
               </p>
            </CardHeader>
            <CardContent>
               <dl className="space-y-3">
                  {detail.map(({ icon: Icon, label, value }) => (
                     <div key={label} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="w-24 text-xs font-medium text-gray-500">
                           {label}
                        </span>
                        <span className="text-sm text-gray-700">{value}</span>
                     </div>
                  ))}
               </dl>
            </CardContent>
         </Card>
      </div>
   );
}
