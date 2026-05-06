import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { DataProvider } from "@/lib/data-store";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
   title: "Intelli-Park MVP v0.3",
   description: "Camera Management System",
   icons: {
      icon: "/image/imageIntelliPark/logo-head-html.png",
   },
};

export default function RootLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <html lang="en">
         <body className={inter.className} style={{ background: "#FFFFFF" }}>
            <AuthProvider>
               <DataProvider>
                  {children}
                  <Toaster position="bottom-right" theme="light" richColors />
               </DataProvider>
            </AuthProvider>
         </body>
      </html>
   );
}
