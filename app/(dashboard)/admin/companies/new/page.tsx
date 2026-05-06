"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/lib/data-store";
import { generateSlug, type Status } from "@/lib/mock-auth-data";
import { toast } from "sonner";

export default function NewCompanyPage() {
  const router = useRouter();
  const { addCompany } = useData();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slug = generateSlug(name);

  const handleSave = async () => {
    if (!name.trim()) { setError("Company name is required."); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    addCompany({ name: name.trim(), status });
    toast.success("Company created successfully");
    router.push("/admin/companies");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/companies"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-bold text-gray-900">New Company</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Company Name <span className="text-red-500">*</span></label>
          <Input
            placeholder="e.g. Acme Parking Ltd"
            value={name}
            onChange={e => { setName(e.target.value); setError(""); }}
          />
          {name && (
            <p className="text-xs text-gray-400">Slug: <span className="font-mono text-gray-500">{slug}</span></p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <Select value={status} onValueChange={v => setStatus(v as Status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Create Company"}
          </Button>
          <Button variant="outline" asChild disabled={saving}>
            <Link href="/admin/companies">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
