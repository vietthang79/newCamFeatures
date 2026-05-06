import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
}

export function formatTimeAgo(date: Date | null): string {
   if (!date) return "Never";
   const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
   if (seconds < 60) return `${seconds}s ago`;
   const minutes = Math.floor(seconds / 60);
   if (minutes < 60) return `${minutes}m ago`;
   const hours = Math.floor(minutes / 60);
   return `${hours}h ago`;
}

export function cameraStatus(
   lastFrameAt: Date | null,
): "online" | "warning" | "offline" | "pending" {
   if (!lastFrameAt) return "pending";
   const age = Date.now() - lastFrameAt.getTime();
   if (age < 60_000) return "online";
   if (age < 300_000) return "warning";
   return "offline";
}
