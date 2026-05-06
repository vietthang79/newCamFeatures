"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface RefreshIndicatorProps {
   intervalMs?: number;
}

export function RefreshIndicator({
   intervalMs = 30_000,
}: RefreshIndicatorProps) {
   const [seconds, setSeconds] = useState(0);
   const [spinning, setSpinning] = useState(false);

   useEffect(() => {
      const tick = setInterval(() => {
         setSeconds((s) => {
            const next = s + 1;
            if (next >= intervalMs / 1000) {
               setSpinning(true);
               setTimeout(() => setSpinning(false), 600);
               return 0;
            }
            return next;
         });
      }, 1000);
      return () => clearInterval(tick);
   }, [intervalMs]);

   return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
         <RefreshCw className={cn("h-3 w-3", spinning && "animate-spin")} />
         <span>Updated {seconds}s ago</span>
      </div>
   );
}
