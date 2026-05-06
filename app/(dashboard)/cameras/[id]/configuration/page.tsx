import { MOCK_CAMERAS } from "@/lib/mock-data";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
   CardDescription,
} from "@/components/ui/card";
import { CopyButton } from "@/components/shared/copy-button";

const API_BASE =
   process.env.NEXT_PUBLIC_API_BASE ?? "https://api.intellipark.io";

function ConfigRow({ label, value }: { label: string; value: string }) {
   return (
      <div className="space-y-1.5">
         <p className="text-sm font-medium text-gray-700">{label}</p>
         <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="flex-1 font-mono text-sm text-gray-800 break-all">
               {value}
            </span>
            <CopyButton value={value} />
         </div>
      </div>
   );
}

export default function ConfigurationPage({
   params,
}: {
   params: { id: string };
}) {
   const camera =
      MOCK_CAMERAS.find((c) => c.id === params.id) ?? MOCK_CAMERAS[0];
   const endpointUrl = `${API_BASE}/ingest/${camera.id}`;

   return (
      <div className="max-w-2xl space-y-6">
         <div>
            <h2 className="text-base font-semibold text-gray-900">
               HTTP Push Configuration
            </h2>
            <p className="mt-1 text-sm text-gray-500">
               Copy these values into your Milesight camera's HTTP notification
               settings.
            </p>
         </div>

         <Card>
            <CardContent className="pt-6 space-y-5">
               <ConfigRow label="Site Key" value={camera.id} />
               <ConfigRow label="Endpoint URL" value={endpointUrl} />
               <ConfigRow label="Trigger Interval" value="500ms" />
            </CardContent>
         </Card>

         <Card className="border-primary/20 bg-primary-light/50">
            <CardContent className="pt-4 pb-4">
               <p className="text-xs text-pri-text">
                  In your Milesight camera web UI, navigate to{" "}
                  <strong>Event → HTTP Notification</strong>, then paste the
                  Endpoint URL and Site Key above. Set the trigger interval to
                  500ms for optimal frame rate.
               </p>
            </CardContent>
         </Card>
      </div>
   );
}
