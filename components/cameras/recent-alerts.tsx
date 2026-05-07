"use client";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZONE_COLORS, type ZoneType } from "@/components/zones/zone-editor";
import { ZONE_LABELS } from "@/components/zones/zone-list";
import { SectionCard } from "@/components/shared/section-card";

type AlertStatus = "CRITICAL" | "APPROVED" | "DONE" | "CANCELLED" | "PENDING";

interface CameraAlert {
   id: string;
   time: string;
   zoneType: ZoneType;
   status: AlertStatus;
   plate: string | null;
   decidedBy: string | null;
}

const STATUS_STYLES: Record<AlertStatus, string> = {
   CRITICAL: "bg-red-500 text-white border-red-500",
   APPROVED: "border-gray-300 text-gray-600 bg-white",
   DONE: "border-gray-300 text-gray-600 bg-white",
   CANCELLED: "border-gray-200 text-gray-400 bg-white",
   PENDING: "border-amber-300 text-amber-600 bg-amber-50",
};

export const MOCK_CAMERA_ALERTS: CameraAlert[] = [
   { id: "a1", time: "14:23:47", zoneType: "parking_zone",    status: "CRITICAL",  plate: null,       decidedBy: null },
   { id: "a2", time: "12:18:33", zoneType: "parking_zone",    status: "APPROVED",  plate: "YA22 NMR", decidedBy: "Sarah K." },
   { id: "a3", time: "12:08:21", zoneType: "entrance_zone",   status: "DONE",      plate: "XY99 ABC", decidedBy: "Sarah K." },
   { id: "a4", time: "10:42:09", zoneType: "no_smoking_zone", status: "CANCELLED", plate: "DV68 RTX", decidedBy: "Sarah K." },
   { id: "a5", time: "09:15:55", zoneType: "parking_zone",    status: "DONE",      plate: "PL21 XYZ", decidedBy: "Sarah K." },
   { id: "a6", time: "12:18:33", zoneType: "entrance_zone",   status: "APPROVED",  plate: "BK19 WQR", decidedBy: "Mike T." },
   { id: "a7", time: "08:30:11", zoneType: "no_smoking_zone", status: "PENDING",   plate: "HN23 LMP", decidedBy: null },
];

interface RecentAlertsProps {
   alerts: CameraAlert[];
}

export function RecentAlerts({ alerts }: RecentAlertsProps) {
   return (
      <SectionCard
         icon={Bell}
         iconColor="text-amber-500"
         iconBg="bg-amber-50"
         title="Recent alerts"
         subtitle="Last 10 from this camera"
         contentClassName="p-0"
      >
         {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
               No recent alerts for this camera.
            </p>
         ) : (
            <>
               {/* Desktop table — mirrors DataTable's inner table styles */}
               <div className="hidden overflow-hidden md:block">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
                           <th className="px-4 py-3 font-medium">Time</th>
                           <th className="px-4 py-3 font-medium">Type</th>
                           <th className="px-4 py-3 font-medium">Status</th>
                           <th className="px-4 py-3 font-medium">Plate</th>
                           <th className="px-4 py-3 font-medium">Decided by</th>
                        </tr>
                     </thead>
                     <tbody>
                        {alerts.map((alert, i) => (
                           <tr
                              key={alert.id}
                              className={cn(
                                 "cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50",
                                 i % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                              )}
                           >
                              <td className="px-4 py-3">
                                 <span className="font-mono text-sm text-gray-700">
                                    {alert.time}
                                 </span>
                              </td>
                              <td className="px-4 py-3">
                                 <span className="flex items-center gap-1.5">
                                    <span
                                       className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                       style={{ backgroundColor: ZONE_COLORS[alert.zoneType] }}
                                    />
                                    <span className="truncate text-xs font-medium text-gray-700">
                                       {ZONE_LABELS[alert.zoneType]}
                                    </span>
                                 </span>
                              </td>
                              <td className="px-4 py-3">
                                 <span
                                    className={cn(
                                       "rounded border px-2 py-0.5 text-xs font-semibold uppercase",
                                       STATUS_STYLES[alert.status],
                                    )}
                                 >
                                    {alert.status}
                                 </span>
                              </td>
                              <td className="px-4 py-3">
                                 {alert.plate ? (
                                    <span className="inline-block rounded border border-yellow-400 bg-yellow-300 px-2 py-0.5 font-mono text-xs font-bold text-gray-900">
                                       {alert.plate}
                                    </span>
                                 ) : (
                                    <span className="inline-block rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs italic text-gray-400">
                                       Not detected
                                    </span>
                                 )}
                              </td>
                              <td className="px-4 py-3">
                                 <span className="text-sm text-gray-600">
                                    {alert.decidedBy ?? "—"}
                                 </span>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               {/* Mobile cards */}
               <div className="grid gap-3 p-3 md:hidden">
                  {alerts.map((alert) => (
                     <div
                        key={alert.id}
                        className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
                     >
                        <div className="flex items-start justify-between gap-2">
                           <span className="flex items-center gap-1.5">
                              <span
                                 className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                 style={{ backgroundColor: ZONE_COLORS[alert.zoneType] }}
                              />
                              <span className="text-xs font-medium text-gray-700">
                                 {ZONE_LABELS[alert.zoneType]}
                              </span>
                           </span>
                           <span
                              className={cn(
                                 "rounded border px-2 py-0.5 text-xs font-semibold uppercase",
                                 STATUS_STYLES[alert.status],
                              )}
                           >
                              {alert.status}
                           </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                           <span className="font-mono">{alert.time}</span>
                           {alert.plate ? (
                              <span className="rounded border border-yellow-400 bg-yellow-300 px-2 py-0.5 font-mono text-xs font-bold text-gray-900">
                                 {alert.plate}
                              </span>
                           ) : (
                              <span className="italic text-gray-400">Not detected</span>
                           )}
                        </div>
                        {alert.decidedBy && (
                           <p className="mt-1.5 text-xs text-gray-500">
                              By: {alert.decidedBy}
                           </p>
                        )}
                     </div>
                  ))}
               </div>
            </>
         )}
      </SectionCard>
   );
}
