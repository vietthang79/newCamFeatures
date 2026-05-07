"use client";
import {
   createContext,
   useContext,
   useState,
   useCallback,
   useEffect,
   type ReactNode,
} from "react";
import { toast } from "sonner";

interface CameraContextValue {
   refreshing: boolean;
   lastRefresh: Date | null;
   handleRefresh: () => Promise<void>;
}

const CameraContext = createContext<CameraContextValue | null>(null);

export function CameraProvider({ children }: { children: ReactNode }) {
   const [refreshing, setRefreshing] = useState(false);
   const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

   useEffect(() => {
      setLastRefresh(new Date());
   }, []);

   const handleRefresh = useCallback(async () => {
      setRefreshing(true);
      await new Promise((r) => setTimeout(r, 1500));
      setRefreshing(false);
      setLastRefresh(new Date());
      toast.success("Snapshot refreshed");
   }, []);

   return (
      <CameraContext.Provider value={{ refreshing, lastRefresh, handleRefresh }}>
         {children}
      </CameraContext.Provider>
   );
}

export function useCameraContext() {
   const ctx = useContext(CameraContext);
   if (!ctx) throw new Error("useCameraContext must be used within CameraProvider");
   return ctx;
}
