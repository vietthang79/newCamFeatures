import { MOCK_CAMERAS } from "@/lib/mock-data";
import CameraLayoutClient from "./camera-layout-client";

export function generateStaticParams() {
   return MOCK_CAMERAS.map((camera) => ({ id: camera.id }));
}

export default function CameraDetailLayout({
   children,
   params,
}: {
   children: React.ReactNode;
   params: { id: string };
}) {
   return (
      <CameraLayoutClient params={params}>
         {children}
      </CameraLayoutClient>
   );
}
