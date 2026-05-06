"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
   Eye,
   EyeOff,
   Loader2,
   AlertCircle,
   Building2,
   ChevronRight,
   ArrowLeft,
   ShieldCheck,
   Check,
} from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { INITIAL_COMPANIES, INITIAL_USERS } from "@/lib/mock-auth-data";

const ADMIN_OPTION = {
   id: "__admin__",
   name: "Vendor Admin",
   slug: "intellipark-hq",
   status: "active" as const,
   createdAt: "",
};

const ALL_OPTIONS = [
   ADMIN_OPTION,
   ...INITIAL_COMPANIES.filter((c) => c.status === "active"),
];

type Step = "company" | "credentials";

export default function LoginPage() {
   const router = useRouter();
   const { login, session, isLoading } = useAuth();

   const [step, setStep] = useState<Step>("company");
   console.log("🚀 ~ LoginPage ~ step:", step);
   const [selectedId, setSelectedId] = useState<string | null>(null);
   console.log("🚀 ~ LoginPage ~ selectedId:", selectedId);
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [showPass, setShowPass] = useState(false);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");

   useEffect(() => {
      if (!isLoading && session) router.replace("/cameras");
   }, [session, isLoading, router]);

   const selectedOption = ALL_OPTIONS.find((o) => o.id === selectedId);

   const demoAccountsForSelection = INITIAL_USERS.filter((u) => {
      if (selectedId === "__admin__") return u.role === "vendor_admin";
      return u.companyId === selectedId;
   });

   const handleSelectCompany = (id: string) => {
      setSelectedId(id);
      setEmail("");
      setPassword("");
      setError("");
      setStep("credentials");
   };

   const handleLogin = async () => {
      if (!email || !password) {
         setError("Please enter your email and password.");
         return;
      }

      const userRecord = INITIAL_USERS.find((u) => u.email === email);
      if (userRecord) {
         if (selectedId === "__admin__" && userRecord.role !== "vendor_admin") {
            setError("This account does not have vendor admin access.");
            return;
         }
         if (
            selectedId !== "__admin__" &&
            userRecord.companyId !== selectedId
         ) {
            setError("This account does not belong to the selected company.");
            return;
         }
      }

      setLoading(true);
      setError("");
      const result = await login(email, password);
      setLoading(false);
      if (!result.success) {
         setError(result.error ?? "Login failed.");
         return;
      }
      router.push("/cameras");
   };

   const handleBack = () => {
      if (step === "company") return;
      setStep("company");
      setSelectedId(null);
      setEmail("");
      setPassword("");
      setError("");
   };

   return (
      <div
         className="flex min-h-screen items-center justify-center px-4 bg-cover bg-center"
         style={{
            backgroundImage:
               "url('/image/imageIntelliPark/login-background.jpg')",
         }}
      >
         <div className="w-full max-w-sm">
            <div className="backdrop-blur-sm bg-white/60 rounded-2xl shadow-2xl border border-white/30 overflow-hidden transition-all duration-700">
               {/* Logo */}
               <div className="flex justify-center pt-8 pb-2 px-6">
                  <Image
                     src="/image/imageIntelliPark/eCamLogoTest.jpg"
                     alt="Intelli-Park"
                     width={220}
                     height={92}
                     className="object-contain rounded-lg"
                     priority
                  />
               </div>
               {/* Step indicator */}
               <div className="flex items-center justify-between gap-0 pb-4 flex-1 w-full px-6">
                  {/* Step 1 */}
                  <div className="flex flex-col items-center gap-1.5">
                     <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                           step === "company"
                              ? "border-primary bg-primary text-black"
                              : "border-primary/60 bg-primary text-white"
                        } ${step === "company" ? "cursor-default" : "cursor-pointer hover:border-primary-dark hover:bg-primary-dark"} `}
                        onClick={handleBack}
                     >
                        {step === "credentials" ? (
                           <Check className="h-4 w-4" />
                        ) : (
                           <span className="text-xs font-bold">1</span>
                        )}
                     </div>
                     <span
                        className={`text-[11px] font-medium leading-none text-black`}
                     >
                        Select Account
                     </span>
                  </div>

                  {/* Connector */}
                  <div className="relative mx-2 mb-5 h-0.5 w-40 bg-gray-200">
                     <div
                        className={`absolute inset-y-0 left-0 bg-primary transition-all duration-300 ${
                           step === "credentials" ? "w-full" : "w-0"
                        }`}
                     />
                  </div>

                  {/* Step 2 */}
                  <div className="flex flex-col items-center gap-1.5">
                     <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                           step === "credentials"
                              ? "border-primary bg-primary text-black"
                              : "border-gray-300 bg-transparent text-gray-500"
                        }`}
                     >
                        <span className="text-xs font-bold">2</span>
                     </div>
                     <span
                        className={`text-[11px] font-medium leading-none ${
                           step === "credentials"
                              ? "text-black"
                              : "text-gray-400"
                        }`}
                     >
                        Sign In
                     </span>
                  </div>
               </div>

               <div className="h-px bg-gray-100" />

               <div className="p-6">
                  {step === "company" && (
                     <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-700">
                           Choose your account type
                        </p>
                        <div className="space-y-2">
                           {ALL_OPTIONS.map((option) => (
                              <button
                                 key={option.id}
                                 onClick={() => handleSelectCompany(option.id)}
                                 className="group w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-all hover:border-primary/50 hover:bg-primary-light cursor-pointer"
                              >
                                 <div
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${option.id === "__admin__" ? "bg-primary-light" : "bg-gray-100"}`}
                                 >
                                    {option.id === "__admin__" ? (
                                       <ShieldCheck className="h-4 w-4 text-pri-text" />
                                    ) : (
                                       <Building2 className="h-4 w-4 text-gray-500" />
                                    )}
                                 </div>
                                 <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                                       {option.name}
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono">
                                       {option.slug}
                                    </p>
                                 </div>
                                 <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-pri-text transition-colors" />
                              </button>
                           ))}
                        </div>
                     </div>
                  )}

                  {step === "credentials" && selectedOption && (
                     <div className="space-y-4">
                        {/* Selected company header */}
                        <div className="flex items-center gap-2">
                           <button
                              onClick={handleBack}
                              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                              aria-label="Back"
                           >
                              <ArrowLeft className="h-4 w-4" />
                           </button>
                           <div className="flex items-center gap-2 rounded-md bg-gray-100 px-2.5 py-1.5">
                              {selectedOption.id === "__admin__" ? (
                                 <ShieldCheck className="h-3.5 w-3.5 text-pri-text" />
                              ) : (
                                 <Building2 className="h-3.5 w-3.5 text-gray-500" />
                              )}
                              <span className="text-xs font-medium text-gray-700">
                                 {selectedOption.name}
                              </span>
                           </div>
                        </div>

                        {/* Credentials form */}
                        <div className="space-y-3">
                           <div className="space-y-1.5">
                              <label
                                 htmlFor="email"
                                 className="text-sm font-medium text-gray-700"
                              >
                                 Email
                              </label>
                              <Input
                                 id="email"
                                 type="email"
                                 placeholder="you@example.com"
                                 value={email}
                                 onChange={(e) => setEmail(e.target.value)}
                                 onKeyDown={(e) =>
                                    e.key === "Enter" && handleLogin()
                                 }
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label
                                 htmlFor="password"
                                 className="text-sm font-medium text-gray-700"
                              >
                                 Password
                              </label>
                              <div className="relative">
                                 <Input
                                    id="password"
                                    type={showPass ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) =>
                                       setPassword(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                       e.key === "Enter" && handleLogin()
                                    }
                                    className="pr-10"
                                 />
                                 <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                 >
                                    {showPass ? (
                                       <EyeOff className="h-4 w-4" />
                                    ) : (
                                       <Eye className="h-4 w-4" />
                                    )}
                                 </button>
                              </div>
                           </div>

                           {error && (
                              <div className="flex items-center gap-2 rounded-md border border-red-500 bg-red-100 px-3 py-2 text-sm text-red-500">
                                 <AlertCircle className="h-4 w-4 shrink-0" />
                                 {error}
                              </div>
                           )}

                           <Button
                              className="w-full"
                              onClick={handleLogin}
                              disabled={loading}
                           >
                              {loading && (
                                 <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              {loading ? "Signing in…" : "Sign In"}
                           </Button>
                        </div>

                        {/* Demo accounts for this context */}
                        {demoAccountsForSelection.length > 0 && (
                           <div className="space-y-1.5 pt-1">
                              <p className="text-xs text-gray-400">
                                 Demo accounts
                              </p>
                              {demoAccountsForSelection.map((u) => (
                                 <button
                                    key={u.id}
                                    onClick={() => {
                                       setEmail(u.email);
                                       setPassword(u.password);
                                       setError("");
                                    }}
                                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs text-gray-500 hover:border-gray-300 hover:text-gray-800 transition-colors cursor-pointer"
                                 >
                                    <span className="font-medium text-gray-700">
                                       {u.name}
                                    </span>
                                    <span className="ml-2 text-gray-400">
                                       {u.email}
                                    </span>
                                 </button>
                              ))}
                           </div>
                        )}
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
