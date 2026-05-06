"use client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <div
         className="flex h-screen overflow-hidden"
         style={{ background: "#FFFFFF" }}
      >
         <Sidebar />
         <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-6 bg-gray-50">{children}</main>
         </div>
      </div>
   );
}
