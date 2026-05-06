"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
   ArrowLeft,
   Eye,
   EyeOff,
   AlertCircle,
   CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/shared/loading-button";
import { SnapshotPlaceholder } from "@/components/cameras/snapshot-placeholder";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const schema = z.object({
   name: z.string().min(1, "Camera name is required"),
   ip: z
      .string()
      .min(1, "IP address is required")
      .regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IP address"),
   port: z.coerce.number().int().min(1).max(65535),
   username: z.string().min(1, "Username is required"),
   password: z.string().min(1, "Password is required"),
   location: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type SubmitState = "idle" | "loading" | "error" | "success";

const ERROR_MESSAGES: Record<string, string> = {
   NETWORK_UNREACHABLE:
      "Cannot reach camera at this IP/port. Check network connectivity.",
   INVALID_CREDENTIALS:
      "Wrong username or password. Please verify camera credentials.",
   ONVIF_PROTOCOL_ERROR:
      "Camera responded but ONVIF negotiation failed. Check camera firmware.",
};
const ERROR_KEYS = Object.keys(ERROR_MESSAGES);

export default function NewCameraPage() {
   const router = useRouter();
   const [submitState, setSubmitState] = useState<SubmitState>("idle");
   const [errorKey, setErrorKey] = useState<string>("");
   const [showPass, setShowPass] = useState(false);
   const [registeredName, setRegisteredName] = useState("");

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const {
      register,
      handleSubmit,
      formState: { errors },
   } = useForm<FormData>({
      resolver: zodResolver(schema) as any,
      defaultValues: { port: 80, username: "admin" },
   });

   const onSubmit = async (data: FormData) => {
      setSubmitState("loading");
      await new Promise((r) => setTimeout(r, 2000));

      // 70% success for demo
      if (Math.random() > 0.3) {
         setRegisteredName(data.name);
         setSubmitState("success");
         toast.success(`Camera "${data.name}" registered successfully!`);
      } else {
         const key = ERROR_KEYS[Math.floor(Math.random() * ERROR_KEYS.length)];
         setErrorKey(key);
         setSubmitState("error");
         toast.error("Camera registration failed");
      }
   };

   return (
      <div className="space-y-5">
         {/* Header */}
         <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
               <Link href="/cameras" aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
               </Link>
            </Button>
            <h1 className="text-xl font-bold text-gray-900">Register Camera</h1>
         </div>

         <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Form */}
            <Card>
               <CardHeader>
                  <CardTitle className="text-base">Camera Details</CardTitle>
               </CardHeader>
               <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                     {/* Name */}
                     <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                           Camera Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                           placeholder="e.g. Gate A Camera"
                           {...register("name")}
                           className={cn(errors.name && "border-red-500")}
                        />
                        {errors.name && (
                           <p className="text-xs text-red-500">
                              {errors.name.message}
                           </p>
                        )}
                     </div>

                     {/* IP + Port */}
                     <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1.5">
                           <label className="text-sm font-medium text-gray-700">
                              IP Address <span className="text-red-500">*</span>
                           </label>
                           <Input
                              placeholder="192.168.1.100"
                              {...register("ip")}
                              className={cn(errors.ip && "border-red-500")}
                           />
                           {errors.ip && (
                              <p className="text-xs text-red-500">
                                 {errors.ip.message}
                              </p>
                           )}
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-sm font-medium text-gray-700">
                              Port
                           </label>
                           <Input type="number" {...register("port")} />
                        </div>
                     </div>

                     {/* Username */}
                     <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                           Username <span className="text-red-500">*</span>
                        </label>
                        <Input
                           {...register("username")}
                           className={cn(errors.username && "border-red-500")}
                        />
                        {errors.username && (
                           <p className="text-xs text-red-500">
                              {errors.username.message}
                           </p>
                        )}
                     </div>

                     {/* Password */}
                     <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                           Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                           <Input
                              type={showPass ? "text" : "password"}
                              placeholder="••••••••"
                              {...register("password")}
                              className={cn(
                                 "pr-10",
                                 errors.password && "border-red-500",
                              )}
                           />
                           <button
                              type="button"
                              onClick={() => setShowPass(!showPass)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                              aria-label={
                                 showPass ? "Hide password" : "Show password"
                              }
                           >
                              {showPass ? (
                                 <EyeOff className="h-4 w-4" />
                              ) : (
                                 <Eye className="h-4 w-4" />
                              )}
                           </button>
                        </div>
                        {errors.password && (
                           <p className="text-xs text-red-500">
                              {errors.password.message}
                           </p>
                        )}
                     </div>

                     {/* Location */}
                     <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                           Location{" "}
                           <span className="text-gray-400">(optional)</span>
                        </label>
                        <Input
                           placeholder="e.g. Gate A, Lot B"
                           {...register("location")}
                        />
                     </div>

                     {/* Model badge */}
                     <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                           Model
                        </label>
                        <div className="flex h-9 items-center">
                           <Badge
                              variant="secondary"
                              className="font-mono text-xs"
                           >
                              MS-C8241-X36PE
                           </Badge>
                        </div>
                     </div>

                     {/* Error banner */}
                     {submitState === "error" && errorKey && (
                        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
                           <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                           <div>
                              <p className="font-medium">
                                 {errorKey.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs mt-0.5 text-red-500">
                                 {ERROR_MESSAGES[errorKey]}
                              </p>
                           </div>
                        </div>
                     )}

                     {/* Submit */}
                     <LoadingButton
                        type="submit"
                        loading={submitState === "loading"}
                        loadingText="Probing ONVIF connection…"
                        className="w-full"
                        disabled={submitState === "success"}
                     >
                        Register Camera
                     </LoadingButton>
                  </form>
               </CardContent>
            </Card>

            {/* Right: Snapshot preview */}
            <Card>
               <CardHeader>
                  <CardTitle className="text-base">
                     Connection Preview
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  {submitState !== "success" ? (
                     <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 p-8 text-center">
                        <SnapshotPlaceholder
                           className="max-w-sm"
                           label="Snapshot will appear after successful registration"
                        />
                     </div>
                  ) : (
                     <div className="space-y-4">
                        <div className="flex items-center gap-2 text-green-600">
                           <CheckCircle2 className="h-5 w-5" />
                           <span className="font-medium text-sm">
                              Camera registered successfully!
                           </span>
                        </div>
                        <SnapshotPlaceholder label={registeredName} />
                        <Button asChild className="w-full">
                           <Link href="/cameras">View All Cameras</Link>
                        </Button>
                     </div>
                  )}
               </CardContent>
            </Card>
         </div>
      </div>
   );
}
