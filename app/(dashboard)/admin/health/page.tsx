"use client";
import {
   Download,
   Shield,
   Activity,
   AlertTriangle,
   Building2,
   Camera,
} from "lucide-react";
import { MOCK_COMPANIES } from "@/lib/mock-data";
import { formatTimeAgo, cameraStatus, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/cameras/status-badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import Link from "next/link";

const KPI_CARDS = [
   {
      label: "Total Frames Today",
      value: "1,284,032",
      icon: Activity,
      color: "text-pri-text",
      bg: "bg-primary-light",
      border: "border-primary/20",
   },
   {
      label: "Total Alerts Today",
      value: "7",
      icon: AlertTriangle,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
   },
   {
      label: "Companies Active",
      value: "4",
      icon: Building2,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
   },
   {
      label: "Cameras Total",
      value: "23",
      icon: Camera,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-200",
   },
];

type Company = (typeof MOCK_COMPANIES)[number];
type Cam = Company["cameras"][number];

function getCompanyStats(company: Company) {
   const latestFrame = company.cameras.reduce<Date | null>((latest, cam) => {
      if (!cam.last_frame_at) return latest;
      if (!latest || cam.last_frame_at > latest) return cam.last_frame_at;
      return latest;
   }, null);
   const totalFpm =
      company.cameras.filter((c) => cameraStatus(c.last_frame_at) === "online")
         .length * 24.6;
   const errors = Math.floor(Math.random() * 5);
   return { latestFrame, totalFpm, errors };
}

const companyColumns: ColumnDef<Company>[] = [
   {
      key: "name",
      header: "Company",
      sortable: true,
      sortType: "text",
      sortValue: (c) => c.name,
      render: (c) => (
         <span className="font-medium text-gray-800">{c.name}</span>
      ),
   },
   {
      key: "cameras",
      header: "Cameras",
      sortable: true,
      sortType: "number",
      sortValue: (c) => c.cameras.length,
      render: (c) => <span className="text-gray-600">{c.cameras.length}</span>,
   },
   {
      key: "fpm",
      header: "FPS (5sec)",
      sortable: true,
      sortType: "number",
      sortValue: (c) =>
         c.cameras.filter((cam) => cameraStatus(cam.last_frame_at) === "online")
            .length * 24.6,
      render: (c) => {
         const fpm =
            c.cameras.filter(
               (cam) => cameraStatus(cam.last_frame_at) === "online",
            ).length * 24.6;
         return <span className="text-gray-600">{fpm.toFixed(1)}</span>;
      },
   },
   {
      key: "last_frame",
      header: "Last Frame",
      sortable: true,
      sortType: "date",
      sortValue: (c) => getCompanyStats(c).latestFrame,
      render: (c) => (
         <span className="text-gray-500 text-xs">
            {formatTimeAgo(getCompanyStats(c).latestFrame)}
         </span>
      ),
   },
   {
      key: "errors",
      header: "Errors (24h)",
      render: (c) => {
         const { errors } = getCompanyStats(c);
         return errors > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
               <AlertTriangle className="h-3 w-3" />
               {errors}
            </span>
         ) : (
            <span className="text-xs text-gray-400">0</span>
         );
      },
   },
];

const cameraSubColumns: ColumnDef<Cam>[] = [
   {
      key: "name",
      header: "Camera",
      className: "w-48",
      sortable: true,
      sortType: "text",
      sortValue: (c) => c.name,
      render: (c) => (
         <span className="font-medium text-gray-700">{c.name}</span>
      ),
   },
   {
      key: "ip",
      header: "IP",
      render: (c) => <span className="font-mono text-gray-500">{c.ip}</span>,
   },
   {
      key: "status",
      header: "Status",
      sortable: true,
      sortType: "text",
      sortValue: (c) => cameraStatus(c.last_frame_at),
      render: (c) => <StatusBadge status={cameraStatus(c.last_frame_at)} />,
   },
   {
      key: "fpm",
      header: "FPS",
      sortable: true,
      sortType: "number",
      sortValue: (c) => (cameraStatus(c.last_frame_at) === "online" ? 24.6 : 0),
      render: (c) => (
         <span className="text-gray-500">
            {cameraStatus(c.last_frame_at) === "online" ? "24.6" : "0"}
         </span>
      ),
   },
   {
      key: "last_frame_at",
      header: "Last Frame",
      sortable: true,
      sortType: "date",
      sortValue: (c) => c.last_frame_at,
      render: (c) => (
         <span className="text-gray-400">{formatTimeAgo(c.last_frame_at)}</span>
      ),
   },
];

function CameraSubTable({ cameras }: { cameras: Cam[] }) {
   return (
      <div className="my-2">
         <DataTable
            data={cameras}
            columns={cameraSubColumns}
            getRowKey={(c) => c.id}
            rowActions={(c) => (
               <Link
                  href={`/cameras/${c.id}/overview`}
                  className="text-pri-text hover:text-primary-dark transition-colors text-xs"
               >
                  View →
               </Link>
            )}
         />
      </div>
   );
}

export default function AdminHealthPage() {
   const { session } = useAuth();

   if (session?.role !== "vendor_admin") {
      return (
         <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-200">
               <Shield className="h-8 w-8 text-red-500" />
            </div>
            <div>
               <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
               <p className="mt-1 text-sm text-gray-500">
                  This page requires vendor admin privileges.
               </p>
            </div>
            <Button variant="outline" asChild>
               <Link href="/cameras">Back to Cameras</Link>
            </Button>
         </div>
      );
   }

   return (
      <div className="space-y-6">
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-xl font-bold text-gray-900">
                  Admin Health Dashboard
               </h1>
               <p className="text-sm text-gray-500">
                  Global camera health across all companies
               </p>
            </div>
            <div className="flex items-center gap-3">
               <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success("Exported to CSV")}
               >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
               </Button>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {KPI_CARDS.map(
               ({ label, value, icon: Icon, color, bg, border }) => (
                  <Card key={label} className={cn("border", border, bg)}>
                     <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                           <div>
                              <p className="text-xs text-gray-500">{label}</p>
                              <p
                                 className={cn(
                                    "mt-1 text-2xl font-bold",
                                    color,
                                 )}
                              >
                                 {value}
                              </p>
                           </div>
                           <Icon className={cn("h-5 w-5", color)} />
                        </div>
                     </CardContent>
                  </Card>
               ),
            )}
         </div>

         <DataTable
            data={MOCK_COMPANIES}
            columns={companyColumns}
            getRowKey={(c) => c.id}
            expandable={(c) => <CameraSubTable cameras={c.cameras} />}
         />
      </div>
   );
}
