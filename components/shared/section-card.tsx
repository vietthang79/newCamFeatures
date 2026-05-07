import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
   icon: LucideIcon;
   iconColor: string;
   iconBg: string;
   title: string;
   subtitle?: React.ReactNode;
   trailing?: React.ReactNode;
   contentClassName?: string;
   className?: string;
   children: React.ReactNode;
}

export function SectionCard({
   icon: Icon,
   iconColor,
   iconBg,
   title,
   subtitle,
   trailing,
   contentClassName,
   className,
   children,
}: SectionCardProps) {
   return (
      <div
         className={cn(
            "overflow-hidden rounded-xl border border-gray-200 bg-white",
            className,
         )}
      >
         <div className="flex items-center gap-3 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white px-4 py-3">
            <div
               className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  iconBg,
               )}
            >
               <Icon className={cn("h-4 w-4", iconColor)} />
            </div>
            <div className="min-w-0 flex-1">
               <p className="text-sm font-semibold text-gray-900">{title}</p>
               {subtitle && (
                  <p className="text-xs text-gray-400">{subtitle}</p>
               )}
            </div>
            {trailing}
         </div>
         <div className={cn("p-4", contentClassName)}>{children}</div>
      </div>
   );
}
