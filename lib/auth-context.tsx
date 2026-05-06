"use client";
import {
   createContext,
   useContext,
   useState,
   useEffect,
   ReactNode,
} from "react";
import { INITIAL_USERS, INITIAL_COMPANIES, type Role } from "./mock-auth-data";

export interface AuthSession {
   userId: string;
   email: string;
   name: string;
   role: Role;
   companyId: string | null;
}

interface AuthContextValue {
   session: AuthSession | null;
   selectedCompanyId: string | null;
   effectiveCompanyId: string | null;
   setSelectedCompanyId: (id: string | null) => void;
   login: (
      email: string,
      password: string,
   ) => Promise<{ success: boolean; error?: string }>;
   logout: () => void;
   isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "ip-session";
const COMPANY_KEY = "ip-company";

// MOCK ONLY — do not ship: session cookie must be set server-side with HttpOnly flag in production
function setCookie(name: string, value: string) {
   document.cookie = `${name}=${value}; path=/; max-age=86400; SameSite=Lax`;
}

function clearCookie(name: string) {
   document.cookie = `${name}=; path=/; max-age=0`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
   const [session, setSession] = useState<AuthSession | null>(null);
   const [selectedCompanyId, setSelected] = useState<string | null>(null);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      try {
         const raw = localStorage.getItem(SESSION_KEY);
         if (raw) setSession(JSON.parse(raw));
         const co = localStorage.getItem(COMPANY_KEY);
         if (co) setSelected(co);
      } catch {}
      setIsLoading(false);
   }, []);

   const login = async (
      email: string,
      password: string,
   ): Promise<{ success: boolean; error?: string }> => {
      await new Promise((r) => setTimeout(r, 800));
      const user = INITIAL_USERS.find(
         (u) =>
            u.email === email &&
            u.password === password &&
            u.status === "active",
      );
      if (!user) return { success: false, error: "Invalid email or password" };

      const s: AuthSession = {
         userId: user.id,
         email: user.email,
         name: user.name,
         role: user.role,
         companyId: user.companyId,
      };
      setSession(s);
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setCookie(SESSION_KEY, btoa(JSON.stringify(s)));

      if (user.role === "vendor_admin") {
         const firstId = INITIAL_COMPANIES[0]?.id ?? null;
         setSelected(firstId);
         if (firstId) {
            localStorage.setItem(COMPANY_KEY, firstId);
            setCookie(COMPANY_KEY, firstId);
         }
      }
      return { success: true };
   };

   const logout = () => {
      setSession(null);
      setSelected(null);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(COMPANY_KEY);
      clearCookie(SESSION_KEY);
      clearCookie(COMPANY_KEY);
   };

   const setSelectedCompanyId = (id: string | null) => {
      setSelected(id);
      if (id) {
         localStorage.setItem(COMPANY_KEY, id);
         setCookie(COMPANY_KEY, id);
      } else {
         localStorage.removeItem(COMPANY_KEY);
         clearCookie(COMPANY_KEY);
      }
   };

   const effectiveCompanyId =
      session?.role === "vendor_admin"
         ? selectedCompanyId
         : (session?.companyId ?? null);

   return (
      <AuthContext.Provider
         value={{
            session,
            selectedCompanyId,
            effectiveCompanyId,
            setSelectedCompanyId,
            login,
            logout,
            isLoading,
         }}
      >
         {children}
      </AuthContext.Provider>
   );
}

export function useAuth() {
   const ctx = useContext(AuthContext);
   if (!ctx) throw new Error("useAuth must be used within AuthProvider");
   return ctx;
}
