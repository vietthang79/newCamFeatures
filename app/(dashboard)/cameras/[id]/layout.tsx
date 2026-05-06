"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MOCK_CAMERAS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const TABS = [
   { label: "Overview", segment: "overview" },
   { label: "Configuration", segment: "configuration" },
   { label: "Zones", segment: "zones" },
   { label: "Health", segment: "health" },
];

export default function CameraDetailLayout({
   children,
   params,
}: {
   children: React.ReactNode;
   params: { id: string };
}) {
   const pathname = usePathname();
   const camera =
      MOCK_CAMERAS.find((c) => c.id === params.id) ?? MOCK_CAMERAS[0];

   return (
      <div className="space-y-0">
         {/* Camera name header */}
         <div className="flex items-center gap-3 mb-4">
            <Link
               href="/cameras"
               className="text-gray-400 hover:text-gray-600 transition-colors"
               aria-label="Back to cameras"
            >
               <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
               <h1 className="text-lg font-bold text-gray-900">{camera.name}</h1>
               <p className="text-xs font-mono text-gray-500">
                  {camera.ip}:{camera.port}
               </p>
            </div>
         </div>

         {/* Tab bar */}
         <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-0">
               {TABS.map((tab) => {
                  const href = `/cameras/${params.id}/${tab.segment}`;
                  const active =
                     pathname === href || pathname.startsWith(href + "/");
                  return (
                     <Link
                        key={tab.segment}
                        href={href}
                        className={cn(
                           "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer",
                           active
                              ? "border-primary text-pri-text"
                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                        )}
                     >
                        {tab.label}
                     </Link>
                  );
               })}
            </nav>
         </div>

         {children}
      </div>
   );
}
